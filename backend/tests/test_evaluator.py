# backend/tests/test_evaluator.py
# Tests for the QA evaluator service with mocked LLM.
# Covers: complete report evaluation, incomplete report, prompt formatting.

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.schemas import (
    AggregatedReport,
    Deadlines,
    DocumentType,
    EstimatedValue,
    EvaluationCriterion,
    ProcuringOrganization,
    QAEvaluation,
    QualificationRequirements,
    SourceDocument,
)
from app.services.evaluator import evaluate_report


# ── Fixtures ────────────────────────────────────────────────────────────────────


def _make_complete_report() -> AggregatedReport:
    """Create a fully populated report for testing."""
    return AggregatedReport(
        project_summary="Vilniaus miesto IT infrastruktūros modernizavimo pirkimas",
        procuring_organization=ProcuringOrganization(
            name="Vilniaus miesto savivaldybė",
            code="188710061",
            email="pirkimai@vilnius.lt",
        ),
        procurement_type="Atviras konkursas",
        estimated_value=EstimatedValue(
            amount=500000.0,
            currency="EUR",
            vat_included=False,
            vat_amount=105000.0,
        ),
        deadlines=Deadlines(
            submission_deadline="2026-03-15",
            questions_deadline="2026-03-01",
            contract_duration="24 mėnesiai",
            execution_deadline="2028-03-15",
        ),
        key_requirements=[
            "Serverių infrastruktūra",
            "Tinklo įranga",
            "Programinė įranga",
            "Diegimo paslaugos",
        ],
        qualification_requirements=QualificationRequirements(
            financial=["Metinė apyvarta > 1M EUR"],
            technical=["ISO 27001 sertifikatas"],
            experience=["3 panašūs projektai per 5 metus"],
            other=["Teisė verstis veikla"],
        ),
        evaluation_criteria=[
            EvaluationCriterion(criterion="Kaina", weight_percent=60.0, description="Mažiausia kaina"),
            EvaluationCriterion(criterion="Kokybė", weight_percent=40.0, description="Techniniai privalumai"),
        ],
        restrictions_and_prohibitions=["Subrangovų ribojimas iki 30%"],
        special_conditions=["Garantinis laikotarpis 36 mėn."],
        source_documents=[
            SourceDocument(filename="tech_spec.pdf", type=DocumentType.TECHNICAL_SPEC, pages=20),
            SourceDocument(filename="contract.pdf", type=DocumentType.CONTRACT, pages=15),
        ],
        confidence_notes=["Kaina patikslinta pagal techninę specifikaciją"],
    )


def _make_incomplete_report() -> AggregatedReport:
    """Create a report with many None/empty fields."""
    return AggregatedReport(
        project_summary="Kažkoks pirkimas",
        # No organization
        procuring_organization=None,
        # No procurement type
        procurement_type=None,
        # No estimated value
        estimated_value=None,
        # No deadlines
        deadlines=None,
        # Empty requirements
        key_requirements=[],
        # No qualification requirements
        qualification_requirements=None,
        # No evaluation criteria
        evaluation_criteria=[],
        # No restrictions
        restrictions_and_prohibitions=[],
        # No special conditions
        special_conditions=[],
        # Minimal source docs
        source_documents=[
            SourceDocument(filename="unknown.pdf", type=DocumentType.OTHER),
        ],
        confidence_notes=[],
    )


def _make_source_documents() -> list[SourceDocument]:
    """Standard document list for testing."""
    return [
        SourceDocument(filename="tech_spec.pdf", type=DocumentType.TECHNICAL_SPEC, pages=20),
        SourceDocument(filename="contract.pdf", type=DocumentType.CONTRACT, pages=15),
        SourceDocument(filename="invitation.pdf", type=DocumentType.INVITATION, pages=5),
    ]


def _make_mock_llm(evaluation: QAEvaluation, usage: dict | None = None) -> MagicMock:
    """Create a mock LLM client that returns the given evaluation."""
    mock_llm = MagicMock()
    mock_llm.complete_structured = AsyncMock(
        return_value=(evaluation, usage or {"input_tokens": 2000, "output_tokens": 300})
    )
    return mock_llm


# ── Tests ───────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_evaluate_complete_report():
    """A complete report should get a high completeness score."""
    report = _make_complete_report()
    documents = _make_source_documents()

    expected_eval = QAEvaluation(
        completeness_score=0.92,
        missing_fields=[],
        conflicts=[],
        suggestions=["Galima papildyti lot_structure informaciją"],
    )
    mock_llm = _make_mock_llm(expected_eval)

    evaluation, usage = await evaluate_report(report, documents, mock_llm, "anthropic/claude-sonnet-4")

    assert isinstance(evaluation, QAEvaluation)
    assert evaluation.completeness_score == 0.92
    assert len(evaluation.missing_fields) == 0
    assert len(evaluation.conflicts) == 0
    assert len(evaluation.suggestions) == 1
    assert usage["input_tokens"] == 2000
    assert usage["output_tokens"] == 300


