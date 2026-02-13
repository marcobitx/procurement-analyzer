# backend/app/services/llm.py
# OpenRouter API client for structured and streaming LLM completions
# Handles retries, structured JSON output, and model listing
# Related: config.py, models/schemas.py

import asyncio
import json
import logging
from typing import AsyncIterator, Optional

import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)

OPENROUTER_BASE = "https://openrouter.ai/api/v1"

THINKING_BUDGETS = {
    "off": 0,
    "low": 2000,
    "medium": 5000,
    "high": 10000,
}

MAX_RETRIES = 3
BACKOFF_SECONDS = [2, 4, 8]


class LLMError(Exception):
    """Base exception for LLM client errors."""

    def __init__(self, message: str, status_code: int | None = None, body: str | None = None):
        self.status_code = status_code
        self.body = body
        super().__init__(message)


class LLMRateLimitError(LLMError):
    """Raised on HTTP 429 — rate limited."""
    pass


class LLMServerError(LLMError):
    """Raised on HTTP 5xx — server-side error."""
    pass


class LLMParseError(LLMError):
    """Raised when structured output cannot be parsed."""
    pass


def _build_thinking(thinking: str) -> dict | None:
    """Return the thinking config dict or None if disabled."""
    budget = THINKING_BUDGETS.get(thinking, 0)
    if budget <= 0:
        return None
    return {"type": "enabled", "budget_tokens": budget}


def _extract_usage(data: dict) -> dict:
    """Extract token usage from an OpenRouter response body."""
    usage = data.get("usage", {})
    return {
        "input_tokens": usage.get("prompt_tokens", 0),
        "output_tokens": usage.get("completion_tokens", 0),
    }


