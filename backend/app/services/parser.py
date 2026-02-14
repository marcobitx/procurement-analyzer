# backend/app/services/parser.py
# Document parsing service using Docling
# Converts PDF, DOCX, XLSX, PPTX, images to markdown text
# Related: models/schemas.py, services/zip_extractor.py

import asyncio
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

from app.models.schemas import DocumentType

logger = logging.getLogger(__name__)


@dataclass
class ParsedDocument:
    filename: str
    content: str  # markdown text from Docling
    page_count: int
    file_size_bytes: int
    doc_type: DocumentType
    token_estimate: int  # len(content) // 4 rough estimate


# Lazy-initialized converter singleton (Docling import is heavy)
_converter = None


def _get_converter():
    """Lazily initialize and cache the Docling DocumentConverter.

    Config: OCR off, table mode FAST, timeout from settings,
    force_backend_text from settings, threads matched to CPU cores.
    """
    global _converter
    if _converter is None:
        import os

        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import (
            AcceleratorOptions,
            PdfPipelineOptions,
            TableFormerMode,
            TableStructureOptions,
        )
        from docling.document_converter import (
            DocumentConverter,
            ImageFormatOption,
            PdfFormatOption,
        )

        from app.config import get_settings

        settings = get_settings()
        cpu_threads = os.cpu_count() or 4

        table_opts = TableStructureOptions(mode=TableFormerMode.FAST)
        accel_opts = AcceleratorOptions(num_threads=cpu_threads, device="cpu")

        pdf_opts = PdfPipelineOptions(
            do_ocr=False,
            do_table_structure=True,
            table_structure_options=table_opts,
            document_timeout=settings.parser_doc_timeout,
            force_backend_text=settings.parser_force_backend_text,
            accelerator_options=accel_opts,
        )

        _converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_opts),
                InputFormat.IMAGE: ImageFormatOption(pipeline_options=pdf_opts),
            }
        )

        logger.info(
            "Docling converter initialized: table_mode=fast, timeout=%ds, "
            "force_backend_text=%s, threads=%d",
            settings.parser_doc_timeout,
            settings.parser_force_backend_text,
            cpu_threads,
        )
    return _converter


async def parse_document(file_path: Path, filename: str) -> ParsedDocument:
    """Parse a single document using Docling.

    Converts the file to markdown text, extracts page count,
    classifies document type, and estimates token count.

    If Docling fails, returns a ParsedDocument with the error message
    in the content field.
    """
    try:
        file_size = file_path.stat().st_size
    except (FileNotFoundError, OSError) as e:
        logger.warning("File not found or inaccessible: %s — %s", filename, e)
        error_content = f"[ERROR] File not found: {filename}"
        doc_type = classify_document(filename, "")
        return ParsedDocument(
            filename=filename,
            content=error_content,
            page_count=0,
            file_size_bytes=0,
            doc_type=doc_type,
            token_estimate=len(error_content) // 4,
        )

    file_ext = file_path.suffix.lower()

    try:
        converter = _get_converter()

        # Docling is CPU-bound — run in a thread to avoid blocking the event loop
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, converter.convert, str(file_path))

        # Check conversion status
        from docling.datamodel.base_models import ConversionStatus

        if result.status == ConversionStatus.FAILURE:
            error_msgs = "; ".join(str(e) for e in (result.errors or []))
            error_content = (
                f"[ERROR] Failed to parse {filename}: {error_msgs or 'unknown error'}"
            )
            logger.warning("Docling conversion failed for %s: %s", filename, error_msgs)
            doc_type = classify_document(filename, "")
            return ParsedDocument(
                filename=filename,
                content=error_content,
                page_count=0,
                file_size_bytes=file_size,
                doc_type=doc_type,
                token_estimate=len(error_content) // 4,
            )

        # Export to markdown
        markdown_text = result.document.export_to_markdown()

        # Get page count from Docling metadata, fall back to estimation
        try:
            page_count = result.document.num_pages()
            if page_count == 0:
                page_count = _estimate_pages(markdown_text, file_ext)
        except Exception:
            page_count = _estimate_pages(markdown_text, file_ext)

        # Classify document type
        content_preview = markdown_text[:2000]
        doc_type = classify_document(filename, content_preview)

        # Token estimate (~4 chars per token)
        token_estimate = len(markdown_text) // 4

        logger.info(
            "Parsed %s: %d pages, %d chars, %d est. tokens, type=%s",
            filename,
            page_count,
            len(markdown_text),
            token_estimate,
            doc_type.value,
        )

        return ParsedDocument(
            filename=filename,
            content=markdown_text,
            page_count=page_count,
            file_size_bytes=file_size,
            doc_type=doc_type,
            token_estimate=token_estimate,
        )

    except Exception as exc:
        error_content = f"[ERROR] Failed to parse {filename}: {exc}"
        logger.error("Error parsing %s: %s", filename, exc, exc_info=True)
        doc_type = classify_document(filename, "")
        return ParsedDocument(
            filename=filename,
            content=error_content,
            page_count=0,
            file_size_bytes=file_size,
            doc_type=doc_type,
            token_estimate=len(error_content) // 4,
        )


