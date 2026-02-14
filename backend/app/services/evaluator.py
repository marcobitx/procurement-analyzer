# backend/app/services/evaluator.py
# QA completeness checker for aggregated reports
# Scores report quality, identifies missing fields and conflicts
# Related: llm.py, models/schemas.py, prompts/evaluation.py

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Awaitable, Callable

from app.models.schemas import QAEvaluation
from app.prompts.evaluation import EVALUATION_SYSTEM, EVALUATION_USER

if TYPE_CHECKING:
    from app.models.schemas import AggregatedReport, SourceDocument
    from app.services.llm import LLMClient

logger = logging.getLogger(__name__)


async def evaluate_report(
    report: AggregatedReport,
    documents: list[SourceDocument],
    llm: LLMClient,
    model: str,
    on_thinking: Callable[[str], Awaitable[None]] | None = None,
) -> tuple[QAEvaluation, dict]:
    """
    Evaluate report quality and completeness.

    Steps:
    1. Serialize report to JSON
    2. Format document list
    3. Call llm.complete_structured() with EVALUATION_SYSTEM prompt
    4. Use thinking="medium" (faster QA, less accuracy needed)
    5. Return (QAEvaluation, usage_dict)
    """
    logger.info("Evaluating report with %d source documents", len(documents))

    # Serialize report to JSON
    report_json = report.model_dump_json(indent=2, exclude_none=True)

    # Format document list
    doc_lines: list[str] = []
    for idx, doc in enumerate(documents, start=1):
        pages_str = f", {doc.pages} psl." if doc.pages else ""
        doc_lines.append(f"{idx}. {doc.filename} ({doc.type.value}{pages_str})")

    document_list = "\n".join(doc_lines) if doc_lines else "(nėra dokumentų)"

    # Format user prompt
    user_prompt = EVALUATION_USER.format(
        report_json=report_json,
        document_list=document_list,
    )

    logger.debug(
        "Evaluation prompt: %d chars report, %d documents",
        len(report_json),
        len(documents),
    )

    # Call LLM with thinking="medium" — QA is simpler, less accuracy needed
    evaluation, usage = await llm.complete_structured_streaming(
        system=EVALUATION_SYSTEM,
        user=user_prompt,
        response_schema=QAEvaluation,
        model=model,
        thinking="medium",
        on_thinking=on_thinking,
    )

    logger.info(
        "Evaluation complete: score=%.2f, missing=%d, conflicts=%d, suggestions=%d",
        evaluation.completeness_score,
        len(evaluation.missing_fields),
        len(evaluation.conflicts),
        len(evaluation.suggestions),
    )

    return evaluation, usage
