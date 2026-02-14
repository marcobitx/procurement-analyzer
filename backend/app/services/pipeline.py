# backend/app/services/pipeline.py
# Full analysis pipeline orchestrator with streaming events and metrics
# Ties together: ZIP extraction → parsing → LLM extraction → aggregation → evaluation
# Manages state transitions, emits SSE progress events, tracks metrics
# Related: all other services, convex_client.py, models/schemas.py

import asyncio
import logging
import time
from dataclasses import dataclass
from pathlib import Path

from app.convex_client import ConvexDB
from app.models.schemas import AnalysisStatus, SourceDocument
from app.services.aggregation import aggregate_results
from app.services.evaluator import evaluate_report
from app.services.extraction import extract_all
from app.services.llm import LLMClient
from app.services.parser import ParsedDocument, parse_all
from app.services.stream_store import create_stream, remove_stream
from app.services.zip_extractor import extract_files

logger = logging.getLogger(__name__)


@dataclass
class PipelineMetrics:
    """Tracks token usage, timing, and cost across all pipeline steps."""

    total_files: int = 0
    total_pages: int = 0
    start_time: float = 0.0
    elapsed_seconds: float = 0.0
    tokens_extraction_input: int = 0
    tokens_extraction_output: int = 0
    tokens_aggregation_input: int = 0
    tokens_aggregation_output: int = 0
    tokens_evaluation_input: int = 0
    tokens_evaluation_output: int = 0
    estimated_cost_usd: float = 0.0
    model_used: str = ""

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items()}


