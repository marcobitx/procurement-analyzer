# backend/app/services/llm.py
# OpenRouter API client for structured and streaming LLM completions
# Handles retries, structured JSON output, and model listing
# Related: config.py, models/schemas.py

import asyncio
import base64
import json
import logging
import mimetypes
import random
from pathlib import Path
from typing import AsyncIterator, Awaitable, Callable, Optional

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

MANDATORY_MODELS = {
    "moonshotai/kimi-k2.5",
    "z-ai/glm-5",
    "google/gemini-3-flash-preview",
    "openai/gpt-oss-120b",
}


OPENROUTER_MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB — above this, use local OCR

# Image extensions for vision-based multimodal content
_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".tiff", ".webp", ".gif"}


def build_multimodal_content(
    text: str, file_path: Path
) -> tuple[list[dict], list[dict] | None]:
    """Build multimodal content blocks for OpenRouter API.

    PDF → type:"file" + plugins:[{id:"file-parser", pdf:{engine:"native"}}]
    Image → type:"image_url" (no plugins needed)

    Returns (content_parts, plugins_or_none).
    """
    from app.config import get_settings

    file_bytes = file_path.read_bytes()
    b64 = base64.b64encode(file_bytes).decode("ascii")
    ext = file_path.suffix.lower()

    content_parts: list[dict] = [{"type": "text", "text": text}]
    plugins: list[dict] | None = None

    if ext == ".pdf":
        content_parts.append({
            "type": "file",
            "file": {
                "filename": file_path.name,
                "file_data": f"data:application/pdf;base64,{b64}",
            },
        })
        settings = get_settings()
        plugins = [{"id": "file-parser", "pdf": {"engine": settings.ocr_pdf_engine}}]
    elif ext in _IMAGE_EXTS:
        mime = mimetypes.guess_type(file_path.name)[0] or "image/png"
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{b64}"},
        })
    else:
        logger.warning("Unsupported multimodal file type: %s", ext)

    logger.info(
        "Built multimodal content for %s (%dKB, %d parts, plugins=%s)",
        file_path.name,
        len(file_bytes) // 1024,
        len(content_parts),
        plugins is not None,
    )
    return content_parts, plugins


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


def _extract_json(raw: str) -> str:
    """
    Robustly extract JSON from LLM output that may contain:
    - Markdown code fences (```json ... ```)
    - Trailing explanatory text after the JSON
    - Leading text before the JSON
    """
    text = raw.strip()

    # Strip markdown code fences
    if text.startswith("```"):
        first_nl = text.index("\n") if "\n" in text else len(text)
        text = text[first_nl + 1:]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3].rstrip()
        logger.debug("Stripped markdown code fences from structured output")

    # Find the JSON object: first { to its matching }
    start = text.find("{")
    if start == -1:
        return text  # no object found, return as-is and let validation handle it

    depth = 0
    in_string = False
    escape = False
    end = start

    for i in range(start, len(text)):
        c = text[i]
        if escape:
            escape = False
            continue
        if c == "\\":
            escape = True
            continue
        if c == '"' and not escape:
            in_string = not in_string
            continue
        if in_string:
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                end = i
                break

    result = text[start:end + 1]
    if result != text.strip():
        logger.debug("Extracted JSON object (%d chars) from larger output (%d chars)", len(result), len(text))
    return result


def _clean_json_schema(schema: dict) -> dict:
    """
    Recursively clean a JSON schema for OpenRouter / Anthropic strict mode.
    - Removes 'title' and 'description' keys (descriptions bloat the grammar;
      field semantics are conveyed via the system prompt instead)
    - Removes 'default' keys (unsupported by strict mode)
    - Adds 'additionalProperties': false to every object type
      (required by Claude for structured outputs)
    """
    cleaned: dict = {}
    for key, value in schema.items():
        if key in ("title", "description", "default"):
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

    # Anthropic requires additionalProperties: false on all object types
    if cleaned.get("type") == "object" and "additionalProperties" not in cleaned:
        cleaned["additionalProperties"] = False

    return cleaned


