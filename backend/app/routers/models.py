# backend/app/routers/models.py
# LLM model listing and search endpoints — fetches models from OpenRouter
# Allows frontend to populate model selector and search all available models
# Related: services/llm.py, models/schemas.py

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import AppSettings, get_settings
from app.convex_client import ConvexDB, get_db
from app.models.schemas import ModelInfo, ModelsResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["models"])


async def _get_api_key(settings: AppSettings, db: ConvexDB) -> str:
    """Resolve OpenRouter API key from settings or DB."""
    api_key = settings.openrouter_api_key
    if not api_key:
        db_key = await db.get_setting("openrouter_api_key")
        if db_key:
            api_key = db_key
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenRouter API key not configured. Set it in Settings.",
        )
    return api_key


@router.get("/models", response_model=ModelsResponse)
async def list_models(
    settings: AppSettings = Depends(get_settings),
    db: ConvexDB = Depends(get_db),
):
    """Fetch available models from OpenRouter that support structured output."""
    api_key = await _get_api_key(settings, db)

    from app.services.llm import LLMClient

    llm = LLMClient(api_key=api_key, default_model=settings.default_model)
    try:
        raw_models = await llm.list_models()
    except Exception as e:
        logger.error("Failed to fetch models: %s", e, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch models from OpenRouter: {e}",
        )
    finally:
        await llm.close()

    models = [
        ModelInfo(
            id=m["id"],
            name=m["name"],
            context_length=m["context_length"],
            pricing_prompt=m["pricing_prompt"],
            pricing_completion=m["pricing_completion"],
        )
        for m in raw_models
    ]

    return ModelsResponse(models=models)


@router.get("/models/search", response_model=ModelsResponse)
async def search_all_models(
    q: str = Query("", description="Search query to filter models by name or ID"),
    settings: AppSettings = Depends(get_settings),
    db: ConvexDB = Depends(get_db),
):
    """Search ALL OpenRouter models (no structured output filter). Returns top 50 matches."""
    api_key = await _get_api_key(settings, db)

    from app.services.llm import LLMClient

    llm = LLMClient(api_key=api_key, default_model=settings.default_model)
    try:
        raw_models = await llm.list_all_models(query=q)
    except Exception as e:
        logger.error("Failed to search models: %s", e, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"Failed to search models from OpenRouter: {e}",
        )
    finally:
        await llm.close()

    models = [
        ModelInfo(
            id=m["id"],
            name=m["name"],
            context_length=m["context_length"],
            pricing_prompt=m["pricing_prompt"],
            pricing_completion=m["pricing_completion"],
        )
        for m in raw_models
    ]

    return ModelsResponse(models=models)
