# backend/tests/test_extraction.py
# Tests for the per-document extraction service
# Covers: single extraction, parallel extraction, error handling, callbacks

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.schemas import (
    DocumentType,
    ExtractionResult,
    ProcuringOrganization,
    EstimatedValue,
)
from app.services.extraction import extract_all, extract_document
from app.services.llm import LLMClient, LLMError
from app.services.parser import ParsedDocument


# ── Fixtures ───────────────────────────────────────────────────────────────────


def _make_doc(
    filename: str = "tech_spec.pdf",
    content: str = "Techninė specifikacija dokumento turinys...",
    page_count: int = 10,
    doc_type: DocumentType = DocumentType.TECHNICAL_SPEC,
) -> ParsedDocument:
    """Create a test ParsedDocument."""
    return ParsedDocument(
        filename=filename,
        content=content,
        page_count=page_count,
        file_size_bytes=len(content.encode()),
        doc_type=doc_type,
        token_estimate=len(content) // 4,
    )


def _make_extraction_result(**overrides) -> ExtractionResult:
    """Create a test ExtractionResult with optional overrides."""
    defaults = {
        "project_summary": "Testavimo projekto santrauka",
        "procuring_organization": ProcuringOrganization(
            name="Test Org", code="123456789"
        ),
        "procurement_type": "atviras",
        "estimated_value": EstimatedValue(amount=100000.0, currency="EUR"),
        "key_requirements": ["Reikalavimas 1", "Reikalavimas 2"],
        "confidence_notes": [],
    }
    defaults.update(overrides)
    return ExtractionResult(**defaults)


def _make_mock_llm(
    results: list[tuple[ExtractionResult, dict]] | None = None,
    error: Exception | None = None,
) -> LLMClient:
    """Create a mock LLMClient.

    If results is given, complete_structured returns them in sequence.
    If error is given, complete_structured raises it on every call.
    """
    mock = MagicMock(spec=LLMClient)

    if error is not None:
        mock.complete_structured = AsyncMock(side_effect=error)
    elif results is not None:
        mock.complete_structured = AsyncMock(side_effect=results)
    else:
        default_result = _make_extraction_result()
        default_usage = {"input_tokens": 1000, "output_tokens": 500}
        mock.complete_structured = AsyncMock(return_value=(default_result, default_usage))

    return mock


# ── Single Document Extraction ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_extract_document_success():
    """Single document extraction returns ExtractionResult and usage."""
    doc = _make_doc()
    expected_result = _make_extraction_result()
    expected_usage = {"input_tokens": 1200, "output_tokens": 600}
    llm = _make_mock_llm(results=[(expected_result, expected_usage)])

    result, usage = await extract_document(doc, llm, model="test-model")

    assert isinstance(result, ExtractionResult)
    assert result.project_summary == "Testavimo projekto santrauka"
    assert result.procurement_type == "atviras"
    assert result.estimated_value.amount == 100000.0
    assert usage["input_tokens"] == 1200
    assert usage["output_tokens"] == 600

    # Verify LLM was called with correct params
    llm.complete_structured.assert_called_once()
    call_kwargs = llm.complete_structured.call_args
    assert call_kwargs.kwargs["system"] is not None
    assert call_kwargs.kwargs["response_schema"] is ExtractionResult
    assert call_kwargs.kwargs["model"] == "test-model"
    # User prompt should contain the filename
    assert "tech_spec.pdf" in call_kwargs.kwargs["user"]


@pytest.mark.asyncio
async def test_extract_document_formats_prompt_correctly():
    """User prompt is formatted with doc metadata."""
    doc = _make_doc(
        filename="kvalifikacija.docx",
        content="Kvalifikacijos reikalavimai...",
        page_count=5,
        doc_type=DocumentType.QUALIFICATION,
    )
    llm = _make_mock_llm()

    await extract_document(doc, llm, model="test-model")

    user_prompt = llm.complete_structured.call_args.kwargs["user"]
    assert "kvalifikacija.docx" in user_prompt
    assert "qualification" in user_prompt
    assert "5" in user_prompt
    assert "Kvalifikacijos reikalavimai..." in user_prompt