def _compact_schema_hint(schema: dict) -> str:
    """Build a compact type-hint string from a JSON schema for Anthropic models.

    Instead of dumping the full schema (3-5KB), produces a concise summary like:
      project_title: str, cpv_codes: list[str], estimated_value: {amount: num, ...}
    This gives the model enough type info without bloating the prompt.
    """
    def _type_str(prop: dict) -> str:
        if "$ref" in prop or "anyOf" in prop or "allOf" in prop or "oneOf" in prop:
            return "object"
        t = prop.get("type", "any")
        if t == "array":
            items = prop.get("items", {})
            inner = items.get("type", "object")
            return f"list[{inner}]"
        return t

    props = schema.get("properties", {})
    if not props:
        return json.dumps(schema, ensure_ascii=False)

    parts = []
    for name, prop in props.items():
        parts.append(f"{name}: {_type_str(prop)}")
    return ", ".join(parts)


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
            timeout=httpx.Timeout(300.0, connect=10.0),
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
                base_sleep = BACKOFF_SECONDS[attempt]
                sleep_time = base_sleep * (1 + random.random() * 0.5)  # 0-50% jitter
                logger.debug("Sleeping %.1fs before retry (base=%ds)...", sleep_time, base_sleep)
                await asyncio.sleep(sleep_time)

        raise last_exc  # type: ignore[misc]

    def _build_body(
        self,
        messages: list[dict],
        model: str | None,
        thinking: str = "off",
        temperature: float | None = None,
        response_format: dict | None = None,
        max_tokens: int = 32000,
        plugins: list[dict] | None = None,
    ) -> dict:
        """Build the request body for a chat completion."""
        body: dict = {
            "model": model or self.default_model,
            "messages": messages,
            "max_tokens": max_tokens,
        }

        if temperature is not None:
            body["temperature"] = temperature

        if response_format:
            body["response_format"] = response_format

        thinking_cfg = _build_thinking(thinking)
        if thinking_cfg:
            body["thinking"] = thinking_cfg

        if plugins:
            body["plugins"] = plugins

        return body

    # ── Public API ─────────────────────────────────────────────────────────

    async def complete_structured(
        self,
        system: str,
        user: str | list[dict],
        response_schema: type[BaseModel],
        model: str | None = None,
        temperature: float = 0.1,
        thinking: str = "off",
        max_tokens: int = 32000,
        plugins: list[dict] | None = None,
        _retry_count: int = 0,
    ) -> tuple[BaseModel, dict]:
        """
        Structured output completion. Returns (parsed_model, usage_dict).

        Uses OpenRouter's json_schema response_format with strict: true.
        The schema is derived from response_schema.model_json_schema().
        user can be a string or a list of content parts (multimodal).

        Usage dict: {"input_tokens": int, "output_tokens": int}

        Retries: 3 attempts on 429/5xx with exponential backoff (2s, 4s, 8s).
        On empty response: up to 3 attempts with jittered backoff.
        On parse failure: one automatic retry asking the LLM to correct its output.
        """
        raw_schema = response_schema.model_json_schema()
        cleaned_schema = _clean_json_schema(raw_schema)

        resolved_model = model or self.default_model
        is_anthropic = resolved_model.startswith("anthropic/")

        if is_anthropic:
            response_format = {"type": "json_object"}
            schema_instruction = (
                f"\n\nRespond with valid JSON object. "
                f"Field types: {_compact_schema_hint(cleaned_schema)}"
            )
            system_with_schema = system + schema_instruction
        else:
            response_format = {
                "type": "json_schema",
                "json_schema": {
                    "name": response_schema.__name__,
                    "schema": cleaned_schema,
                },
            }
            system_with_schema = system

        # Build messages — Anthropic gets cache_control for prompt caching
        if is_anthropic:
            messages = [
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "text",
                            "text": system_with_schema,
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                },
                {"role": "user", "content": user},
            ]
        else:
            messages = [
                {"role": "system", "content": system_with_schema},
                {"role": "user", "content": user},
            ]

        body = self._build_body(
            messages=messages,
            model=model,
            thinking=thinking,
            temperature=temperature,
            response_format=response_format,
            max_tokens=max_tokens,
            plugins=plugins,
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

        # Check for empty content (known OpenRouter issue: cold starts, warm-up)
        if not content or not content.strip():
            if _retry_count < 2:
                wait = (1.5 + random.random() * 1.5) * (_retry_count + 1)  # 1.5-3s, 3-6s
                logger.warning(
                    "Empty response for %s (attempt %d/3), retrying in %.1fs...",
                    response_schema.__name__, _retry_count + 1, wait,
                )
                await asyncio.sleep(wait)
                return await self.complete_structured(
                    system=system, user=user, response_schema=response_schema,
                    model=model, temperature=temperature, thinking=thinking,
                    max_tokens=max_tokens, plugins=plugins,
                    _retry_count=_retry_count + 1,
                )
            raise LLMParseError(
                f"Empty response after 3 attempts for {response_schema.__name__}"
            )

        # Robust JSON extraction — handles markdown fences, trailing text, etc.
        content_clean = _extract_json(content)

        # Parse JSON content into the schema
        try:
            parsed = response_schema.model_validate_json(content_clean)
        except Exception as first_exc:
            # Retry: ask the LLM to convert its non-JSON response to valid JSON
            logger.warning(
                "First parse attempt failed for %s, retrying with correction prompt: %s",
                response_schema.__name__,
                str(first_exc)[:200],
            )
            parsed, correction_usage = await self._retry_with_correction(
                original_content=content,
                response_schema=response_schema,
                cleaned_schema=cleaned_schema,
                model=model,
                first_exc=first_exc,
            )
            # Merge usage from both attempts
            usage = _extract_usage(data)
            usage["input_tokens"] += correction_usage.get("input_tokens", 0)
            usage["output_tokens"] += correction_usage.get("output_tokens", 0)
            return parsed, usage

        usage = _extract_usage(data)
        logger.debug("Usage: %s", usage)

        return parsed, usage

    async def complete_structured_streaming(
        self,
        system: str,
        user: str | list[dict],
        response_schema: type[BaseModel],
        model: str | None = None,
        temperature: float = 0.1,
        thinking: str = "off",
        max_tokens: int = 32000,
        on_thinking: Callable[[str], Awaitable[None]] | None = None,
        plugins: list[dict] | None = None,
    ) -> tuple[BaseModel, dict]:
        """
        Streaming structured output completion with live thinking token callback.

        Same contract as complete_structured() — returns (parsed_model, usage_dict).
        user can be a string or a list of content parts (multimodal).
        Streams the response via SSE, calling on_thinking() for each reasoning chunk.
        Falls back to non-streaming complete_structured() on any streaming error.
        """
        if on_thinking is None:
            return await self.complete_structured(
                system=system, user=user, response_schema=response_schema,
                model=model, temperature=temperature, thinking=thinking,
                max_tokens=max_tokens, plugins=plugins,
            )

        raw_schema = response_schema.model_json_schema()
        cleaned_schema = _clean_json_schema(raw_schema)

        resolved_model = model or self.default_model
        is_anthropic = resolved_model.startswith("anthropic/")

        if is_anthropic:
            response_format = {"type": "json_object"}
            schema_instruction = (
                f"\n\nRespond with valid JSON object. "
                f"Field types: {_compact_schema_hint(cleaned_schema)}"
            )
            system_with_schema = system + schema_instruction
        else:
            response_format = {
                "type": "json_schema",
                "json_schema": {
                    "name": response_schema.__name__,
                    "schema": cleaned_schema,
                },
            }
            system_with_schema = system

        # Build messages — Anthropic gets cache_control for prompt caching
        if is_anthropic:
            messages = [
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "text",
                            "text": system_with_schema,
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                },
                {"role": "user", "content": user},
            ]
        else:
            messages = [
                {"role": "system", "content": system_with_schema},
                {"role": "user", "content": user},
            ]

        body = self._build_body(
            messages=messages,
            model=model,
            thinking=thinking,
            temperature=temperature,
            response_format=response_format,
            max_tokens=max_tokens,
            plugins=plugins,
        )
        body["stream"] = True

        logger.debug(
            "Streaming structured completion: model=%s schema=%s",
            body["model"], response_schema.__name__,
        )

        try:
            full_content = ""
            usage = {"input_tokens": 0, "output_tokens": 0}

            async with self._client.stream(
                "POST", "/chat/completions", json=body,
            ) as response:
                if response.status_code != 200:
                    body_text = await response.aread()
                    logger.warning(
                        "Streaming request failed (%d), falling back to non-streaming",
                        response.status_code,
                    )
                    return await self.complete_structured(
                        system=system, user=user, response_schema=response_schema,
                        model=model, temperature=temperature, thinking=thinking,
                        max_tokens=max_tokens, plugins=plugins,
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

                        # Reasoning / thinking tokens
                        reasoning = (
                            delta.get("reasoning")
                            or delta.get("reasoning_content")
                            or ""
                        )
                        if reasoning and on_thinking:
                            try:
                                await on_thinking(reasoning)
                            except Exception:
                                pass  # never let callback errors kill the stream

                        # Content tokens — accumulate for final parse
                        content = delta.get("content") or ""
                        if content:
                            full_content += content

                        # Usage from final chunk
                        chunk_usage = chunk.get("usage")
                        if chunk_usage:
                            usage["input_tokens"] = chunk_usage.get("prompt_tokens", 0)
                            usage["output_tokens"] = chunk_usage.get("completion_tokens", 0)

                    except (json.JSONDecodeError, IndexError, KeyError) as exc:
                        logger.debug("Skipping unparseable SSE chunk: %s (%s)", payload[:100], exc)
                        continue

            if not full_content or not full_content.strip():
                logger.warning(
                    "No content accumulated from streaming for %s, falling back to non-streaming",
                    response_schema.__name__,
                )
                return await self.complete_structured(
                    system=system, user=user, response_schema=response_schema,
                    model=model, temperature=temperature, thinking=thinking,
                    max_tokens=max_tokens, plugins=plugins,
                )

            # Parse accumulated content
            content_clean = _extract_json(full_content)

            # Check for truncated/incomplete JSON before expensive validation
            try:
                json.loads(content_clean)
            except json.JSONDecodeError as json_err:
                logger.warning(
                    "Streaming returned incomplete JSON for %s (%d chars: %.100s...), "
                    "falling back to non-streaming: %s",
                    response_schema.__name__, len(full_content),
                    full_content, str(json_err)[:100],
                )
                return await self.complete_structured(
                    system=system, user=user, response_schema=response_schema,
                    model=model, temperature=temperature, thinking=thinking,
                    max_tokens=max_tokens, plugins=plugins,
                )

            try:
                parsed = response_schema.model_validate_json(content_clean)
            except Exception as first_exc:
                # JSON is syntactically valid but doesn't match schema — correction may help
                logger.warning(
                    "Streaming parse failed for %s, retrying with correction: %s",
                    response_schema.__name__, str(first_exc)[:200],
                )
                parsed, correction_usage = await self._retry_with_correction(
                    original_content=full_content,
                    response_schema=response_schema,
                    cleaned_schema=cleaned_schema,
                    model=model,
                    first_exc=first_exc,
                )
                usage["input_tokens"] += correction_usage.get("input_tokens", 0)
                usage["output_tokens"] += correction_usage.get("output_tokens", 0)
                return parsed, usage

            logger.debug("Streaming structured usage: %s", usage)
            return parsed, usage

        except Exception as exc:
            logger.warning(
                "Streaming structured completion failed (%s), falling back to non-streaming",
                exc,
            )
            return await self.complete_structured(
                system=system, user=user, response_schema=response_schema,
                model=model, temperature=temperature, thinking=thinking,
                max_tokens=max_tokens, plugins=plugins,
            )

    async def _retry_with_correction(
        self,
        original_content: str,
        response_schema: type[BaseModel],
        cleaned_schema: dict,
        model: str | None,
        first_exc: Exception,
    ) -> tuple[BaseModel, dict]:
        """Retry by asking the LLM to convert invalid output to valid JSON."""
        schema_json = json.dumps(cleaned_schema, indent=2, ensure_ascii=False)

        correction_messages = [
            {
                "role": "system",
                "content": (
                    "Ankstesnis atsakymas nebuvo validus JSON. "
                    "Konvertuok žemiau pateiktą turinį į griežtai validų JSON objektą, "
                    "kuris atitinka nurodytą schemą. "
                    "Atsakyk TIK JSON — be markdown, be paaiškinimų, be papildomo teksto."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Turinys, kurį reikia konvertuoti į JSON:\n\n"
                    f"{original_content[:3000]}\n\n"
                    f"Reikalinga JSON schema:\n{schema_json}\n\n"
                    f"Pateik TIK validų JSON objektą."
                ),
            },
        ]

        resolved_model = model or self.default_model
        is_anthropic = resolved_model.startswith("anthropic/")

        if is_anthropic:
            response_format = {"type": "json_object"}
        else:
            response_format = {
                "type": "json_schema",
                "json_schema": {
                    "name": response_schema.__name__,
                    "schema": cleaned_schema,
                },
            }

        body = self._build_body(
            messages=correction_messages,
            model=model,
            thinking="off",
            temperature=0.0,
            response_format=response_format,
        )

        response = await self._request_with_retry("POST", "/chat/completions", json=body)
        data = response.json()

        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            raise LLMParseError(
                f"No content in correction response: {json.dumps(data)[:300]}"
            ) from exc

        # Fail fast if correction also returned empty
        if not content or not content.strip():
            raise LLMParseError(
                f"Empty correction response for {response_schema.__name__}"
            )

        content_clean = _extract_json(content)

        try:
            parsed = response_schema.model_validate_json(content_clean)
        except Exception as exc:
            raise LLMParseError(
                f"Failed to parse structured output after correction retry: {exc}\n"
                f"Content: {content_clean[:500]}"
            ) from exc

        usage = _extract_usage(data)
        logger.info(
            "Correction retry succeeded for %s", response_schema.__name__
        )
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
            model_id = m.get("id", "")
            # Filter: only models that support structured output OR are in our mandatory list
            supported_params = m.get("supported_parameters", [])
            supports_json = supported_params and "json_schema" in supported_params
            
            if not supports_json and model_id not in MANDATORY_MODELS:
                continue

            pricing = m.get("pricing", {})
            try:
                # OpenRouter returns per-token prices; convert to per-million
                prompt_price = float(pricing.get("prompt", "0")) * 1_000_000
                completion_price = float(pricing.get("completion", "0")) * 1_000_000
            except (ValueError, TypeError):
                prompt_price = 0.0
                completion_price = 0.0

            result.append({
                "id": model_id,
                "name": m.get("name", model_id),
                "context_length": m.get("context_length", 0),
                "pricing_prompt": round(prompt_price, 2),
                "pricing_completion": round(completion_price, 2),
            })

        # Ensure all mandatory models are present (fallback if not in OpenRouter list yet)
        existing_ids = {r["id"] for r in result}
        for mid in MANDATORY_MODELS:
            if mid not in existing_ids:
                name_map = {
                    "moonshotai/kimi-k2.5": "Kimi 2.5",
                    "z-ai/glm-5": "GLM-5",
                    "google/gemini-3-flash-preview": "Gemini 3 Flash",
                    "openai/gpt-oss-120b": "GPT-OSS 120",
                }
                pricing_map = {
                    "moonshotai/kimi-k2.5": (0.45, 2.25),
                    "z-ai/glm-5": (0.80, 2.56),
                    "google/gemini-3-flash-preview": (0.50, 3.00),
                    "openai/gpt-oss-120b": (0.04, 0.19),
                }
                in_p, out_p = pricing_map.get(mid, (0.0, 0.0))
                result.append({
                    "id": mid,
                    "name": name_map.get(mid, mid.split("/")[-1]),
                    "context_length": 128000,
                    "pricing_prompt": in_p,
                    "pricing_completion": out_p,
                })

        # Sort: Mandatory first, then by name
        result.sort(key=lambda x: (x["id"] not in MANDATORY_MODELS, x["name"]))

        logger.debug("Found %d models (including mandatory check)", len(result))
        return result

    async def list_all_models(self, query: str = "") -> list[dict]:
        """
        Fetch ALL models from OpenRouter (no structured-output filter).
        Optionally filter by search query matching name or ID.
        Returns top 50 matches sorted by name.
        """
        logger.debug("Searching all OpenRouter models, query=%r", query)

        response = await self._request_with_retry("GET", "/models")
        data = response.json()

        models_raw = data.get("data", [])
        result: list[dict] = []
        q = query.lower().strip()

        for m in models_raw:
            model_id = m.get("id", "")
            model_name = m.get("name", model_id)

            if q and q not in model_id.lower() and q not in model_name.lower():
                continue

            pricing = m.get("pricing", {})
            try:
                # OpenRouter returns per-token prices; convert to per-million
                prompt_price = float(pricing.get("prompt", "0")) * 1_000_000
                completion_price = float(pricing.get("completion", "0")) * 1_000_000
            except (ValueError, TypeError):
                prompt_price = 0.0
                completion_price = 0.0

            result.append({
                "id": model_id,
                "name": model_name,
                "context_length": m.get("context_length", 0),
                "pricing_prompt": round(prompt_price, 2),
                "pricing_completion": round(completion_price, 2),
            })

        result.sort(key=lambda x: x["name"])
        return result[:50]

    async def close(self):
        """Close httpx client."""
        await self._client.aclose()
