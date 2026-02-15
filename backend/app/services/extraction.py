# backend/app/services/extraction.py
# Per-document LLM extraction orchestrator
# Extracts structured procurement data from parsed documents
# Related: llm.py, parser.py, prompts/extraction.py, models/schemas.py

import asyncio
import json
import logging
from typing import Awaitable, Callable, Optional

from app.models.schemas import ExtractionResult
from app.prompts.extraction import EXTRACTION_SYSTEM, EXTRACTION_USER
from app.services.llm import LLMClient
from app.services.parser import ParsedDocument

logger = logging.getLogger(__name__)


def calculate_max_chars(context_length: int) -> int:
    """Calculate max chunk size based on model context window.

    Formula: (context - reserved) * chars_per_token * safety_fill
    Reserved: 32k output + 2k system + 2k thinking + 1k overhead = 37k tokens
    Safety: 70% fill — Anthropic recommends 50-70% for optimal quality.
    """
    reserved = 37_000  # max_output + system + thinking + overhead
    available_tokens = max(context_length - reserved, 8_000)
    safe_tokens = int(available_tokens * 0.70)
    return safe_tokens * 4  # ~4 chars per token


def _find_structure_break(content: str, search_start: int, search_end: int) -> int:
    """Find best structure-aware break point within the search window.

    Priority: heading > double newline > single newline > hard cut.
    Avoids splitting inside table blocks (lines starting with |).
    """
    region = content[search_start:search_end]

    # Priority 1: Markdown headings (## or #)
    for marker in ("\n## ", "\n# "):
        pos = region.rfind(marker)
        if pos >= 0:
            candidate = search_start + pos
            if not _inside_table(content, candidate):
                return candidate

    # Priority 2: Double newline (paragraph break)
    pos = region.rfind("\n\n")
    if pos >= 0:
        candidate = search_start + pos
        if not _inside_table(content, candidate):
            return candidate

    # Priority 3: Single newline
    pos = region.rfind("\n")
    if pos >= 0:
        return search_start + pos

    # Fallback: hard cut at search_end
    return search_end


def _inside_table(content: str, pos: int) -> bool:
    """Check if position is inside a markdown table block (| delimited rows)."""
    # Look at lines around the position
    line_start = content.rfind("\n", max(0, pos - 200), pos)
    line_end = content.find("\n", pos, min(len(content), pos + 200))
    if line_start == -1:
        line_start = max(0, pos - 200)
    if line_end == -1:
        line_end = min(len(content), pos + 200)

    line = content[line_start:line_end].strip()
    return line.startswith("|") and line.endswith("|")


def chunk_text(content: str, max_chars: int | None = None, context_length: int = 200_000) -> list[str]:
    """Split long document content into overlapping chunks with structure-aware breaks.

    If max_chars is None, calculates dynamically from context_length.
    Overlap is 10% of chunk size for context continuity.
    Uses heading/paragraph boundaries to avoid mid-sentence splits.
    """
    if max_chars is None:
        max_chars = calculate_max_chars(context_length)

    if len(content) <= max_chars:
        return [content]

    overlap_chars = max(max_chars // 10, 2_000)  # 10% overlap, min 2k
    chunks = []
    start = 0

    while start < len(content):
        end = start + max_chars
        if end < len(content):
            # Search for structure break in the last 50% of the chunk
            search_start = start + max_chars // 2
            end = _find_structure_break(content, search_start, end)
        chunks.append(content[start:end])
        start = end - overlap_chars
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
                    # Order-independent comparison for dicts
                    if isinstance(item, dict):
                        item_key = json.dumps(item, sort_keys=True, ensure_ascii=False, default=str)
                    else:
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
    use_streaming: bool = True,
) -> tuple[ExtractionResult, dict]:
    """Extract structured data from a single document/chunk via LLM call."""
    user_prompt = EXTRACTION_USER.format(
        filename=doc.filename,
        document_type=doc.doc_type.value,
        page_count=doc.page_count,
        content=doc.content,
    )

    if use_streaming:
        result, usage = await llm.complete_structured_streaming(
            system=EXTRACTION_SYSTEM,
            user=user_prompt,
            response_schema=ExtractionResult,
            model=model,
            thinking="low",
            on_thinking=on_thinking,
        )
    else:
        result, usage = await llm.complete_structured(
            system=EXTRACTION_SYSTEM,
            user=user_prompt,
            response_schema=ExtractionResult,
            model=model,
            thinking="low",
        )
    return result, usage  # type: ignore[return-value]


