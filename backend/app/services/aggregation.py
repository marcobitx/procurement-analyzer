# backend/app/services/aggregation.py
# Cross-document aggregation — merges per-doc extractions into one report
# Related: llm.py, models/schemas.py, prompts/aggregation.py

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Awaitable, Callable

from app.models.schemas import AggregatedReport, SourceDocument
from app.prompts.aggregation import AGGREGATION_SYSTEM, AGGREGATION_USER
from app.services.extraction import calculate_max_chars

if TYPE_CHECKING:
    from app.models.schemas import ExtractionResult
    from app.services.llm import LLMClient
    from app.services.parser import ParsedDocument

logger = logging.getLogger(__name__)


def _trim_extraction_json(extraction_json: str, target_chars: int) -> str:
    """Trim extraction JSON to target size by keeping only essential fields."""
    try:
        data = json.loads(extraction_json)
    except json.JSONDecodeError:
        return extraction_json[:target_chars]

    # Priority fields to keep (most important for aggregation)
    essential_fields = {
        "project_title", "project_summary", "procurement_reference",
        "procuring_organization", "procurement_type", "procurement_law",
        "cpv_codes", "estimated_value", "deadlines",
        "evaluation_criteria", "qualification_requirements",
        "key_requirements", "financial_terms", "risk_factors",
        "confidence_notes",
    }

    trimmed = {k: v for k, v in data.items() if k in essential_fields and v is not None}
    result = json.dumps(trimmed, indent=2, ensure_ascii=False)

    if len(result) > target_chars:
        # Further trim: remove large nested lists
        for key in ("key_requirements", "qualification_requirements", "risk_factors"):
            if key in trimmed and isinstance(trimmed[key], list) and len(trimmed[key]) > 5:
                trimmed[key] = trimmed[key][:5]
        result = json.dumps(trimmed, indent=2, ensure_ascii=False)

    return result


async def aggregate_results(
    extractions: list[tuple[ParsedDocument, ExtractionResult, dict]],
    llm: LLMClient,
    model: str,
    context_length: int = 200_000,
    on_thinking: Callable[[str], Awaitable[None]] | None = None,
) -> tuple[AggregatedReport, dict]:
    """
    Merge N extraction results into 1 aggregated report.

    Each tuple contains (parsed_doc, extraction_result, usage_dict_from_extraction).
    The usage_dict from extraction is ignored here — we return the aggregation usage.

    Steps:
    1. Format each extraction as numbered JSON block in user prompt
    2. Collect source_documents from all parsed docs
    3. Call llm.complete_structured() with AGGREGATION_SYSTEM prompt
    4. Return (AggregatedReport, usage_dict)
    """
    logger.info("Aggregating %d extraction results", len(extractions))

    # Build per-document result blocks
    per_doc_blocks: list[str] = []
    all_source_docs: list[SourceDocument] = []

    for idx, (parsed_doc, extraction, _usage) in enumerate(extractions, start=1):
        # Format extraction as numbered JSON block
        extraction_json = extraction.model_dump_json(indent=2, exclude_none=True)
        block = f"Dokumentas {idx}: {parsed_doc.filename}\n```json\n{extraction_json}\n```"
        per_doc_blocks.append(block)

        # Collect source document metadata
        all_source_docs.append(
            SourceDocument(
                filename=parsed_doc.filename,
                type=parsed_doc.doc_type,
                pages=parsed_doc.page_count,
            )
        )

    per_doc_results = "\n\n".join(per_doc_blocks)

    # Format user prompt
    user_prompt = AGGREGATION_USER.format(
        doc_count=len(extractions),
        per_doc_results=per_doc_results,
    )

    # Check if prompt fits in context window; trim if needed
    max_chars = calculate_max_chars(context_length)
    if len(user_prompt) > max_chars:
        logger.warning(
            "Aggregation prompt too large (%dk chars, max %dk). Trimming extractions.",
            len(user_prompt) // 1000, max_chars // 1000,
        )
        # Recalculate with trimmed extraction JSONs
        target_per_doc = (max_chars - 2000) // len(extractions)  # reserve 2k for template
        per_doc_blocks = []
        for idx, (parsed_doc, extraction, _usage) in enumerate(extractions, start=1):
            extraction_json = extraction.model_dump_json(indent=2, exclude_none=True)
            if len(extraction_json) > target_per_doc:
                extraction_json = _trim_extraction_json(extraction_json, target_per_doc)
            block = f"Dokumentas {idx}: {parsed_doc.filename}\n```json\n{extraction_json}\n```"
            per_doc_blocks.append(block)

        per_doc_results = "\n\n".join(per_doc_blocks)
        user_prompt = AGGREGATION_USER.format(
            doc_count=len(extractions),
            per_doc_results=per_doc_results,
        )
        logger.info("Trimmed aggregation prompt to %dk chars", len(user_prompt) // 1000)

    logger.debug(
        "Aggregation prompt: %d chars, %d source documents",
        len(user_prompt),
        len(all_source_docs),
    )

    # Call LLM with streaming thinking
    report, usage = await llm.complete_structured_streaming(
        system=AGGREGATION_SYSTEM,
        user=user_prompt,
        response_schema=AggregatedReport,
        model=model,
        thinking="medium",
        on_thinking=on_thinking,
    )

    # Ensure source_documents includes all analyzed docs
    if not report.source_documents:
        report.source_documents = all_source_docs

    logger.info(
        "Aggregation complete: usage=%s, source_docs=%d",
        usage,
        len(report.source_documents),
    )

    return report, usage
