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
    code: Optional[str] = Field(None, description="Įmonės/įstaigos kodas")
    address: Optional[str] = Field(None, description="Adresas")
    city: Optional[str] = Field(None, description="Miestas")
    country: Optional[str] = Field(None, description="Šalis")
    contact_person: Optional[str] = Field(None, description="Kontaktinis asmuo")
    phone: Optional[str] = Field(None, description="Telefono numeris")
    email: Optional[str] = Field(None, description="El. paštas")
    website: Optional[str] = Field(None, description="Svetainė / profilis CVP IS")
    organization_type: Optional[str] = Field(None, description="Organizacijos tipas (ministerija, savivaldybė, VĮ, AB, etc.)")


class EstimatedValue(BaseModel):
    amount: Optional[float] = Field(None, description="Pirkimo vertė skaičiumi")
    currency: str = Field("EUR", description="Valiuta")
    vat_included: Optional[bool] = Field(None, description="Ar suma su PVM")
    vat_amount: Optional[float] = Field(None, description="PVM suma")


class Deadlines(BaseModel):
    submission_deadline: Optional[str] = Field(
        None, description="Pasiūlymų pateikimo terminas (ISO date arba tekstinis aprašymas)"
    )
    questions_deadline: Optional[str] = Field(
        None, description="Klausimų pateikimo terminas (ISO date arba tekstinis aprašymas)"
    )
    contract_duration: Optional[str] = Field(None, description="Sutarties trukmė (pvz. '24 mėn.')")
    execution_deadline: Optional[str] = Field(
        None, description="Darbų/prekių pristatymo terminas (ISO date arba tekstinis aprašymas)"
    )
    offer_validity: Optional[str] = Field(
        None, description="Pasiūlymo galiojimo terminas (pvz. '90 dienų', '180 dienų')"
    )
    contract_start: Optional[str] = Field(
        None, description="Sutarties įsigaliojimo data/sąlyga"
    )
    extension_options: Optional[str] = Field(
        None, description="Sutarties pratęsimo galimybės ir sąlygos"
    )


class EvaluationCriterion(BaseModel):
    criterion: str = Field(..., description="Vertinimo kriterijus")
    weight_percent: Optional[float] = Field(None, description="Svoris procentais")
    description: Optional[str] = Field(None, description="Aprašymas")


class QualificationRequirements(BaseModel):
    financial: list[str] = Field(default_factory=list, description="Finansiniai/ekonominiai pajėgumo reikalavimai (apyvarta, draudimas, etc.)")
    technical: list[str] = Field(default_factory=list, description="Techniniai ir profesiniai pajėgumo reikalavimai")
    experience: list[str] = Field(default_factory=list, description="Patirties reikalavimai (sutartys, projektai, metai)")
    personnel: list[str] = Field(default_factory=list, description="Reikalavimai personalui/specialistams (kvalifikacija, sertifikatai)")
    exclusion_grounds: list[str] = Field(default_factory=list, description="Pašalinimo pagrindai (VPĮ 46 str., teistumas, mokesčiai, etc.)")
    required_documents: list[str] = Field(default_factory=list, description="Reikalaujami pateikti dokumentai (ESPD, pažymos, sertifikatai)")
    other: list[str] = Field(default_factory=list, description="Kiti kvalifikacijos reikalavimai")


class FinancialTerms(BaseModel):
    payment_terms: Optional[str] = Field(None, description="Mokėjimo sąlygos ir terminai")
    advance_payment: Optional[str] = Field(None, description="Avansinis mokėjimas (dydis, sąlygos)")
    guarantee_requirements: Optional[str] = Field(None, description="Garantijų reikalavimai (pasiūlymo, sutarties vykdymo)")
    guarantee_amount: Optional[str] = Field(None, description="Garantijos dydis (suma arba procentas)")
    penalty_clauses: list[str] = Field(default_factory=list, description="Delspinigiai, baudos, netesybos")
    price_adjustment: Optional[str] = Field(None, description="Kainos keitimo sąlygos (indeksavimas, perskaičiavimas)")
    insurance_requirements: Optional[str] = Field(None, description="Draudimo reikalavimai")
    currency: str = Field("EUR", description="Valiuta")