async def extract_document(
    doc: ParsedDocument,
    llm: LLMClient,
    model: str,
    context_length: int = 200_000,
    on_thinking: Callable[[str], Awaitable[None]] | None = None,
) -> tuple[ExtractionResult, dict]:
    """
    Extract structured data from a single parsed document.
    Returns (ExtractionResult, usage_dict).

    Uses context_length to dynamically calculate chunk size.
    For documents that fit — single-pass extraction (better quality).
    For long documents — splits into overlapping chunks with parallel processing.
    """
    max_chars = calculate_max_chars(context_length)

    logger.info(
        "Extracting document: %s (%d pages, %dk chars, max_chars=%dk, context=%dk)",
        doc.filename,
        doc.page_count,
        len(doc.content) // 1000,
        max_chars // 1000,
        context_length // 1000,
    )

    try:
        chunks = chunk_text(doc.content, max_chars=max_chars)

        if len(chunks) == 1:
            logger.info(
                "Document %s: single-pass extraction (%dk chars, fits in %dk max)",
                doc.filename, len(doc.content) // 1000, max_chars // 1000,
            )
            # Single chunk — direct extraction with retry fallback
            try:
                result, usage = await _extract_single(doc, llm, model, on_thinking=on_thinking)
            except Exception as streaming_exc:
                logger.warning(
                    "Streaming extraction failed for %s, retrying non-streaming: %s",
                    doc.filename, streaming_exc,
                )
                await asyncio.sleep(2)
                result, usage = await _extract_single(
                    doc, llm, model, on_thinking=on_thinking, use_streaming=False,
                )
            logger.info(
                "Extraction complete for %s: in=%d out=%d tokens",
                doc.filename,
                usage.get("input_tokens", 0),
                usage.get("output_tokens", 0),
            )
            return result, usage

        # Multi-chunk: parallel extraction, then merge
        logger.info(
            "Document %s split into %d chunks (%dk chars, max %dk)",
            doc.filename, len(chunks), len(doc.content) // 1000, max_chars // 1000,
        )

        chunk_semaphore = asyncio.Semaphore(3)

        async def _extract_chunk(i: int, chunk: str) -> tuple[ExtractionResult, dict]:
            async with chunk_semaphore:
                chunk_doc = ParsedDocument(
                    filename=f"{doc.filename} (dalis {i + 1}/{len(chunks)})",
                    content=f"Tai yra dalis {i + 1} iš {len(chunks)}.\n\n{chunk}",
                    page_count=doc.page_count,
                    file_size_bytes=doc.file_size_bytes,
                    doc_type=doc.doc_type,
                    token_estimate=len(chunk) // 4,
                )
                try:
                    return await _extract_single(chunk_doc, llm, model, on_thinking=on_thinking)
                except Exception as streaming_exc:
                    logger.warning(
                        "Streaming extraction failed for %s chunk %d, retrying non-streaming: %s",
                        doc.filename, i + 1, streaming_exc,
                    )
                    await asyncio.sleep(2)
                    return await _extract_single(
                        chunk_doc, llm, model, on_thinking=on_thinking, use_streaming=False,
                    )

        chunk_results = await asyncio.gather(
            *[_extract_chunk(i, chunk) for i, chunk in enumerate(chunks)]
        )

        partial_results = []
        total_usage = {"input_tokens": 0, "output_tokens": 0}
        for result, usage in chunk_results:
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
    context_length: int = 200_000,
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

    # Filter out documents with parse errors (content starts with [ERROR])
    extractable_docs: list[tuple[int, ParsedDocument]] = []
    results: list[tuple[int, tuple[ParsedDocument, ExtractionResult, dict]]] = []

    for i, doc in enumerate(docs):
        if doc.content.startswith("[ERROR]"):
            logger.warning("Skipping error document: %s", doc.filename)
            error_result = ExtractionResult(
                confidence_notes=[f"Document skipped (parse failure): {doc.content[:200]}"],
                source_documents=[],
            )
            results.append((i, (doc, error_result, {"input_tokens": 0, "output_tokens": 0})))
            if on_error:
                on_error(i, doc.filename, doc.content[:200])
        else:
            extractable_docs.append((i, doc))

    semaphore = asyncio.Semaphore(max_concurrent)

    async def _extract_one(
        index: int, doc: ParsedDocument
    ) -> tuple[int, tuple[ParsedDocument, ExtractionResult, dict]]:
        async with semaphore:
            if on_started:
                on_started(index, doc.filename)
            try:
                result, usage = await extract_document(doc, llm, model, context_length=context_length, on_thinking=on_thinking)

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

                return (index, (doc, result, usage))

            except Exception as e:
                logger.error("Extraction failed for %s: %s", doc.filename, e)
                if on_error:
                    on_error(index, doc.filename, str(e))
                empty = ExtractionResult(
                    confidence_notes=[f"Extraction failed: {e}"],
                )
                return (index, (doc, empty, {"input_tokens": 0, "output_tokens": 0}))

    tasks = [_extract_one(orig_idx, doc) for orig_idx, doc in extractable_docs]
    extracted = await asyncio.gather(*tasks)
    results.extend(extracted)

    # Sort by original index to preserve document ordering
    results.sort(key=lambda x: x[0])
    return [item for _, item in results]
