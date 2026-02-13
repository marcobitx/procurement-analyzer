# backend/app/services/chat.py
# Post-analysis Q&A chat with full document context
# Uses streaming LLM responses with source document citations
# Related: llm.py, prompts/chat.py, models/schemas.py

import logging
from typing import AsyncIterator

from app.models.schemas import AggregatedReport, ChatMessage
from app.prompts.chat import CHAT_SYSTEM
from app.services.llm import LLMClient
from app.services.parser import ParsedDocument

logger = logging.getLogger(__name__)

MAX_HISTORY_MESSAGES = 20


class ChatService:
    def __init__(self, llm: LLMClient):
        self.llm = llm

    async def answer(
        self,
        question: str,
        report: AggregatedReport,
        documents: list[ParsedDocument],
        history: list[ChatMessage],
        model: str,
    ) -> AsyncIterator[str]:
        """
        Streaming Q&A response about a completed analysis.

        System prompt construction:
        1. Format CHAT_SYSTEM with:
           - report_json: report serialized as JSON
           - documents_markdown: all doc contents with headers
             "### {filename} ({page_count} psl.)\\n{content}\\n---"
        2. Build messages list:
           - Last MAX_HISTORY_MESSAGES from history as user/assistant pairs
           - Current question as final user message
        3. Call llm.complete_streaming()
        4. Yield text chunks

        The full context (report + all docs) goes in system prompt.
        History + question go in messages.
        """
        # Build system prompt with full context
        report_json = report.model_dump_json(indent=2)

        docs_markdown = []
        for doc in documents:
            docs_markdown.append(
                f"### {doc.filename} ({doc.page_count} psl.)\n{doc.content}\n---"
            )
        documents_text = "\n\n".join(docs_markdown)

        system = CHAT_SYSTEM.format(
            report_json=report_json,
            documents_markdown=documents_text,
        )

        # Build messages from history + current question
        messages: list[dict] = []
        recent_history = (
            history[-MAX_HISTORY_MESSAGES:]
            if len(history) > MAX_HISTORY_MESSAGES
            else history
        )
        for msg in recent_history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": question})

        # Stream response
        async for chunk in self.llm.complete_streaming(
            system=system,
            messages=messages,
            model=model,
            thinking="medium",
        ):
            yield chunk