def _clean_json_schema(schema: dict) -> dict:
    """
    Recursively remove unsupported keys from a JSON schema for OpenRouter strict mode.
    Removes 'title', 'default', and '$defs'/'definitions' at the top level are kept
    but titles inside are stripped.
    """
    cleaned: dict = {}
    for key, value in schema.items():
        if key in ("title",):
            continue
        if isinstance(value, dict):
            cleaned[key] = _clean_json_schema(value)
        elif isinstance(value, list):
            cleaned[key] = [
                _clean_json_schema(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            cleaned[key] = value
    return cleaned


class LLMClient:
    def __init__(self, api_key: str, default_model: str = "anthropic/claude-sonnet-4"):
        self.api_key = api_key
        self.default_model = default_model
        self._client = httpx.AsyncClient(
            base_url=OPENROUTER_BASE,
            headers={
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "https://procurement-analyzer.app",
                "X-Title": "Procurement Analyzer",
            },
            timeout=httpx.Timeout(120.0, connect=10.0),
        )

    # ── Internal helpers ───────────────────────────────────────────────────

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        **kwargs,
    ) -> httpx.Response:
        """
        Execute an HTTP request with retry logic.
        Retries up to MAX_RETRIES times on 429 / 5xx with exponential backoff.
        """
        last_exc: Exception | None = None

        for attempt in range(MAX_RETRIES):
            try:
                response = await self._client.request(method, url, **kwargs)

                if response.status_code == 429:
                    body = response.text
                    logger.warning(
                        "Rate limited (429) on attempt %d/%d: %s",
                        attempt + 1, MAX_RETRIES, body[:200],
                    )
                    last_exc = LLMRateLimitError(
                        f"Rate limited: {body[:200]}",
                        status_code=429,
                        body=body,
                    )
                elif response.status_code >= 500:
                    body = response.text
                    logger.warning(
                        "Server error (%d) on attempt %d/%d: %s",
                        response.status_code, attempt + 1, MAX_RETRIES, body[:200],
                    )
                    last_exc = LLMServerError(
                        f"Server error {response.status_code}: {body[:200]}",
                        status_code=response.status_code,
                        body=body,
                    )
                elif response.status_code >= 400:
                    body = response.text
                    raise LLMError(
                        f"API error {response.status_code}: {body[:500]}",
                        status_code=response.status_code,
                        body=body,
                    )
                else:
                    return response

            except httpx.HTTPError as exc:
                logger.warning(
                    "HTTP transport error on attempt %d/%d: %s",
                    attempt + 1, MAX_RETRIES, exc,
                )
                last_exc = LLMError(f"Transport error: {exc}")

            # Backoff before next attempt (skip sleep after last attempt)
            if attempt < MAX_RETRIES - 1:
                sleep_time = BACKOFF_SECONDS[attempt]
                logger.debug("Sleeping %ds before retry...", sleep_time)
                await asyncio.sleep(sleep_time)

        raise last_exc  # type: ignore[misc]

    def _build_body(
        self,
        messages: list[dict],
        model: str | None,
        thinking: str = "off",
        temperature: float | None = None,
        response_format: dict | None = None,
    ) -> dict:
        """Build the request body for a chat completion."""
        body: dict = {
            "model": model or self.default_model,
            "messages": messages,
        }

        if temperature is not None:
            body["temperature"] = temperature

        if response_format:
            body["response_format"] = response_format

        thinking_cfg = _build_thinking(thinking)
        if thinking_cfg:
            body["thinking"] = thinking_cfg

        return body

    # ── Public API ─────────────────────────────────────────────────────────

    async def complete_structured(
        self,
        system: str,
        user: str,
        response_schema: type[BaseModel],
        model: str | None = None,
        temperature: float = 0.1,
        thinking: str = "off",
    ) -> tuple[BaseModel, dict]:
        """
        Structured output completion. Returns (parsed_model, usage_dict).

        Uses OpenRouter's json_schema response_format with strict: true.
        The schema is derived from response_schema.model_json_schema().

        Usage dict: {"input_tokens": int, "output_tokens": int}

        Retries: 3 attempts on 429/5xx with exponential backoff (2s, 4s, 8s).
        """
        raw_schema = response_schema.model_json_schema()
        cleaned_schema = _clean_json_schema(raw_schema)

        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": response_schema.__name__,
                "schema": cleaned_schema,
            },
        }

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

        body = self._build_body(
            messages=messages,
            model=model,
            thinking=thinking,
            temperature=temperature,
            response_format=response_format,
        )

        logger.debug(
            "Structured completion request: model=%s schema=%s",
            body["model"], response_schema.__name__,
        )

        response = await self._request_with_retry("POST", "/chat/completions", json=body)
        data = response.json()

        logger.debug("Structured completion response status=%d", response.status_code)

        # Extract content from first choice
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            raise LLMParseError(
                f"No content in response: {json.dumps(data)[:300]}"
            ) from exc

        # Parse JSON content into the schema
        try:
            parsed = response_schema.model_validate_json(content)
        except Exception as exc:
            raise LLMParseError(
                f"Failed to parse structured output: {exc}\nContent: {content[:500]}"
            ) from exc

        usage = _extract_usage(data)
        logger.debug("Usage: %s", usage)

        return parsed, usage

    async def complete_text(
        self,
        system: str,
        user: str,
        model: str | None = None,
        thinking: str = "high",
    ) -> tuple[str, dict]:
        """Simple text completion. Returns (text, usage_dict)."""
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

        body = self._build_body(
            messages=messages,
            model=model,
            thinking=thinking,
        )

        logger.debug("Text completion request: model=%s", body["model"])

        response = await self._request_with_retry("POST", "/chat/completions", json=body)
        data = response.json()

        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            raise LLMParseError(
                f"No content in response: {json.dumps(data)[:300]}"
            ) from exc

        usage = _extract_usage(data)
        logger.debug("Text completion usage: %s", usage)

        return content, usage

    async def complete_streaming(
        self,
        system: str,
        messages: list[dict],
        model: str | None = None,
        thinking: str = "medium",
    ) -> AsyncIterator[str]:
        """
        Streaming text response for chat Q&A.
        Yields text chunks as they arrive.
        Uses server-sent events from OpenRouter.
        """
        full_messages = [{"role": "system", "content": system}] + messages

        body = self._build_body(
            messages=full_messages,
            model=model,
            thinking=thinking,
        )
        body["stream"] = True

        logger.debug("Streaming completion request: model=%s", body["model"])

        async with self._client.stream(
            "POST",
            "/chat/completions",
            json=body,
        ) as response:
            if response.status_code != 200:
                body_text = await response.aread()
                raise LLMError(
                    f"Streaming request failed ({response.status_code}): {body_text.decode()[:300]}",
                    status_code=response.status_code,
                    body=body_text.decode(),
                )

            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue

                payload = line[6:].strip()

                if payload == "[DONE]":
                    break

                try:
                    chunk = json.loads(payload)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        yield content
                except (json.JSONDecodeError, IndexError, KeyError) as exc:
                    logger.debug("Skipping unparseable SSE chunk: %s (%s)", payload[:100], exc)
                    continue

    async def list_models(self) -> list[dict]:
        """
        Fetch available models from OpenRouter /api/v1/models.
        Filter to models supporting structured output.
        Return list of ModelInfo-compatible dicts.
        """
        logger.debug("Fetching model list from OpenRouter")

        response = await self._request_with_retry("GET", "/models")
        data = response.json()

        models_raw = data.get("data", [])
        result: list[dict] = []

        for m in models_raw:
            # Filter: only models that support structured output
            supported_params = m.get("supported_parameters", [])
            if supported_params and "json_schema" not in supported_params:
                continue

            pricing = m.get("pricing", {})
            try:
                prompt_price = float(pricing.get("prompt", "0"))
                completion_price = float(pricing.get("completion", "0"))
            except (ValueError, TypeError):
                prompt_price = 0.0
                completion_price = 0.0

            result.append({
                "id": m.get("id", ""),
                "name": m.get("name", m.get("id", "")),
                "context_length": m.get("context_length", 0),
                "pricing_prompt": prompt_price,
                "pricing_completion": completion_price,
            })

        logger.debug("Found %d models supporting structured output", len(result))
        return result

    async def close(self):
        """Close httpx client."""
        await self._client.aclose()