class AnalysisPipeline:
    """Orchestrates the full procurement document analysis pipeline.

    Pipeline stages:
        0. UNPACKING  — extract ZIPs → flat file list
        1. PARSING    — parse all documents with Docling
        2. EXTRACTING — per-document LLM extraction (parallel)
        3. AGGREGATING — merge all extractions into one report
        4. EVALUATING — QA completeness check
        5. COMPLETED  — save results

    On any error: status → FAILED, save error + partial metrics.
    Emits granular events (stored in DB, streamed via SSE).
    """

    def __init__(
        self,
        analysis_id: str,
        db: ConvexDB,
        llm: LLMClient,
        model: str,
    ):
        self.analysis_id = analysis_id
        self.db = db
        self.llm = llm
        self.model = model
        self.metrics = PipelineMetrics(model_used=model)
        self._event_index = 0
        self._stream_queue = create_stream(analysis_id)

    async def run(self, upload_paths: list[Path]) -> None:
        """Execute the full analysis pipeline."""
        self.metrics.start_time = time.time()

        # Phase-specific thinking callbacks
        async def extraction_thinking(text: str) -> None:
            await self._push_thinking("extraction", text)

        async def aggregation_thinking(text: str) -> None:
            await self._push_thinking("aggregation", text)

        async def evaluation_thinking(text: str) -> None:
            await self._push_thinking("evaluation", text)

        try:
            # Step 0: Unpack ZIPs → flat file list
            await self._check_cancellation()
            await self._update_status(AnalysisStatus.UNPACKING)
            file_list = await extract_files(upload_paths)
            self.metrics.total_files = len(file_list)

            if not file_list:
                upload_names = [p.name for p in upload_paths]
                raise ValueError(
                    f"No supported files found in uploads. "
                    f"Uploaded files: {upload_names}. "
                    f"This may be caused by corrupt archives or unsupported file formats. "
                    f"Supported formats: PDF, DOCX, XLSX, PPTX, PNG, TIFF, JPG, ZIP, 7z."
                )

            # Step 1: Parse all documents
            await self._check_cancellation()
            await self._update_status(AnalysisStatus.PARSING)
            parsed_docs = await parse_all(
                file_list,
                on_parsed=self._on_file_parsed_sync,
            )
            self.metrics.total_pages = sum(d.page_count for d in parsed_docs)

            # Save parsed docs to DB
            for doc in parsed_docs:
                await self.db.add_document(
                    analysis_id=self.analysis_id,
                    filename=doc.filename,
                    doc_type=doc.doc_type.value,
                    page_count=doc.page_count,
                    content_text=doc.content,
                )

            # Step 2: Extract per-document (parallel with concurrency limit)
            await self._check_cancellation()
            await self._update_status(AnalysisStatus.EXTRACTING)
            extractions = await extract_all(
                docs=parsed_docs,
                llm=self.llm,
                model=self.model,
                on_started=self._on_extraction_started_sync,
                on_completed=self._on_extraction_completed_sync,
                on_thinking=extraction_thinking,
            )
            await self._push_thinking_done()

            # Accumulate extraction token metrics from results
            for _doc, _result, usage in extractions:
                self.metrics.tokens_extraction_input += usage.get("input_tokens", 0)
                self.metrics.tokens_extraction_output += usage.get("output_tokens", 0)

            # Step 3: Aggregate all extractions into one report
            await self._check_cancellation()
            await self._update_status(AnalysisStatus.AGGREGATING)
            await self._emit_event("aggregation_started", {})
            report, agg_usage = await aggregate_results(
                extractions, self.llm, self.model,
                on_thinking=aggregation_thinking,
            )
            await self._push_thinking_done()
            self.metrics.tokens_aggregation_input = agg_usage.get("input_tokens", 0)
            self.metrics.tokens_aggregation_output = agg_usage.get("output_tokens", 0)
            await self._emit_event("aggregation_completed", agg_usage)

            # Step 4: Evaluate report quality
            await self._check_cancellation()
            await self._update_status(AnalysisStatus.EVALUATING)
            await self._emit_event("evaluation_started", {})
            source_docs = [
                SourceDocument(
                    filename=d.filename, type=d.doc_type, pages=d.page_count
                )
                for d in parsed_docs
            ]
            qa, eval_usage = await evaluate_report(
                report, source_docs, self.llm, self.model,
                on_thinking=evaluation_thinking,
            )
            await self._push_thinking_done()
            self.metrics.tokens_evaluation_input = eval_usage.get("input_tokens", 0)
            self.metrics.tokens_evaluation_output = eval_usage.get("output_tokens", 0)
            await self._emit_event("evaluation_completed", eval_usage)

            # Step 5: Save results and mark completed
            self.metrics.elapsed_seconds = time.time() - self.metrics.start_time
            self._calculate_total_cost()

            await self.db.update_analysis(
                self.analysis_id,
                status=AnalysisStatus.COMPLETED.value,
                report_json=report.model_dump(),
                qa_json=qa.model_dump(),
                metrics_json=self.metrics.to_dict(),
            )

            await self._emit_event("metrics_update", self.metrics.to_dict())

        except asyncio.CancelledError:
            logger.info("Pipeline cancelled for %s", self.analysis_id)
            # Status is already updated to CANCELED by API or _check_cancellation
            return

        except Exception as e:
            logger.error(
                "Pipeline failed for %s: %s", self.analysis_id, e, exc_info=True
            )

            self.metrics.elapsed_seconds = time.time() - self.metrics.start_time
            await self.db.update_analysis(
                self.analysis_id,
                status=AnalysisStatus.FAILED.value,
                error=str(e),
                metrics_json=self.metrics.to_dict(),
            )
            await self._emit_event("error", {"message": str(e)})

        finally:
            remove_stream(self.analysis_id)

    # ── Status and event helpers ───────────────────────────────────────────

    async def _update_status(self, status: AnalysisStatus) -> None:
        """Update analysis status in DB."""
        await self.db.update_analysis(self.analysis_id, status=status.value)

    async def _emit_event(self, event_type: str, data: dict) -> None:
        """Append a timestamped event to the DB events list."""
        event = {
            "timestamp": time.time(),
            "event_type": event_type,
            "data": data,
            "index": self._event_index,
        }
        self._event_index += 1
        await self.db.append_event(self.analysis_id, event)

    async def _push_thinking(self, phase: str, text: str) -> None:
        """Push a thinking chunk to the in-memory stream queue."""
        try:
            self._stream_queue.put_nowait({
                "type": "thinking",
                "phase": phase,
                "text": text,
            })
        except asyncio.QueueFull:
            # Drop oldest chunk if full (non-critical ephemeral data)
            try:
                self._stream_queue.get_nowait()
                self._stream_queue.put_nowait({
                    "type": "thinking",
                    "phase": phase,
                    "text": text,
                })
            except asyncio.QueueEmpty:
                pass

    async def _push_thinking_done(self) -> None:
        """Signal that the current thinking phase has ended."""
        try:
            self._stream_queue.put_nowait({"type": "thinking_done"})
        except asyncio.QueueFull:
            pass

    async def _check_cancellation(self):
        """Check if analysis has been canceled in the DB."""
        # We need to fetch the latest status from DB
        record = await self.db.get_analysis(self.analysis_id)
        if record and record.get("status") == AnalysisStatus.CANCELED:
            raise asyncio.CancelledError("Analysis canceled by user")

    # ── Sync callbacks (bridge to async event emission) ────────────────────
    #
    # parse_all and extract_all call callbacks synchronously from within
    # async code. We use asyncio.create_task to schedule DB writes without
    # blocking the caller.

    def _on_file_parsed_sync(self, doc: ParsedDocument) -> None:
        """Sync callback for parse_all — schedules file_parsed event."""
        asyncio.create_task(self._on_file_parsed(doc))

    async def _on_file_parsed(self, doc: ParsedDocument) -> None:
        await self._emit_event(
            "file_parsed",
            {
                "filename": doc.filename,
                "pages": doc.page_count,
                "format": Path(doc.filename).suffix.lstrip("."),
                "size_kb": doc.file_size_bytes // 1024,
                "token_estimate": doc.token_estimate,
            },
        )

    def _on_extraction_started_sync(self, index: int, filename: str) -> None:
        """Sync callback for extract_all — schedules extraction_started event."""
        asyncio.create_task(
            self._emit_event(
                "extraction_started",
                {
                    "filename": filename,
                    "doc_index": index,
                },
            )
        )

    def _on_extraction_completed_sync(
        self, index: int, filename: str, usage: dict
    ) -> None:
        """Sync callback for extract_all — schedules extraction_completed event."""
        asyncio.create_task(
            self._emit_event(
                "extraction_completed",
                {
                    "filename": filename,
                    "tokens_in": usage.get("input_tokens", 0),
                    "tokens_out": usage.get("output_tokens", 0),
                },
            )
        )

    # ── Cost estimation ────────────────────────────────────────────────────

    def _calculate_total_cost(self) -> None:
        """Rough cost estimate based on approximate OpenRouter pricing.

        Uses Claude Sonnet pricing as baseline: $3/M input, $15/M output.
        """
        input_total = (
            self.metrics.tokens_extraction_input
            + self.metrics.tokens_aggregation_input
            + self.metrics.tokens_evaluation_input
        )
        output_total = (
            self.metrics.tokens_extraction_output
            + self.metrics.tokens_aggregation_output
            + self.metrics.tokens_evaluation_output
        )
        self.metrics.estimated_cost_usd = (input_total / 1_000_000 * 3.0) + (
            output_total / 1_000_000 * 15.0
        )
