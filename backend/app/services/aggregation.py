# backend/app/services/aggregation.py
# Cross-document aggregation — merges per-doc extractions into one report
# Related: llm.py, models/schemas.py, prompts/aggregation.py

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Awaitable, Callable

from app.models.schemas import AggregatedReport, SourceDocument
from app.prompts.aggregation import AGGREGATION_SYSTEM, AGGREGATION_USER

if TYPE_CHECKING:
    from app.models.schemas import ExtractionResult
    from app.services.llm import LLMClient
    from app.services.parser import ParsedDocument

logger = logging.getLogger(__name__)


async def aggregate_results(
    extractions: list[tuple[ParsedDocument, ExtractionResult, dict]],
    llm: LLMClient,
    model: str,
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
