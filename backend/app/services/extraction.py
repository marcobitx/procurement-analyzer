# backend/app/services/extraction.py
# Per-document LLM extraction orchestrator
# Extracts structured procurement data from parsed documents
# Related: llm.py, parser.py, prompts/extraction.py, models/schemas.py

import asyncio
import logging
from typing import Callable, Optional

from app.models.schemas import ExtractionResult
from app.prompts.extraction import EXTRACTION_SYSTEM, EXTRACTION_USER
from app.services.llm import LLMClient
from app.services.parser import ParsedDocument

logger = logging.getLogger(__name__)


async def extract_document(
    doc: ParsedDocument,
    llm: LLMClient,
    model: str,
) -> tuple[ExtractionResult, dict]:
    """
    Extract structured data from a single parsed document.
    Returns (ExtractionResult, usage_dict).

    Steps:
    1. Format EXTRACTION_USER with doc metadata (filename, doc_type, page_count, content)
    2. Call llm.complete_structured() with EXTRACTION_SYSTEM, formatted user prompt, ExtractionResult schema
    3. Return parsed result + usage

    On error: log, return empty ExtractionResult with confidence_notes describing the error.
    """
    user_prompt = EXTRACTION_USER.format(
        filename=doc.filename,
        document_type=doc.doc_type.value,
        page_count=doc.page_count,
        content=doc.content,
    )

    logger.info(
        "Extracting document: %s (%d pages, ~%d tokens)",
        doc.filename,
        doc.page_count,
        doc.token_estimate,
    )

    try:
        result, usage = await llm.complete_structured(
            system=EXTRACTION_SYSTEM,
            user=user_prompt,
            response_schema=ExtractionResult,
            model=model,
        )
        logger.info(
            "Extraction complete for %s: in=%d out=%d tokens",
            doc.filename,
            usage.get("input_tokens", 0),
            usage.get("output_tokens", 0),
        )
        return result, usage  # type: ignore[return-value]

    except Exception as e:
        logger.error("Extraction failed for %s: %s", doc.filename, e, exc_info=True)
        empty = ExtractionResult(
            confidence_notes=[f"Extraction failed: {e}"],
        )
        return empty, {"input_tokens": 0, "output_tokens": 0}


async def extract_all(
    docs: list[ParsedDocument],
    llm: LLMClient,
    model: str,
    max_concurrent: int = 5,
    on_started: Optional[Callable[[int, str], None]] = None,
    on_completed: Optional[Callable[[int, str, dict], None]] = None,
    on_error: Optional[Callable[[int, str, str], None]] = None,
) -> list[tuple[ParsedDocument, ExtractionResult, dict]]:
    """
    Parallel extraction with concurrency limit.
    Uses asyncio.Semaphore(max_concurrent).

    Returns list of (doc, result, usage) tuples in the same order as input docs.
    Individual failures don't crash the batch — returns partial ExtractionResult.

    Callbacks:
        on_started(index, filename)   — fires when extraction begins for a doc
        on_completed(index, filename, usage) — fires on successful extraction
        on_error(index, filename, error_msg) — fires on extraction failure
    """
    if not docs:
        return []

    semaphore = asyncio.Semaphore(max_concurrent)

    async def _extract_one(
        index: int, doc: ParsedDocument
    ) -> tuple[ParsedDocument, ExtractionResult, dict]:
        async with semaphore:
            if on_started:
                on_started(index, doc.filename)
            try:
                result, usage = await extract_document(doc, llm, model)

                # Check if extract_document already handled the error internally
                has_failure_note = any(
                    note.startswith("Extraction failed:")
                    for note in result.confidence_notes
                )
                if has_failure_note:
                    if on_error:
                        on_error(index, doc.filename, result.confidence_notes[0])
                else:
                    if on_completed:
                        on_completed(index, doc.filename, usage)

                return (doc, result, usage)

            except Exception as e:
                logger.error("Extraction failed for %s: %s", doc.filename, e)
                if on_error:
                    on_error(index, doc.filename, str(e))
                empty = ExtractionResult(
                    confidence_notes=[f"Extraction failed: {e}"],
                )
                return (doc, empty, {"input_tokens": 0, "output_tokens": 0})

    tasks = [_extract_one(i, doc) for i, doc in enumerate(docs)]
    results = await asyncio.gather(*tasks)
    return list(results)
