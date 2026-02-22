# backend/app/routers/analyze.py
# Analysis endpoints: upload, status, stream, export, chat, history, delete
# Main API surface for the procurement analysis workflow
# Related: services/pipeline.py, services/chat.py, services/exporter.py

from __future__ import annotations

import asyncio
import json
import logging
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse

from app.config import AppSettings, get_settings
from app.convex_client import ConvexDB, get_db
from app.models.schemas import (
    AggregatedReport,
    AnalysisDetail,
    AnalysisProgress,
    AnalysisStatus,
    AnalysisSummary,
    ChatMessage,
    ChatRequest,
    ExportFormat,
    QAEvaluation,
    SourceDocument,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["analysis"])

# Supported upload extensions (including .zip which gets extracted)
SUPPORTED_EXTENSIONS = {
    ".pdf", ".docx", ".xlsx", ".pptx",
    ".png", ".tiff", ".jpg", ".jpeg",
    ".zip",
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
MAX_FILES = 20


# ── Helpers ────────────────────────────────────────────────────────────────────


def _build_progress(record: dict) -> AnalysisProgress:
    """Build an AnalysisProgress from a DB analysis record."""
    status = record.get("status", "pending")
    events = record.get("events_json") or []
    metrics = record.get("metrics_json") or {}

    # Count parsed / total from events
    docs_parsed = sum(1 for e in events if e.get("event_type") == "file_parsed")
    docs_total = metrics.get("total_files", docs_parsed)

    # Estimate progress percent from status
    analysis_status = {
        "pending": 0,
        "unpacking": 5,
        "parsing": 15,
        "extracting": 40,
        "aggregating": 70,
        "evaluating": 85,
        "completed": 100,
        "failed": 0,
        "canceled": 0,
    }
    progress_pct = analysis_status.get(status, 0)

    # Refine progress during extraction phase based on events
    if status == "extracting" and docs_total > 0:
        extraction_done = sum(
            1 for e in events if e.get("event_type") == "extraction_completed"
        )
        extraction_pct = int(extraction_done / docs_total * 100)
        progress_pct = 40 + int(extraction_pct * 0.30)  # 40% → 70%

    return AnalysisProgress(
        status=AnalysisStatus(status),
        progress_percent=progress_pct,
        current_step=_status_label(status),
        documents_parsed=docs_parsed,
        documents_total=docs_total,
        error=record.get("error"),
    )


def _status_label(status: str) -> str | None:
    """Human-readable label for each status."""
    labels = {
        "pending": "Laukiama...",
        "unpacking": "Išpakuojami ZIP failai...",
        "parsing": "Analizuojami dokumentai...",
        "extracting": "Ištraukiama informacija...",
        "aggregating": "Sujungiami rezultatai...",
        "evaluating": "Vertinama kokybė...",
        "completed": "Analizė užbaigta",
        "failed": "Klaida",
        "canceled": "Atšaukta",
    }
    return labels.get(status)


def _build_detail(record: dict, documents: list[dict]) -> AnalysisDetail:
    """Build an AnalysisDetail response from DB records."""
    report = None
    if record.get("report_json"):
        try:
            report = AggregatedReport.model_validate(record["report_json"])
        except Exception:
            logger.warning("Failed to parse report_json for analysis %s", record["_id"])

    qa = None
    if record.get("qa_json"):
        try:
            qa = QAEvaluation.model_validate(record["qa_json"])
        except Exception:
            logger.warning("Failed to parse qa_json for analysis %s", record["_id"])

    source_docs = []
    for doc in documents:
        source_docs.append(
            SourceDocument(
                filename=doc.get("filename", "unknown"),
                type=doc.get("doc_type", "other"),
                pages=doc.get("page_count"),
            )
        )

    created_at = record.get("_creationTime", datetime.now(timezone.utc).isoformat())
    if isinstance(created_at, (int, float)):
        created_at = datetime.fromtimestamp(created_at / 1000, tz=timezone.utc)
    elif isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at)
        except ValueError:
            created_at = datetime.now(timezone.utc)

    return AnalysisDetail(
        id=record["_id"],
        created_at=created_at,
        status=AnalysisStatus(record.get("status", "pending")),
        progress=_build_progress(record),
        report=report,
        qa=qa,
        documents=source_docs,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────


@router.post("/analyze", response_model=AnalysisDetail, status_code=202)
async def create_analysis(
    files: list[UploadFile],
    model: str = Form("anthropic/claude-sonnet-4"),
    db: ConvexDB = Depends(get_db),
    settings: AppSettings = Depends(get_settings),
):
    """Upload files and start analysis. Returns analysis ID immediately."""

    # ── Validate file count
    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files. Maximum is {MAX_FILES}, got {len(files)}.",
        )

    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    # ── Validate each file
    for f in files:
        # Check extension
        if f.filename:
            ext = Path(f.filename).suffix.lower()
            if ext not in SUPPORTED_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file format: {f.filename}. "
                    f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
                )

        # Check size (read content to get actual size)
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File {f.filename} exceeds {MAX_FILE_SIZE // (1024*1024)}MB limit.",
            )
        # Seek back so we can read again when saving
        await f.seek(0)

    # ── Save files to temp directory
    temp_dir = Path(tempfile.mkdtemp(prefix="procurement_upload_"))
    upload_paths: list[Path] = []

    for f in files:
        if not f.filename:
            continue
        file_path = temp_dir / f.filename
        file_path.parent.mkdir(parents=True, exist_ok=True)
        content = await f.read()
        file_path.write_bytes(content)
        upload_paths.append(file_path)
        logger.info("Saved upload: %s (%d bytes)", f.filename, len(content))

    # ── Create DB record
    analysis_id = await db.create_analysis(model=model)
    logger.info("Created analysis %s with model %s", analysis_id, model)

    # ── Spawn background pipeline task
    async def _run_pipeline():
        try:
            from app.services.llm import LLMClient
            from app.services.pipeline import AnalysisPipeline

            api_key = settings.openrouter_api_key
            # Check if API key is in DB settings
            if not api_key:
                db_key = await db.get_setting("openrouter_api_key")
                if db_key:
                    api_key = db_key

            if not api_key:
                await db.update_analysis(
                    analysis_id,
                    status="failed",
                    error="OpenRouter API key not configured. Set it in Settings.",
                )
                return

            llm = LLMClient(api_key=api_key, default_model=model)
            try:
                pipeline = AnalysisPipeline(
                    analysis_id=analysis_id,
                    db=db,
                    llm=llm,
                    model=model,
                )
                await pipeline.run(upload_paths)
            finally:
                await llm.close()
        except Exception as e:
            logger.error("Pipeline failed for %s: %s", analysis_id, e, exc_info=True)
            try:
                await db.update_analysis(
                    analysis_id,
                    status="failed",
                    error=str(e),
                )
            except Exception:
                logger.error("Failed to update analysis status to failed")

    asyncio.create_task(_run_pipeline())

    # ── Return immediate response
    record = await db.get_analysis(analysis_id)
    if record is None:
        raise HTTPException(status_code=500, detail="Failed to create analysis record")

    return _build_detail(record, [])