@pytest.mark.asyncio
async def test_evaluate_incomplete_report():
    """An incomplete report (many None fields) should get a low score with missing_fields."""
    report = _make_incomplete_report()
    documents = [SourceDocument(filename="unknown.pdf", type=DocumentType.OTHER)]

    expected_eval = QAEvaluation(
        completeness_score=0.15,
        missing_fields=[
            "procuring_organization",
            "procurement_type",
            "estimated_value",
            "deadlines",
            "key_requirements",
            "qualification_requirements",
            "evaluation_criteria",
        ],
        conflicts=[],
        suggestions=[
            "Trūksta pagrindinės perkančiosios organizacijos informacijos",
            "Nėra vertinimo kriterijų",
            "Rekomenduojama papildyti kvalifikacinius reikalavimus",
        ],
    )
    mock_llm = _make_mock_llm(expected_eval)

    evaluation, usage = await evaluate_report(report, documents, mock_llm, "test-model")

    assert isinstance(evaluation, QAEvaluation)
    assert evaluation.completeness_score == 0.15
    assert len(evaluation.missing_fields) == 7
    assert "procuring_organization" in evaluation.missing_fields
    assert "estimated_value" in evaluation.missing_fields
    assert len(evaluation.suggestions) == 3


@pytest.mark.asyncio
async def test_evaluate_uses_medium_thinking():
    """Evaluator should use thinking='medium' for faster QA."""
    report = _make_complete_report()
    documents = _make_source_documents()

    expected_eval = QAEvaluation(completeness_score=0.85)
    mock_llm = _make_mock_llm(expected_eval)

    await evaluate_report(report, documents, mock_llm, "model-x")

    call_kwargs = mock_llm.complete_structured.call_args.kwargs
    assert call_kwargs["thinking"] == "medium"
    assert call_kwargs["response_schema"] is QAEvaluation
    assert call_kwargs["model"] == "model-x"


@pytest.mark.asyncio
async def test_evaluate_prompt_contains_report_json():
    """User prompt should contain the serialized report JSON."""
    report = _make_complete_report()
    documents = _make_source_documents()

    expected_eval = QAEvaluation(completeness_score=0.9)
    mock_llm = _make_mock_llm(expected_eval)

    await evaluate_report(report, documents, mock_llm, "model-x")

    user_prompt = mock_llm.complete_structured.call_args.kwargs["user"]

    # Report JSON should be in the prompt
    assert "Vilniaus miesto IT infrastruktūros" in user_prompt
    assert "188710061" in user_prompt
    assert "500000" in user_prompt

    # Document list should be in the prompt
    assert "tech_spec.pdf" in user_prompt
    assert "contract.pdf" in user_prompt
    assert "invitation.pdf" in user_prompt


@pytest.mark.asyncio
async def test_evaluate_prompt_document_list_format():
    """Document list in the prompt should be numbered with type and pages."""
    report = _make_incomplete_report()
    documents = [
        SourceDocument(filename="spec.pdf", type=DocumentType.TECHNICAL_SPEC, pages=30),
        SourceDocument(filename="form.docx", type=DocumentType.ANNEX),  # no pages
    ]

    expected_eval = QAEvaluation(completeness_score=0.2)
    mock_llm = _make_mock_llm(expected_eval)

    await evaluate_report(report, documents, mock_llm, "model")

    user_prompt = mock_llm.complete_structured.call_args.kwargs["user"]

    # Check numbered format with type and optional pages
    assert "1. spec.pdf (technical_spec, 30 psl.)" in user_prompt
    assert "2. form.docx (annex)" in user_prompt


@pytest.mark.asyncio
async def test_evaluate_empty_documents_list():
    """Evaluation works even with an empty documents list."""
    report = _make_incomplete_report()
    documents: list[SourceDocument] = []

    expected_eval = QAEvaluation(
        completeness_score=0.1,
        missing_fields=["source_documents"],
        suggestions=["Nėra šaltinių dokumentų"],
    )
    mock_llm = _make_mock_llm(expected_eval)

    evaluation, usage = await evaluate_report(report, documents, mock_llm, "model")

    assert evaluation.completeness_score == 0.1

    # Prompt should have the fallback text for no documents
    user_prompt = mock_llm.complete_structured.call_args.kwargs["user"]
    assert "(nėra dokumentų)" in user_prompt
