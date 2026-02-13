# backend/app/config.py
# Application settings loaded from environment variables via Pydantic Settings.
# Centralizes all configuration (API keys, DB URLs, limits, defaults).
# Related: main.py, convex_client.py, routers/

from functools import lru_cache

from pydantic_settings import BaseSettings


class AppSettings(BaseSettings):
    """Global application settings — populated from .env or environment variables."""

    openrouter_api_key: str = ""
    convex_url: str = ""
    default_model: str = "anthropic/claude-sonnet-4"
    allowed_origins: str = "http://localhost:4321"
    max_file_size_mb: int = 50
    max_files: int = 20
    max_concurrent_analyses: int = 5
    temp_dir: str = "/tmp/procurement-analyzer"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> AppSettings:
    """Cached singleton — call this from FastAPI Depends() or at module level."""
    return AppSettings()
