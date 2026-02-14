# backend/app/services/extraction.py
# Per-document LLM extraction orchestrator
# Extracts structured procurement data from parsed documents
# Related: llm.py, parser.py, prompts/extraction.py, models/schemas.py

import asyncio
import logging
from typing import Awaitable, Callable, Optional

from app.models.schemas import ExtractionResult
from app.prompts.extraction import EXTRACTION_SYSTEM, EXTRACTION_USER
from app.services.llm import LLMClient
from app.services.parser import ParsedDocument

logger = logging.getLogger(__name__)


def chunk_text(content: str, max_chars: int = 100_000, overlap_chars: int = 8_000) -> list[str]:
    """Split long document content into overlapping chunks.

    Splits on paragraph boundaries (double newline) to avoid breaking mid-sentence.
    Default max_chars=100k (~25k tokens), overlap=8k (~2k tokens).
    """
    if len(content) <= max_chars:
        return [content]

    chunks = []
    start = 0
    while start < len(content):
        end = start + max_chars
        if end < len(content):
            # Find nearest paragraph break before the hard limit
            break_point = content.rfind("\n\n", start + max_chars // 2, end)
            if break_point > start:
                end = break_point
        chunks.append(content[start:end])
        start = end - overlap_chars  # overlap for context continuity
    return chunks


def merge_chunk_extractions(results: list[ExtractionResult]) -> ExtractionResult:
    """Merge multiple chunk extractions into one ExtractionResult.

    Strategy:
    - Scalar fields: take first non-None value
    - List fields: concatenate and deduplicate
    - Nested objects: take first non-None, or merge fields
    """
    if not results:
        return ExtractionResult()
    if len(results) == 1:
        return results[0]

    base = results[0].model_dump()

    for r in results[1:]:
        data = r.model_dump()
        for key, val in data.items():
            existing = base.get(key)

            # List fields: concatenate and deduplicate
            if isinstance(val, list) and isinstance(existing, list):
                seen = set()
                merged = []
                for item in existing + val:
                    # Use string representation for dedup of dicts/objects
                    item_key = str(item)
                    if item_key not in seen:
                        seen.add(item_key)
                        merged.append(item)
                base[key] = merged

            # Scalar/nested: take first non-None
            elif existing is None and val is not None:
                base[key] = val

    return ExtractionResult.model_validate(base)


async def _extract_single(
    doc: ParsedDocument,
    llm: LLMClient,
    model: str,
    on_thinking: Callable[[str], Awaitable[None]] | None = None,
) -> tuple[ExtractionResult, dict]:
    """Extract structured data from a single document/chunk via LLM call."""
    user_prompt = EXTRACTION_USER.format(
        filename=doc.filename,
        document_type=doc.doc_type.value,
        page_count=doc.page_count,
        content=doc.content,
    )

    result, usage = await llm.complete_structured_streaming(
        system=EXTRACTION_SYSTEM,
        user=user_prompt,
        response_schema=ExtractionResult,
        model=model,
        thinking="low",
        on_thinking=on_thinking,
    )
    return result, usage  # type: ignore[return-value]


async def extract_document(
    doc: ParsedDocument,
    llm: LLMClient,
    model: str,
    on_thinking: Callable[[str], Awaitable[None]] | None = None,
) -> tuple[ExtractionResult, dict]:
    """
    Extract structured data from a single parsed document.
    Returns (ExtractionResult, usage_dict).

    For long documents (>100k chars), splits into overlapping chunks,
    extracts from each, then merges results.
    """
    logger.info(
        "Extracting document: %s (%d pages, ~%d tokens)",
        doc.filename,
        doc.page_count,
        doc.token_estimate,
    )

    try:
        chunks = chunk_text(doc.content)

        if len(chunks) == 1:
            # Single chunk — direct extraction
            result, usage = await _extract_single(doc, llm, model, on_thinking=on_thinking)
            logger.info(
                "Extraction complete for %s: in=%d out=%d tokens",
                doc.filename,
                usage.get("input_tokens", 0),
                usage.get("output_tokens", 0),
            )
            return result, usage

        # Multi-chunk: extract from each, then merge
        logger.info("Document %s split into %d chunks", doc.filename, len(chunks))
        partial_results = []
        total_usage = {"input_tokens": 0, "output_tokens": 0}

        for i, chunk in enumerate(chunks):
            chunk_doc = ParsedDocument(
                filename=f"{doc.filename} (dalis {i + 1}/{len(chunks)})",
                content=chunk,
                page_count=doc.page_count,
                file_size_bytes=doc.file_size_bytes,
                doc_type=doc.doc_type,
                token_estimate=len(chunk) // 4,
            )
            result, usage = await _extract_single(chunk_doc, llm, model, on_thinking=on_thinking)
            partial_results.append(result)
            total_usage["input_tokens"] += usage.get("input_tokens", 0)
            total_usage["output_tokens"] += usage.get("output_tokens", 0)

        merged = merge_chunk_extractions(partial_results)
        logger.info(
            "Chunked extraction complete for %s: %d chunks, in=%d out=%d tokens",
            doc.filename,
            len(chunks),
            total_usage["input_tokens"],
            total_usage["output_tokens"],
        )
        return merged, total_usage

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
    on_thinking: Callable[[str], Awaitable[None]] | None = None,
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
                result, usage = await extract_document(doc, llm, model, on_thinking=on_thinking)

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
