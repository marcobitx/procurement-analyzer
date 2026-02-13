# backend/app/convex_client.py
# Database client wrapper with Convex backend and in-memory fallback.
# Provides a unified async interface for all DB operations (analyses,
# documents, chat messages, settings, streaming events).
# Related: config.py, convex/schema.ts, models/schemas.py

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ConvexDB:
    """Database client. Uses Convex when configured, falls back to in-memory store.

    The in-memory store is organised by table name::

        {
            "analyses":      {id: {field: value, ...}, ...},
            "documents":     {id: {field: value, ...}, ...},
            "chat_messages": {id: {field: value, ...}, ...},
            "settings":      {id: {field: value, ...}, ...},
        }

    Every record gets ``_id`` and ``_creationTime`` (ISO-8601 UTC) on insert.
    All public methods are async so callers never need to care which backend
    is active.
    """

    # ------------------------------------------------------------------ #
    #  Construction
    # ------------------------------------------------------------------ #

    def __init__(self, url: str = "") -> None:
        self._client: Any = None  # ConvexClient when available
        self._memory_store: dict[str, dict[str, dict]] = {
            "analyses": {},
            "documents": {},
            "chat_messages": {},
            "settings": {},
        }
        self._lock = asyncio.Lock()  # thread-safety for in-memory store

        if url:
            try:
                from convex import ConvexClient  # type: ignore[import-untyped]

                self._client = ConvexClient(url)
                logger.info("Connected to Convex DB at %s", url)
            except Exception as e:
                logger.warning("Convex unavailable, using in-memory store: %s", e)

    @property
    def is_convex(self) -> bool:
        """``True`` when backed by a live Convex deployment."""
        return self._client is not None

    # ------------------------------------------------------------------ #
    #  Internal helpers (in-memory)
    # ------------------------------------------------------------------ #

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _new_id(self) -> str:
        return str(uuid.uuid4())

    def _table(self, name: str) -> dict[str, dict]:
        if name not in self._memory_store:
            self._memory_store[name] = {}
        return self._memory_store[name]

    # ------------------------------------------------------------------ #
    #  Analyses
    # ------------------------------------------------------------------ #

    async def create_analysis(self, model: str) -> str:
        """Create a new analysis record and return its ID."""
        if self.is_convex:
            try:
                result = self._client.mutation(
                    "analyses:create",
                    {"model": model, "status": "pending"},
                )
                return str(result)
            except Exception as e:
                logger.error("Convex create_analysis failed: %s", e)
                raise

        async with self._lock:
            aid = self._new_id()
            self._table("analyses")[aid] = {
                "_id": aid,
                "_creationTime": self._now_iso(),
                "status": "pending",
                "model": model,
                "report_json": None,
                "qa_json": None,
                "metrics_json": None,
                "events_json": [],
                "error": None,
            }
            return aid

    async def update_analysis(self, analysis_id: str, **kwargs: Any) -> None:
        """Update one or more fields on an analysis record."""
        if self.is_convex:
            try:
                self._client.mutation(
                    "analyses:update",
                    {"id": analysis_id, **kwargs},
                )
                return
            except Exception as e:
                logger.error("Convex update_analysis failed: %s", e)
                raise

        async with self._lock:
            record = self._table("analyses").get(analysis_id)
            if record is None:
                raise KeyError(f"Analysis {analysis_id} not found")
            record.update(kwargs)

    async def get_analysis(self, analysis_id: str) -> Optional[dict]:
        """Return an analysis dict or ``None`` if it doesn't exist."""
        if self.is_convex:
            try:
                return self._client.query(
                    "analyses:get",
                    {"id": analysis_id},
                )
            except Exception as e:
                logger.error("Convex get_analysis failed: %s", e)
                raise

        async with self._lock:
            record = self._table("analyses").get(analysis_id)
            return dict(record) if record is not None else None

    async def list_analyses(self, limit: int = 20, offset: int = 0) -> list[dict]:
        """List analyses sorted by creation time descending."""
        if self.is_convex:
            try:
                return self._client.query(
                    "analyses:list",
                    {"limit": limit, "offset": offset},
                )
            except Exception as e:
                logger.error("Convex list_analyses failed: %s", e)
                raise

        async with self._lock:
            all_records = sorted(
                self._table("analyses").values(),
                key=lambda r: r.get("_creationTime", ""),
                reverse=True,
            )
            page = all_records[offset : offset + limit]
            return [dict(r) for r in page]

    async def delete_analysis(self, analysis_id: str) -> None:
        """Delete analysis **and** cascade-delete its documents + chat messages."""
        if self.is_convex:
            try:
                self._client.mutation(
                    "analyses:remove",
                    {"id": analysis_id},
                )
                return
            except Exception as e:
                logger.error("Convex delete_analysis failed: %s", e)
                raise

        async with self._lock:
            # Remove the analysis itself
            self._table("analyses").pop(analysis_id, None)

            # Cascade: documents belonging to this analysis
            doc_table = self._table("documents")
            doc_ids_to_remove = [
                did
                for did, doc in doc_table.items()
                if doc.get("analysis_id") == analysis_id
            ]
            for did in doc_ids_to_remove:
                doc_table.pop(did, None)

            # Cascade: chat messages belonging to this analysis
            chat_table = self._table("chat_messages")
            chat_ids_to_remove = [
                cid
                for cid, msg in chat_table.items()
                if msg.get("analysis_id") == analysis_id
            ]
            for cid in chat_ids_to_remove:
                chat_table.pop(cid, None)

    # ------------------------------------------------------------------ #
    #  Documents
    # ------------------------------------------------------------------ #

    async def add_document(
        self,
        analysis_id: str,
        filename: str,
        doc_type: str,
        page_count: int = 0,
        content_text: str = "",
        extraction_json: Optional[dict] = None,
    ) -> str:
        """Add a document record linked to *analysis_id*. Returns document ID."""
        if self.is_convex:
            try:
                result = self._client.mutation(
                    "documents:create",
                    {
                        "analysis_id": analysis_id,
                        "filename": filename,
                        "doc_type": doc_type,
                        "page_count": page_count,
                        "content_text": content_text,
                        "extraction_json": extraction_json,
                    },
                )
                return str(result)
            except Exception as e:
                logger.error("Convex add_document failed: %s", e)
                raise

        async with self._lock:
            did = self._new_id()
            self._table("documents")[did] = {
                "_id": did,
                "_creationTime": self._now_iso(),
                "analysis_id": analysis_id,
                "filename": filename,
                "doc_type": doc_type,
                "page_count": page_count,
                "content_text": content_text,
                "extraction_json": extraction_json,
            }
            return did

    async def get_documents(self, analysis_id: str) -> list[dict]:
        """Return all documents for the given analysis, ordered by creation time."""
        if self.is_convex:
            try:
                return self._client.query(
                    "documents:listByAnalysis",
                    {"analysis_id": analysis_id},
                )
            except Exception as e:
                logger.error("Convex get_documents failed: %s", e)
                raise

        async with self._lock:
            docs = [
                dict(d)
                for d in self._table("documents").values()
                if d.get("analysis_id") == analysis_id
            ]
            docs.sort(key=lambda d: d.get("_creationTime", ""))
            return docs

    async def update_document(self, doc_id: str, **kwargs: Any) -> None:
        """Update one or more fields on a document record."""
        if self.is_convex:
            try:
                self._client.mutation(
                    "documents:update",
                    {"id": doc_id, **kwargs},
                )
                return
            except Exception as e:
                logger.error("Convex update_document failed: %s", e)
                raise

        async with self._lock:
            record = self._table("documents").get(doc_id)
            if record is None:
                raise KeyError(f"Document {doc_id} not found")
            record.update(kwargs)

    # ------------------------------------------------------------------ #
    #  Chat Messages
    # ------------------------------------------------------------------ #

    async def add_chat_message(
        self, analysis_id: str, role: str, content: str
    ) -> str:
        """Append a chat message. Returns message ID."""
        if self.is_convex:
            try:
                result = self._client.mutation(
                    "chat:create",
                    {
                        "analysis_id": analysis_id,
                        "role": role,
                        "content": content,
                    },
                )
                return str(result)
            except Exception as e:
                logger.error("Convex add_chat_message failed: %s", e)
                raise

        async with self._lock:
            mid = self._new_id()
            self._table("chat_messages")[mid] = {
                "_id": mid,
                "_creationTime": self._now_iso(),
                "analysis_id": analysis_id,
                "role": role,
                "content": content,
            }
            return mid

    async def get_chat_history(
        self, analysis_id: str, limit: int = 50
    ) -> list[dict]:
        """Return chat messages for an analysis, ordered chronologically."""
        if self.is_convex:
            try:
                return self._client.query(
                    "chat:listByAnalysis",
                    {"analysis_id": analysis_id, "limit": limit},
                )
            except Exception as e:
                logger.error("Convex get_chat_history failed: %s", e)
                raise

        async with self._lock:
            messages = [
                dict(m)
                for m in self._table("chat_messages").values()
                if m.get("analysis_id") == analysis_id
            ]
            messages.sort(key=lambda m: m.get("_creationTime", ""))
            return messages[-limit:]

    # ------------------------------------------------------------------ #
    #  Settings
    # ------------------------------------------------------------------ #

    async def get_setting(self, key: str) -> Optional[str]:
        """Retrieve a setting value by key, or ``None`` if not set."""
        if self.is_convex:
            try:
                result = self._client.query(
                    "settings:get",
                    {"key": key},
                )
                return result.get("value") if result else None
            except Exception as e:
                logger.error("Convex get_setting failed: %s", e)
                raise

        async with self._lock:
            for record in self._table("settings").values():
                if record.get("key") == key:
                    return record.get("value")
            return None

    async def set_setting(self, key: str, value: str) -> None:
        """Create or update a setting value."""
        if self.is_convex:
            try:
                self._client.mutation(
                    "settings:set",
                    {"key": key, "value": value},
                )
                return
            except Exception as e:
                logger.error("Convex set_setting failed: %s", e)
                raise

        async with self._lock:
            settings_table = self._table("settings")
            # Upsert: look for existing key
            for sid, record in settings_table.items():
                if record.get("key") == key:
                    record["value"] = value
                    return
            # Insert new
            sid = self._new_id()
            settings_table[sid] = {
                "_id": sid,
                "_creationTime": self._now_iso(),
                "key": key,
                "value": value,
            }

    # ------------------------------------------------------------------ #
    #  Events (for SSE streaming progress)
    # ------------------------------------------------------------------ #

    async def append_event(self, analysis_id: str, event: dict) -> None:
        """Append a pipeline event to the analysis ``events_json`` list."""
        if self.is_convex:
            try:
                self._client.mutation(
                    "analyses:appendEvent",
                    {"id": analysis_id, "event": event},
                )
                return
            except Exception as e:
                logger.error("Convex append_event failed: %s", e)
                raise

        async with self._lock:
            record = self._table("analyses").get(analysis_id)
            if record is None:
                raise KeyError(f"Analysis {analysis_id} not found")
            if record.get("events_json") is None:
                record["events_json"] = []
            record["events_json"].append(event)

    async def get_events(
        self, analysis_id: str, since_index: int = 0
    ) -> list[dict]:
        """Return events from *since_index* onward (for SSE polling)."""
        if self.is_convex:
            try:
                return self._client.query(
                    "analyses:getEvents",
                    {"id": analysis_id, "sinceIndex": since_index},
                )
            except Exception as e:
                logger.error("Convex get_events failed: %s", e)
                raise

        async with self._lock:
            record = self._table("analyses").get(analysis_id)
            if record is None:
                return []
            events: list[dict] = record.get("events_json") or []
            return list(events[since_index:])


# ------------------------------------------------------------------ #
#  FastAPI Dependency
# ------------------------------------------------------------------ #

_db_instance: Optional[ConvexDB] = None


def get_db() -> ConvexDB:
    """FastAPI dependency — returns the singleton :class:`ConvexDB`.

    On first call, reads ``convex_url`` from :class:`app.config.AppSettings`.
    If the URL is empty the client falls back to in-memory storage automatically.
    """
    global _db_instance
    if _db_instance is None:
        from app.config import AppSettings

        settings = AppSettings()
        _db_instance = ConvexDB(url=settings.convex_url)
    return _db_instance