class SubmissionRequirements(BaseModel):
    submission_method: Optional[str] = Field(None, description="Pateikimo būdas (CVP IS, el. paštu, etc.)")
    submission_language: list[str] = Field(default_factory=list, description="Leidžiamos kalbos")
    required_format: Optional[str] = Field(None, description="Reikalaujamas formatas (elektroninis, popierinis)")
    envelope_system: Optional[str] = Field(None, description="Vokelių sistema (jei taikoma)")
    electronic_catalog: Optional[str] = Field(None, description="Elektroninio katalogo reikalavimai")
    variants_allowed: Optional[bool] = Field(None, description="Ar leidžiami alternatyvūs pasiūlymai")
    joint_bidding: Optional[str] = Field(None, description="Jungtinio pasiūlymo sąlygos")
    subcontracting: Optional[str] = Field(None, description="Subrangos naudojimo sąlygos ir apribojimai")


class RiskFactor(BaseModel):
    risk: str = Field(..., description="Rizikos aprašymas")
    severity: str = Field("medium", description="low | medium | high | critical")
    recommendation: Optional[str] = Field(None, description="Rekomendacija rizikai valdyti")


class TechnicalSpecification(BaseModel):
    description: str = Field(..., description="Techninės specifikacijos punktas")
    mandatory: bool = Field(True, description="Ar privalomas reikalavimas")
    details: Optional[str] = Field(None, description="Papildomi detalės/paaiškinimai")


class LotInfo(BaseModel):
    lot_number: int
    description: str
    estimated_value: Optional[float] = None
    cpv_codes: list[str] = Field(default_factory=list, description="CPV kodai šiai daliai")


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


class SourceReference(BaseModel):
    field: str = Field(..., description="Kuriam laukui ši nuoroda (pvz. 'estimated_value', 'submission_deadline')")
    quote: str = Field(..., description="Tiksli citata iš dokumento (1-3 sakiniai)")
    page: Optional[int] = Field(None, description="Puslapio numeris (jei žinomas)")
    section: Optional[str] = Field(None, description="Dokumento skyriaus pavadinimas")
    filename: Optional[str] = Field(None, description="Šaltinio failo pavadinimas")


# ── Main extraction result (per-document and aggregated) ───────────────────────


class ExtractionResult(BaseModel):
    """Schema sent to LLM as structured output target for per-document extraction."""

    # ── Bendra informacija ──
    project_title: Optional[str] = Field(
        None, description="Trumpas pirkimo pavadinimas (pvz. 'Mokyklos pastato renovacija', 'IT įrangos pirkimas')"
    )
    project_summary: Optional[str] = Field(
        None, description="Išsamus projekto aprašymas: kas perkama, kokiam tikslui, kokia apimtis (5-10 sakinių)"
    )
    procurement_reference: Optional[str] = Field(
        None, description="Pirkimo numeris/identifikatorius (CVP IS, TED, etc.)"
    )
    cpv_codes: list[str] = Field(
        default_factory=list, description="CPV kodai su pavadinimais (pvz. '33141200-2 - Chirurginės adatos')"
    )
    nuts_codes: list[str] = Field(
        default_factory=list, description="NUTS kodai pristatymo vietai"
    )

    # ── Organizacija ir pirkimo būdas ──
    procuring_organization: Optional[ProcuringOrganization] = None
    procurement_type: Optional[str] = Field(
        None, description="Pirkimo būdas (atviras konkursas, ribotas konkursas, derybų procedūra, etc.)"
    )
    procurement_law: Optional[str] = Field(
        None, description="Taikomas teisės aktas (VPĮ, KSPĮ, ES direktyva, etc.)"
    )

    # ── Vertė ir finansai ──
    estimated_value: Optional[EstimatedValue] = None
    financial_terms: Optional[FinancialTerms] = None

    # ── Terminai ──
    deadlines: Optional[Deadlines] = None

    # ── Techninė specifikacija ir reikalavimai ──
    key_requirements: list[str] = Field(
        default_factory=list,
        description="VISI pagrindiniai techniniai/funkciniai reikalavimai — kiekvienas punktas turi būti konkretus",
    )
    technical_specifications: list[TechnicalSpecification] = Field(
        default_factory=list,
        description="Detalūs techninės specifikacijos reikalavimai su privalomumu",
    )

    # ── Kvalifikacija ir vertinimas ──
    qualification_requirements: Optional[QualificationRequirements] = None
    evaluation_criteria: list[EvaluationCriterion] = Field(default_factory=list)

    # ── Pasiūlymo pateikimas ──
    submission_requirements: Optional[SubmissionRequirements] = None

    # ── Sutarties sąlygos ──
    restrictions_and_prohibitions: list[str] = Field(default_factory=list)
    lot_structure: Optional[list[LotInfo]] = None
    special_conditions: list[str] = Field(default_factory=list)

    # ── Rizikos ir rekomendacijos ──
    risk_factors: list[RiskFactor] = Field(
        default_factory=list,
        description="Identifikuotos rizikos tiekėjui (sudėtingi reikalavimai, trumpi terminai, didelės baudos, etc.)"
    )

    # ── Apeliavimas ir ginčai ──
    appeal_procedures: Optional[str] = Field(
        None, description="Apeliavimo/ginčų sprendimo procedūra ir institucija"
    )

    # ── Šaltiniai ──
    source_documents: list[SourceDocument] = Field(default_factory=list)
    confidence_notes: list[str] = Field(default_factory=list)
    source_references: list[SourceReference] = Field(
        default_factory=list,
        description="Šaltinių nuorodos — kiekvienam ištrauktam duomeniui tiksli citata ir vieta dokumente",
    )

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
                "cpv_codes",
                "nuts_codes",
                "source_references",
                "technical_specifications",
                "evaluation_criteria",
                "risk_factors",
                "source_documents",
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
    completed_at: Optional[datetime] = None
    status: AnalysisStatus
    file_count: int
    model: Optional[str] = None
    project_title: Optional[str] = None
    project_summary: Optional[str] = None
    organization_name: Optional[str] = None
    estimated_value: Optional[float] = None
    currency: str = "EUR"
    submission_deadline: Optional[str] = None
    completeness_score: Optional[float] = None
    procurement_type: Optional[str] = None
    procurement_reference: Optional[str] = None


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


