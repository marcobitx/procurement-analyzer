# backend/app/services/stream_store.py
# In-memory asyncio.Queue store per analysis for ephemeral thinking token streaming
# Bridges pipeline (producer) and SSE endpoint (consumer) without DB persistence
# Related: pipeline.py (producer), routers/analyze.py (consumer)

import asyncio

_streams: dict[str, asyncio.Queue] = {}


def create_stream(analysis_id: str) -> asyncio.Queue:
    """Create and register a new queue for an analysis."""
    q: asyncio.Queue = asyncio.Queue(maxsize=500)
    _streams[analysis_id] = q
    return q


def get_stream(analysis_id: str) -> asyncio.Queue | None:
    """Get the queue for an analysis, or None if not registered."""
    return _streams.get(analysis_id)


def remove_stream(analysis_id: str) -> None:
    """Remove and discard the queue for an analysis."""
    _streams.pop(analysis_id, None)
