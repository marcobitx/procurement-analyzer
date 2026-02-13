# backend/app/models/schemas.py
# All Pydantic schemas for the procurement analyzer.
# Defines request/response models, LLM structured output schemas, and enums.
# Related: routers/analyze.py, services/extraction.py, services/aggregation.py

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator


# ── Enums ──────────────────────────────────────────────────────────────────────


class AnalysisStatus(str, Enum):
    PENDING = "pending"
    UNPACKING = "unpacking"
    PARSING = "parsing"
    EXTRACTING = "extracting"
    AGGREGATING = "aggregating"
    EVALUATING = "evaluating"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


class ExportFormat(str, Enum):
    PDF = "pdf"
    DOCX = "docx"


class DocumentType(str, Enum):
    TECHNICAL_SPEC = "technical_spec"
    CONTRACT = "contract"
    INVITATION = "invitation"
    QUALIFICATION = "qualification"
    EVALUATION = "evaluation"
    ANNEX = "annex"
    OTHER = "other"


# ── Extraction sub-schemas (used in LLM structured output) ─────────────────────


class ProcuringOrganization(BaseModel):
    name: Optional[str] = Field(None, description="Perkančiosios organizacijos pavadinimas")
    code: Optional[str] = Field(None, description="Įmonės kodas")
    contact: Optional[str] = Field(None, description="Kontaktinė informacija")


class EstimatedValue(BaseModel):
    amount: Optional[float] = Field(None, description="Pirkimo vertė skaičiumi")
    currency: str = Field("EUR", description="Valiuta")
    vat_included: Optional[bool] = Field(None, description="Ar suma su PVM")
    vat_amount: Optional[float] = Field(None, description="PVM suma")


class Deadlines(BaseModel):
    submission_deadline: Optional[str] = Field(
        None, description="Pasiūlymų pateikimo terminas (ISO date)"
    )
    questions_deadline: Optional[str] = Field(
        None, description="Klausimų pateikimo terminas (ISO date)"
    )
    contract_duration: Optional[str] = Field(None, description="Sutarties trukmė")
    execution_deadline: Optional[str] = Field(
        None, description="Darbų atlikimo terminas (ISO date)"
    )


class EvaluationCriterion(BaseModel):
    criterion: str = Field(..., description="Vertinimo kriterijus")
    weight_percent: Optional[float] = Field(None, description="Svoris procentais")
    description: Optional[str] = Field(None, description="Aprašymas")


class QualificationRequirements(BaseModel):
    financial: list[str] = Field(default_factory=list, description="Finansiniai reikalavimai")
    technical: list[str] = Field(default_factory=list, description="Techniniai reikalavimai")
    experience: list[str] = Field(default_factory=list, description="Patirties reikalavimai")
    other: list[str] = Field(default_factory=list, description="Kiti reikalavimai")


class LotInfo(BaseModel):
    lot_number: int
    description: str
    estimated_value: Optional[float] = None


class SourceDocument(BaseModel):
    filename: str
    type: DocumentType = DocumentType.OTHER
    pages: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def _coerce_from_string(cls, v: Any) -> Any:
        """Accept plain filename strings from LLM and wrap into object."""
        if isinstance(v, str):
            return {"filename": v, "type": "other"}
        return v


class ConfidenceNote(BaseModel):
    note: str
    severity: str = Field("info", description="info | warning | conflict")


# ── Main extraction result (per-document and aggregated) ───────────────────────


class ExtractionResult(BaseModel):
    """Schema sent to LLM as structured output target for per-document extraction."""

    project_summary: Optional[str] = Field(
        None, description="2-3 sakiniai apie projekto esmę"
    )
    procuring_organization: Optional[ProcuringOrganization] = None
    procurement_type: Optional[str] = Field(
        None, description="Pirkimo būdas (atviras, ribotas, derybų, etc.)"
    )
    estimated_value: Optional[EstimatedValue] = None
    deadlines: Optional[Deadlines] = None
    key_requirements: list[str] = Field(
        default_factory=list,
        description="Pagrindiniai techniniai/funkciniai reikalavimai",
    )
    qualification_requirements: Optional[QualificationRequirements] = None
    evaluation_criteria: list[EvaluationCriterion] = Field(default_factory=list)
    restrictions_and_prohibitions: list[str] = Field(default_factory=list)
    lot_structure: Optional[list[LotInfo]] = None
    special_conditions: list[str] = Field(default_factory=list)
    source_documents: list[SourceDocument] = Field(default_factory=list)
    confidence_notes: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _coerce_list_fields(cls, values: Any) -> Any:
        """Coerce list fields that the LLM may return as string or None."""
        if isinstance(values, dict):
            list_fields = [
                "confidence_notes",
                "key_requirements",
                "restrictions_and_prohibitions",
                "special_conditions",
            ]
            for field in list_fields:
                v = values.get(field)
                if v is None:
                    values[field] = []
                elif isinstance(v, str):
                    values[field] = [v] if v.strip() else []
        return values


class AggregatedReport(ExtractionResult):
    """Final merged report. Same structure as ExtractionResult with richer data."""

    pass


class QAEvaluation(BaseModel):
    completeness_score: float = Field(..., description="0.0-1.0 completeness score")
    missing_fields: list[str] = Field(
        default_factory=list, description="Fields with no data"
    )
    conflicts: list[str] = Field(
        default_factory=list, description="Detected contradictions"
    )
    suggestions: list[str] = Field(
        default_factory=list, description="Improvement suggestions"
    )


# ── API request / response schemas ────────────────────────────────────────────


class AnalysisCreate(BaseModel):
    model: str = Field(
        "anthropic/claude-sonnet-4", description="OpenRouter model ID"
    )


class AnalysisProgress(BaseModel):
    status: AnalysisStatus
    progress_percent: int = Field(0, ge=0, le=100)
    current_step: Optional[str] = None
    documents_parsed: int = 0
    documents_total: int = 0
    error: Optional[str] = None


class AnalysisSummary(BaseModel):
    id: str
    created_at: datetime
    status: AnalysisStatus
    file_count: int
    project_summary: Optional[str] = None


class AnalysisDetail(BaseModel):
    id: str
    created_at: datetime
    status: AnalysisStatus
    progress: AnalysisProgress
    report: Optional[AggregatedReport] = None
    qa: Optional[QAEvaluation] = None
    documents: list[SourceDocument] = Field(default_factory=list)


class SettingsUpdate(BaseModel):
    openrouter_api_key: Optional[str] = None
    default_model: Optional[str] = None


class SettingsResponse(BaseModel):
    has_api_key: bool
    default_model: str


class ModelInfo(BaseModel):
    id: str
    name: str
    context_length: int
    pricing_prompt: float
    pricing_completion: float


class ModelsResponse(BaseModel):
    models: list[ModelInfo]


# ── Chat schemas ───────────────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    message: str


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str
    timestamp: Optional[datetime] = None