# ── User / Auth schemas ───────────────────────────────────────────────────────


class UserActivity(BaseModel):
    id: str
    user_id: str
    action: str  # login, logout, analysis_started, analysis_completed, export, chat
    metadata: Optional[dict] = None
    created_at: datetime


class UserSettings(BaseModel):
    default_model: Optional[str] = None
    theme: str = "system"
    language: str = "lt"
    notifications_enabled: bool = True
    items_per_page: int = 10


class UserSettingsUpdate(BaseModel):
    default_model: Optional[str] = None
    theme: Optional[str] = None
    language: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    items_per_page: Optional[int] = None


class SavedReport(BaseModel):
    id: str
    user_id: str
    analysis_id: str
    title: Optional[str] = None
    notes: Optional[str] = None
    pinned: bool = False
    created_at: datetime


class SavedReportCreate(BaseModel):
    analysis_id: str
    title: Optional[str] = None
    notes: Optional[str] = None


class SavedReportUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    pinned: Optional[bool] = None


class UserStats(BaseModel):
    total_logins: int = 0
    total_analyses: int = 0
    total_exports: int = 0
    last_active: Optional[datetime] = None


class TokenUsageStats(BaseModel):
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_tokens: int = 0
    total_cost_usd: float = 0.0
    total_analyses: int = 0
    total_files_processed: int = 0
    total_pages_processed: int = 0
    by_phase: dict = Field(default_factory=lambda: {
        "extraction": {"input": 0, "output": 0},
        "aggregation": {"input": 0, "output": 0},
        "evaluation": {"input": 0, "output": 0},
    })


# ── Notes schemas ──────────────────────────────────────────────────────────────


class NoteCreate(BaseModel):
    title: str = ""
    content: str = ""
    status: str = Field("idea", description="idea | in_progress | done | archived")
    priority: str = Field("medium", description="low | medium | high")
    tags: list[str] = Field(default_factory=list)
    color: Optional[str] = "default"
    pinned: bool = False
    analysis_id: Optional[str] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    tags: Optional[list[str]] = None
    color: Optional[str] = None
    pinned: Optional[bool] = None
    analysis_id: Optional[str] = None


class NoteBulkAction(BaseModel):
    ids: list[str]


class NoteBulkStatusUpdate(BaseModel):
    ids: list[str]
    status: str