async def parse_all(
    file_paths: list[tuple[Path, str]],
    on_parsed: Optional[Callable[[ParsedDocument], None]] = None,
    max_concurrent: int | None = None,
) -> list[ParsedDocument]:
    """Parse all documents with bounded concurrency.

    Uses asyncio.Semaphore to limit parallel parsing (CPU-bound work).
    Calls on_parsed callback after each file for SSE streaming progress.
    """
    if not file_paths:
        return []

    if max_concurrent is None:
        from app.config import get_settings

        max_concurrent = get_settings().parser_max_concurrent

    semaphore = asyncio.Semaphore(max_concurrent)

    async def _parse_one(
        index: int, file_path: Path, filename: str
    ) -> tuple[int, ParsedDocument]:
        async with semaphore:
            logger.info(
                "Parsing document %d/%d: %s",
                index + 1,
                len(file_paths),
                filename,
            )
            parsed = await parse_document(file_path, filename)
            if on_parsed is not None:
                on_parsed(parsed)
            return (index, parsed)

    tasks = [_parse_one(i, fp, fn) for i, (fp, fn) in enumerate(file_paths)]
    indexed_results = await asyncio.gather(*tasks)
    indexed_results_sorted = sorted(indexed_results, key=lambda x: x[0])
    results = [doc for _, doc in indexed_results_sorted]

    logger.info(
        "Parsing complete: %d documents, %d total tokens",
        len(results),
        sum(d.token_estimate for d in results),
    )
    return results


# ── Classification rules ──────────────────────────────────────────────────────

# Pattern → DocumentType mapping (order matters — first match wins)
_CLASSIFICATION_RULES: list[tuple[re.Pattern, DocumentType]] = [
    (re.compile(r"technin|specifikacij", re.IGNORECASE), DocumentType.TECHNICAL_SPEC),
    (re.compile(r"sutart", re.IGNORECASE), DocumentType.CONTRACT),
    (re.compile(r"kvietim|skelbim", re.IGNORECASE), DocumentType.INVITATION),
    (re.compile(r"kvalifikacij", re.IGNORECASE), DocumentType.QUALIFICATION),
    (re.compile(r"vertinim|kriterij", re.IGNORECASE), DocumentType.EVALUATION),
    (re.compile(r"pried|forma|šablon|sablon", re.IGNORECASE), DocumentType.ANNEX),
]


def classify_document(filename: str, content_preview: str) -> DocumentType:
    """Classify document type using filename and content heuristics.

    Checks filename first, then falls back to content preview.
    Uses Lithuanian keyword patterns. Case-insensitive.
    """
    # Check filename first
    for pattern, doc_type in _CLASSIFICATION_RULES:
        if pattern.search(filename):
            return doc_type

    # Fall back to content preview
    for pattern, doc_type in _CLASSIFICATION_RULES:
        if pattern.search(content_preview):
            return doc_type

    return DocumentType.OTHER


def _estimate_pages(content: str, file_ext: str) -> int:
    """Estimate page count from content length.

    - ~3000 chars per page for text documents
    - XLSX: 1 page per sheet (estimate from markdown section headers)
    - Minimum 1 page if there's any content
    """
    if not content:
        return 0

    if file_ext in (".xlsx", ".xls"):
        # Count sheet-like sections in markdown (## headers often indicate sheets)
        sheet_markers = len(re.findall(r"^##\s", content, re.MULTILINE))
        return max(sheet_markers, 1)

    # General estimate: ~3000 chars per page
    pages = max(len(content) // 3000, 1)
    return pages