@pytest.mark.asyncio
async def test_extract_document_handles_llm_error():
    """On LLM error, returns empty ExtractionResult with error in confidence_notes."""
    doc = _make_doc()
    llm = _make_mock_llm(error=LLMError("API timeout", status_code=500))

    result, usage = await extract_document(doc, llm, model="test-model")

    assert isinstance(result, ExtractionResult)
    assert result.project_summary is None
    assert len(result.confidence_notes) == 1
    assert "Extraction failed" in result.confidence_notes[0]
    assert "API timeout" in result.confidence_notes[0]
    assert usage == {"input_tokens": 0, "output_tokens": 0}


@pytest.mark.asyncio
async def test_extract_document_handles_generic_exception():
    """On unexpected exception, returns empty ExtractionResult."""
    doc = _make_doc()
    llm = _make_mock_llm(error=RuntimeError("unexpected boom"))

    result, usage = await extract_document(doc, llm, model="test-model")

    assert isinstance(result, ExtractionResult)
    assert "unexpected boom" in result.confidence_notes[0]
    assert usage["input_tokens"] == 0


# ── Parallel Extraction ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_extract_all_parallel_with_three_docs():
    """Parallel extraction processes all docs and returns results in order."""
    docs = [
        _make_doc(filename="doc1.pdf", content="Content 1"),
        _make_doc(filename="doc2.docx", content="Content 2"),
        _make_doc(filename="doc3.pdf", content="Content 3"),
    ]

    results_data = [
        (_make_extraction_result(project_summary=f"Summary {i+1}"), {"input_tokens": 100 * (i + 1), "output_tokens": 50 * (i + 1)})
        for i in range(3)
    ]
    llm = _make_mock_llm(results=results_data)

    results = await extract_all(docs, llm, model="test-model")

    assert len(results) == 3
    for i, (doc, result, usage) in enumerate(results):
        assert doc.filename == f"doc{i+1}.{'pdf' if i != 1 else 'docx'}"
        assert isinstance(result, ExtractionResult)
        assert result.project_summary == f"Summary {i+1}"
        assert usage["input_tokens"] == 100 * (i + 1)


@pytest.mark.asyncio
async def test_extract_all_empty_list():
    """Extracting empty list returns empty list."""
    llm = _make_mock_llm()
    results = await extract_all([], llm, model="test-model")
    assert results == []
    llm.complete_structured.assert_not_called()


@pytest.mark.asyncio
async def test_extract_all_respects_concurrency_limit():
    """Semaphore limits concurrent extractions."""
    active_count = 0
    max_active = 0
    lock = asyncio.Lock()

    async def _mock_complete(**kwargs):
        nonlocal active_count, max_active
        async with lock:
            active_count += 1
            if active_count > max_active:
                max_active = active_count
        # Simulate some work
        await asyncio.sleep(0.05)
        async with lock:
            active_count -= 1
        return (_make_extraction_result(), {"input_tokens": 100, "output_tokens": 50})

    docs = [_make_doc(filename=f"doc{i}.pdf") for i in range(10)]
    llm = MagicMock(spec=LLMClient)
    llm.complete_structured = AsyncMock(side_effect=_mock_complete)

    results = await extract_all(docs, llm, model="test-model", max_concurrent=3)

    assert len(results) == 10
    assert max_active <= 3