@router.get("/analyze/{analysis_id}", response_model=AnalysisDetail)
async def get_analysis(
    analysis_id: str,
    db: ConvexDB = Depends(get_db),
):
    """Get analysis status and results."""
    record = await db.get_analysis(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    documents = await db.get_documents(analysis_id)
    return _build_detail(record, documents)


@router.get("/analyze/{analysis_id}/stream")
async def stream_analysis_progress(
    analysis_id: str,
    db: ConvexDB = Depends(get_db),
):
    """SSE endpoint. Streams progress events until completed/failed."""

    # Verify analysis exists
    record = await db.get_analysis(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    async def event_generator():
        from app.services.stream_store import get_stream, remove_stream

        last_event_index = 0
        last_status = None

        while True:
            try:
                # 1. Drain thinking queue (non-blocking, fast)
                had_thinking = False
                stream_q = get_stream(analysis_id)
                if stream_q:
                    while not stream_q.empty():
                        try:
                            chunk = stream_q.get_nowait()
                            yield {
                                "event": "thinking",
                                "data": json.dumps(chunk),
                            }
                            had_thinking = True
                        except asyncio.QueueEmpty:
                            break

                # 2. Poll DB for durable events (existing logic)
                record = await db.get_analysis(analysis_id)
                if record is None:
                    yield {
                        "event": "error",
                        "data": json.dumps({"error": "Analysis not found"}),
                    }
                    break

                current_status = record.get("status", "pending")

                # Emit new events since last check
                new_events = await db.get_events(analysis_id, since_index=last_event_index)
                for event in new_events:
                    event_type = event.get("event_type", "update")
                    # Flatten: merge event metadata with inner data payload
                    flat = {
                        "event_type": event_type,
                        "timestamp": event.get("timestamp"),
                        "index": event.get("index"),
                        **(event.get("data") or {}),
                    }
                    # Route to SSE event names the frontend listens for
                    if event_type == "metrics_update":
                        sse_name = "metrics"
                    elif event_type == "error":
                        sse_name = "error_event"
                    else:
                        sse_name = "progress"
                    yield {
                        "event": sse_name,
                        "data": json.dumps(flat),
                    }
                    last_event_index += 1

                # Emit status change (uppercase for frontend compatibility)
                if current_status != last_status:
                    progress = _build_progress(record)
                    progress_dict = progress.model_dump()
                    progress_dict["status"] = progress_dict["status"].upper()
                    yield {
                        "event": "status",
                        "data": json.dumps(progress_dict),
                    }
                    last_status = current_status

                # Close on terminal status
                if current_status in ("completed", "failed", "canceled"):
                    # Send final progress (uppercase status)
                    progress = _build_progress(record)
                    progress_dict = progress.model_dump()
                    progress_dict["status"] = progress_dict["status"].upper()
                    yield {
                        "event": "complete",
                        "data": json.dumps(progress_dict),
                    }
                    break

                # 3. Shorter sleep when streaming is active
                if had_thinking:
                    await asyncio.sleep(0.15)
                else:
                    await asyncio.sleep(0.8)

            except asyncio.CancelledError:
                logger.info("SSE stream cancelled for analysis %s", analysis_id)
                break
            except Exception as e:
                logger.error("SSE stream error for %s: %s", analysis_id, e)
                yield {
                    "event": "error",
                    "data": json.dumps({"error": str(e)}),
                }
                break

    return EventSourceResponse(event_generator())


@router.get("/analyze/{analysis_id}/export")
async def export_analysis(
    analysis_id: str,
    format: ExportFormat = Query(ExportFormat.PDF),
    db: ConvexDB = Depends(get_db),
):
    """Export completed analysis as PDF or DOCX."""
    record = await db.get_analysis(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if record.get("status") != "completed":
        raise HTTPException(
            status_code=400,
            detail="Analysis is not completed yet. Cannot export.",
        )

    if not record.get("report_json"):
        raise HTTPException(status_code=400, detail="No report data available")

    report = AggregatedReport.model_validate(record["report_json"])
    qa = QAEvaluation.model_validate(
        record.get("qa_json") or {"completeness_score": 0.0}
    )
    model_used = record.get("model", "")

    from app.services.exporter import export_docx, export_pdf

    if format == ExportFormat.PDF:
        file_path = await export_pdf(report, qa, model_used=model_used)
        media_type = "application/pdf"
        filename = f"procurement_report_{analysis_id[:8]}.pdf"
    else:
        file_path = await export_docx(report, qa, model_used=model_used)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"procurement_report_{analysis_id[:8]}.docx"

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/analyze/{analysis_id}/documents/{filename}/content")
async def get_document_content(
    analysis_id: str,
    filename: str,
    db: ConvexDB = Depends(get_db),
):
    """Return parsed markdown content for a specific document."""
    docs = await db.get_documents(analysis_id)
    for doc in docs:
        if doc.get("filename") == filename:
            return {
                "filename": filename,
                "content": doc.get("content_text", ""),
                "page_count": doc.get("page_count", 0),
                "doc_type": doc.get("doc_type", ""),
            }
    raise HTTPException(status_code=404, detail=f"Document '{filename}' not found")


@router.get("/analyses", response_model=list[AnalysisSummary])
async def list_analyses(
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    db: ConvexDB = Depends(get_db),
):
    """List past analyses, most recent first."""
    records = await db.list_analyses(limit=limit, offset=offset)

    summaries = []
    for record in records:
        created_at = record.get("_creationTime", datetime.now(timezone.utc).isoformat())
        if isinstance(created_at, (int, float)):
            created_at = datetime.fromtimestamp(created_at / 1000, tz=timezone.utc)
        elif isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at)
            except ValueError:
                created_at = datetime.now(timezone.utc)

        # Get file count from metrics or events
        metrics = record.get("metrics_json") or {}
        events = record.get("events_json") or []
        file_count = metrics.get("total_files", 0)
        if file_count == 0:
            file_count = sum(1 for e in events if e.get("event_type") == "file_parsed")

        # Extract rich data from report
        project_title = None
        project_summary = None
        organization_name = None
        estimated_value = None
        currency = "EUR"
        submission_deadline = None
        procurement_type = None
        procurement_reference = None
        report_json = record.get("report_json")
        if report_json and isinstance(report_json, dict):
            project_title = report_json.get("project_title")
            project_summary = report_json.get("project_summary")
            procurement_type = report_json.get("procurement_type")
            procurement_reference = report_json.get("procurement_reference")

            org = report_json.get("procuring_organization")
            if org and isinstance(org, dict):
                organization_name = org.get("name")

            ev = report_json.get("estimated_value")
            if ev and isinstance(ev, dict):
                estimated_value = ev.get("amount")
                currency = ev.get("currency", "EUR")

            deadlines = report_json.get("deadlines")
            if deadlines and isinstance(deadlines, dict):
                submission_deadline = deadlines.get("submission_deadline")

        # QA completeness score
        completeness_score = None
        qa_json = record.get("qa_json")
        if qa_json and isinstance(qa_json, dict):
            completeness_score = qa_json.get("completeness_score")

        # Completed timestamp
        completed_at = None
        completed_ts = record.get("completed_at")
        if completed_ts:
            if isinstance(completed_ts, (int, float)):
                completed_at = datetime.fromtimestamp(completed_ts / 1000, tz=timezone.utc)
            elif isinstance(completed_ts, str):
                try:
                    completed_at = datetime.fromisoformat(completed_ts)
                except ValueError:
                    completed_at = None
            else:
                completed_at = completed_ts

        summaries.append(
            AnalysisSummary(
                id=record["_id"],
                created_at=created_at,
                completed_at=completed_at,
                status=AnalysisStatus(record.get("status", "pending")),
                file_count=file_count,
                model=record.get("model"),
                project_title=project_title,
                project_summary=project_summary,
                organization_name=organization_name,
                estimated_value=estimated_value,
                currency=currency,
                submission_deadline=submission_deadline,
                completeness_score=completeness_score,
                procurement_type=procurement_type,
                procurement_reference=procurement_reference,
            )
        )

    return summaries


@router.post("/analyze/{analysis_id}/chat")
async def chat_with_analysis(
    analysis_id: str,
    body: ChatRequest,
    db: ConvexDB = Depends(get_db),
    settings: AppSettings = Depends(get_settings),
):
    """Chat Q&A about completed analysis. Streaming SSE response."""
    record = await db.get_analysis(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if record.get("status") != "completed":
        raise HTTPException(
            status_code=400,
            detail="Analysis must be completed before chatting.",
        )

    if not record.get("report_json"):
        raise HTTPException(status_code=400, detail="No report data available")

    # Get API key
    api_key = settings.openrouter_api_key
    if not api_key:
        db_key = await db.get_setting("openrouter_api_key")
        if db_key:
            api_key = db_key
    if not api_key:
        raise HTTPException(status_code=400, detail="OpenRouter API key not configured")

    report = AggregatedReport.model_validate(record["report_json"])
    model = record.get("model", settings.default_model)

    # Save user message to DB
    await db.add_chat_message(analysis_id, role="user", content=body.message)

    # Get chat history
    history_records = await db.get_chat_history(analysis_id)
    chat_history = [
        ChatMessage(
            role=h.get("role", "user"),
            content=h.get("content", ""),
            timestamp=None,
        )
        for h in history_records
    ]

    # Build parsed documents from DB documents
    from app.services.parser import ParsedDocument

    db_docs = await db.get_documents(analysis_id)
    parsed_docs = [
        ParsedDocument(
            filename=d.get("filename", "unknown"),
            content=d.get("content_text", ""),
            page_count=d.get("page_count", 0),
            file_size_bytes=0,
            doc_type=d.get("doc_type", "other"),
            token_estimate=len(d.get("content_text", "")) // 4,
        )
        for d in db_docs
    ]

    async def chat_event_generator():
        from app.services.chat import ChatService
        from app.services.llm import LLMClient

        llm = LLMClient(api_key=api_key, default_model=model)
        chat_service = ChatService(llm=llm)
        full_response = ""

        try:
            async for chunk in chat_service.answer(
                question=body.message,
                report=report,
                documents=parsed_docs,
                history=chat_history,
                model=model,
            ):
                full_response += chunk
                yield {
                    "data": json.dumps({"chunk": chunk}),
                }

            # Save assistant response to DB
            await db.add_chat_message(
                analysis_id, role="assistant", content=full_response
            )

            yield {"data": "[DONE]"}
        except Exception as e:
            logger.error("Chat error for %s: %s", analysis_id, e, exc_info=True)
            yield {
                "data": json.dumps({"error": str(e)}),
            }
        finally:
            await llm.close()

    return EventSourceResponse(chat_event_generator())


@router.get("/analyze/{analysis_id}/chat/history", response_model=list[ChatMessage])
async def get_chat_history(
    analysis_id: str,
    db: ConvexDB = Depends(get_db),
):
    """Get chat message history for an analysis."""
    record = await db.get_analysis(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    history_records = await db.get_chat_history(analysis_id)

    messages = []
    for h in history_records:
        ts = h.get("_creationTime")
        if isinstance(ts, (int, float)):
            ts = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
        elif isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts)
            except ValueError:
                ts = None
        messages.append(
            ChatMessage(
                role=h.get("role", "user"),
                content=h.get("content", ""),
                timestamp=ts,
            )
        )

    return messages


@router.delete("/analyze/{analysis_id}", status_code=204)
async def delete_analysis(
    analysis_id: str,
    db: ConvexDB = Depends(get_db),
):
    """Delete analysis and associated data."""
    record = await db.get_analysis(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    await db.delete_analysis(analysis_id)
    logger.info("Deleted analysis %s", analysis_id)


@router.post("/analyze/{analysis_id}/cancel", status_code=204)
async def cancel_analysis(
    analysis_id: str,
    db: ConvexDB = Depends(get_db),
):
    """Cancel a running analysis."""
    record = await db.get_analysis(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if record.get("status") in ("completed", "failed", "canceled"):
        # Already in a terminal state, nothing to do
        return

    await db.update_analysis(analysis_id, status="canceled")
    logger.info("Cancelled analysis %s", analysis_id)
