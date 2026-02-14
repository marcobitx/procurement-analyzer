# backend/app/config.py
# Application settings loaded from environment variables via Pydantic Settings.
# Centralizes all configuration (API keys, DB URLs, limits, defaults).
# Related: main.py, convex_client.py, routers/

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    """Global application settings — populated from .env or environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    openrouter_api_key: str = ""
    convex_url: str = ""
    default_model: str = "anthropic/claude-sonnet-4"
    allowed_origins: str = "http://localhost:4321"
    max_file_size_mb: int = 50
    max_files: int = 20
    max_concurrent_analyses: int = 5
    temp_dir: str = "/tmp/procurement-analyzer"
    parser_force_backend_text: bool = False
    parser_doc_timeout: int = 120
    parser_max_concurrent: int = 2


@lru_cache
def get_settings() -> AppSettings:
    """Cached singleton — call this from FastAPI Depends() or at module level."""
    return AppSettings()