# ── Error Handling in Parallel ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_extract_all_partial_failure():
    """One doc failing doesn't crash the batch — others still succeed."""
    docs = [
        _make_doc(filename="good1.pdf"),
        _make_doc(filename="bad.pdf"),
        _make_doc(filename="good2.pdf"),
    ]

    good_result = _make_extraction_result(project_summary="Good result")
    good_usage = {"input_tokens": 500, "output_tokens": 200}

    async def _side_effect(**kwargs):
        user_prompt = kwargs.get("user", "")
        if "bad.pdf" in user_prompt:
            raise LLMError("Model overloaded", status_code=503)
        return (good_result, good_usage)

    llm = MagicMock(spec=LLMClient)
    llm.complete_structured = AsyncMock(side_effect=_side_effect)

    results = await extract_all(docs, llm, model="test-model")

    assert len(results) == 3

    # First doc: success
    _, result0, usage0 = results[0]
    assert result0.project_summary == "Good result"
    assert usage0["input_tokens"] == 500

    # Second doc: failed gracefully
    _, result1, usage1 = results[1]
    assert any("Extraction failed" in note for note in result1.confidence_notes)
    assert usage1["input_tokens"] == 0

    # Third doc: success
    _, result2, usage2 = results[2]
    assert result2.project_summary == "Good result"


# ── Callback Tests ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_callbacks_fire_on_success():
    """on_started and on_completed callbacks fire for successful extractions."""
    doc = _make_doc(filename="callback_test.pdf")
    llm = _make_mock_llm()

    started_calls = []
    completed_calls = []

    def on_started(index, filename):
        started_calls.append((index, filename))

    def on_completed(index, filename, usage):
        completed_calls.append((index, filename, usage))

    results = await extract_all(
        [doc], llm, model="test-model",
        on_started=on_started,
        on_completed=on_completed,
    )

    assert len(results) == 1
    assert started_calls == [(0, "callback_test.pdf")]
    assert len(completed_calls) == 1
    assert completed_calls[0][0] == 0
    assert completed_calls[0][1] == "callback_test.pdf"
    assert "input_tokens" in completed_calls[0][2]


@pytest.mark.asyncio
async def test_callbacks_fire_on_error():
    """on_started and on_error callbacks fire when extraction fails."""
    doc = _make_doc(filename="error_doc.pdf")
    llm = _make_mock_llm(error=LLMError("Boom", status_code=500))

    started_calls = []
    error_calls = []

    def on_started(index, filename):
        started_calls.append((index, filename))

    def on_error(index, filename, error_msg):
        error_calls.append((index, filename, error_msg))

    results = await extract_all(
        [doc], llm, model="test-model",
        on_started=on_started,
        on_error=on_error,
    )

    assert len(results) == 1
    assert started_calls == [(0, "error_doc.pdf")]
    assert len(error_calls) == 1
    assert error_calls[0][0] == 0
    assert error_calls[0][1] == "error_doc.pdf"


@pytest.mark.asyncio
async def test_callbacks_fire_for_all_docs_in_parallel():
    """Callbacks fire for each doc in a parallel batch."""
    docs = [
        _make_doc(filename="a.pdf"),
        _make_doc(filename="b.pdf"),
        _make_doc(filename="c.pdf"),
    ]

    results_data = [
        (_make_extraction_result(), {"input_tokens": 100, "output_tokens": 50})
        for _ in range(3)
    ]
    llm = _make_mock_llm(results=results_data)

    started_calls = []
    completed_calls = []

    def on_started(index, filename):
        started_calls.append((index, filename))

    def on_completed(index, filename, usage):
        completed_calls.append((index, filename))

    results = await extract_all(
        docs, llm, model="test-model",
        on_started=on_started,
        on_completed=on_completed,
    )

    assert len(results) == 3
    # All docs should have started and completed callbacks
    started_filenames = {fn for _, fn in started_calls}
    completed_filenames = {fn for _, fn in completed_calls}
    assert started_filenames == {"a.pdf", "b.pdf", "c.pdf"}
    assert completed_filenames == {"a.pdf", "b.pdf", "c.pdf"}


@pytest.mark.asyncio
async def test_no_callbacks_when_none():
    """Works fine when no callbacks are provided."""
    doc = _make_doc()
    llm = _make_mock_llm()

    results = await extract_all([doc], llm, model="test-model")

    assert len(results) == 1
    assert isinstance(results[0][1], ExtractionResult)
