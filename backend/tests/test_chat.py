# backend/tests/test_chat.py
# Tests for post-analysis Q&A chat service
# Covers system prompt construction, history truncation, and streaming
# Related: services/chat.py, prompts/chat.py

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.schemas import AggregatedReport, ChatMessage, DocumentType
from app.prompts.chat import CHAT_SYSTEM
from app.services.chat import ChatService, MAX_HISTORY_MESSAGES
from app.services.parser import ParsedDocument


# ── Fixtures ───────────────────────────────────────────────────────────────────


@pytest.fixture
def sample_report() -> AggregatedReport:
    return AggregatedReport(
        project_summary="Test procurement project",
        procurement_type="atviras",
        key_requirements=["Req A", "Req B"],
    )


@pytest.fixture
def sample_documents() -> list[ParsedDocument]:
    return [
        ParsedDocument(
            filename="techninė_specifikacija.pdf",
            content="Techninė specifikacija turinys čia.",
            page_count=5,
            file_size_bytes=10240,
            doc_type=DocumentType.TECHNICAL_SPEC,
            token_estimate=50,
        ),
        ParsedDocument(
            filename="sutartis.docx",
            content="Sutarties sąlygos ir nuostatos.",
            page_count=3,
            file_size_bytes=8192,
            doc_type=DocumentType.CONTRACT,
            token_estimate=40,
        ),
    ]


@pytest.fixture
def sample_history() -> list[ChatMessage]:
    return [
        ChatMessage(role="user", content="Koks pirkimo būdas?"),
        ChatMessage(role="assistant", content="Atviras pirkimas."),
    ]


@pytest.fixture
def mock_llm():
    llm = MagicMock()
    llm.complete_streaming = MagicMock()
    return llm


@pytest.fixture
def chat_service(mock_llm) -> ChatService:
    return ChatService(llm=mock_llm)


# ── Helpers ────────────────────────────────────────────────────────────────────


async def async_chunk_generator(chunks: list[str]):
    """Helper that yields chunks as an async iterator."""
    for chunk in chunks:
        yield chunk


# ── Tests ──────────────────────────────────────────────────────────────────────


class TestChatServiceAnswer:
    """Tests for ChatService.answer()."""

    @pytest.mark.asyncio
    async def test_streaming_yields_chunks(
        self, chat_service, mock_llm, sample_report, sample_documents, sample_history
    ):
        """Should yield text chunks from the LLM streaming response."""
        expected_chunks = ["Pagal ", "dokumentus, ", "atsakymas yra..."]
        mock_llm.complete_streaming.return_value = async_chunk_generator(expected_chunks)

        result_chunks = []
        async for chunk in chat_service.answer(
            question="Koks terminas?",
            report=sample_report,
            documents=sample_documents,
            history=sample_history,
            model="anthropic/claude-sonnet-4",
        ):
            result_chunks.append(chunk)

        assert result_chunks == expected_chunks

    @pytest.mark.asyncio
    async def test_system_prompt_includes_report(
        self, chat_service, mock_llm, sample_report, sample_documents, sample_history
    ):
        """System prompt should contain the serialized report JSON."""
        mock_llm.complete_streaming.return_value = async_chunk_generator(["ok"])

        async for _ in chat_service.answer(
            question="Test?",
            report=sample_report,
            documents=sample_documents,
            history=sample_history,
            model="test-model",
        ):
            pass

        call_kwargs = mock_llm.complete_streaming.call_args
        system_prompt = call_kwargs.kwargs.get("system") or call_kwargs[1].get("system")

        # Report JSON should be in system prompt
        assert "Test procurement project" in system_prompt
        assert '"procurement_type": "atviras"' in system_prompt

    @pytest.mark.asyncio
    async def test_system_prompt_includes_documents(
        self, chat_service, mock_llm, sample_report, sample_documents, sample_history
    ):
        """System prompt should contain all document contents with headers."""
        mock_llm.complete_streaming.return_value = async_chunk_generator(["ok"])

        async for _ in chat_service.answer(
            question="Test?",
            report=sample_report,
            documents=sample_documents,
            history=sample_history,
            model="test-model",
        ):
            pass

        call_kwargs = mock_llm.complete_streaming.call_args
        system_prompt = call_kwargs.kwargs.get("system") or call_kwargs[1].get("system")

        # Document headers
        assert "### techninė_specifikacija.pdf (5 psl.)" in system_prompt
        assert "### sutartis.docx (3 psl.)" in system_prompt
        # Document content
        assert "Techninė specifikacija turinys čia." in system_prompt
        assert "Sutarties sąlygos ir nuostatos." in system_prompt
        # Separators
        assert "---" in system_prompt

    @pytest.mark.asyncio
    async def test_messages_include_history_and_question(
        self, chat_service, mock_llm, sample_report, sample_documents, sample_history
    ):
        """Messages should include history followed by the current question."""
        mock_llm.complete_streaming.return_value = async_chunk_generator(["ok"])

        async for _ in chat_service.answer(
            question="Naujas klausimas?",
            report=sample_report,
            documents=sample_documents,
            history=sample_history,
            model="test-model",
        ):
            pass

        call_kwargs = mock_llm.complete_streaming.call_args
        messages = call_kwargs.kwargs.get("messages") or call_kwargs[1].get("messages")

        # History messages + current question
        assert len(messages) == 3
        assert messages[0] == {"role": "user", "content": "Koks pirkimo būdas?"}
        assert messages[1] == {"role": "assistant", "content": "Atviras pirkimas."}
        assert messages[2] == {"role": "user", "content": "Naujas klausimas?"}

    @pytest.mark.asyncio
    async def test_history_truncation(
        self, chat_service, mock_llm, sample_report, sample_documents
    ):
        """History exceeding MAX_HISTORY_MESSAGES should be truncated to the last N."""
        # Create 30 history messages (exceeds MAX_HISTORY_MESSAGES=20)
        long_history = []
        for i in range(30):
            role = "user" if i % 2 == 0 else "assistant"
            long_history.append(ChatMessage(role=role, content=f"Message {i}"))

        mock_llm.complete_streaming.return_value = async_chunk_generator(["ok"])

        async for _ in chat_service.answer(
            question="Final question?",
            report=sample_report,
            documents=sample_documents,
            history=long_history,
            model="test-model",
        ):
            pass

        call_kwargs = mock_llm.complete_streaming.call_args
        messages = call_kwargs.kwargs.get("messages") or call_kwargs[1].get("messages")

        # MAX_HISTORY_MESSAGES (20) from history + 1 current question = 21
        assert len(messages) == MAX_HISTORY_MESSAGES + 1
        # First kept message should be Message 10 (index 30-20=10)
        assert messages[0]["content"] == "Message 10"
        # Last message should be the current question
        assert messages[-1] == {"role": "user", "content": "Final question?"}

    @pytest.mark.asyncio
    async def test_empty_history(
        self, chat_service, mock_llm, sample_report, sample_documents
    ):
        """Should work with empty history — only the current question."""
        mock_llm.complete_streaming.return_value = async_chunk_generator(["ok"])

        async for _ in chat_service.answer(
            question="First question?",
            report=sample_report,
            documents=sample_documents,
            history=[],
            model="test-model",
        ):
            pass

        call_kwargs = mock_llm.complete_streaming.call_args
        messages = call_kwargs.kwargs.get("messages") or call_kwargs[1].get("messages")

        assert len(messages) == 1
        assert messages[0] == {"role": "user", "content": "First question?"}

    @pytest.mark.asyncio
    async def test_empty_documents(
        self, chat_service, mock_llm, sample_report, sample_history
    ):
        """Should work with no documents — system prompt has empty documents section."""
        mock_llm.complete_streaming.return_value = async_chunk_generator(["ok"])

        async for _ in chat_service.answer(
            question="Test?",
            report=sample_report,
            documents=[],
            history=sample_history,
            model="test-model",
        ):
            pass

        call_kwargs = mock_llm.complete_streaming.call_args
        system_prompt = call_kwargs.kwargs.get("system") or call_kwargs[1].get("system")

        # Documents section should be empty but prompt should still be valid
        assert "Šaltinių dokumentai:" in system_prompt

    @pytest.mark.asyncio
    async def test_llm_called_with_correct_params(
        self, chat_service, mock_llm, sample_report, sample_documents, sample_history
    ):
        """Should call LLM with the correct model and thinking level."""
        mock_llm.complete_streaming.return_value = async_chunk_generator(["ok"])

        async for _ in chat_service.answer(
            question="Test?",
            report=sample_report,
            documents=sample_documents,
            history=sample_history,
            model="google/gemini-2.5-pro",
        ):
            pass

        call_kwargs = mock_llm.complete_streaming.call_args
        assert call_kwargs.kwargs.get("model") or call_kwargs[1].get("model") == "google/gemini-2.5-pro"
        assert call_kwargs.kwargs.get("thinking") or call_kwargs[1].get("thinking") == "medium"

    @pytest.mark.asyncio
    async def test_system_prompt_uses_chat_template(
        self, chat_service, mock_llm, sample_report, sample_documents, sample_history
    ):
        """System prompt should be based on the CHAT_SYSTEM template."""
        mock_llm.complete_streaming.return_value = async_chunk_generator(["ok"])

        async for _ in chat_service.answer(
            question="Test?",
            report=sample_report,
            documents=sample_documents,
            history=sample_history,
            model="test-model",
        ):
            pass

        call_kwargs = mock_llm.complete_streaming.call_args
        system_prompt = call_kwargs.kwargs.get("system") or call_kwargs[1].get("system")

        # Should contain the template's static text
        assert "viešųjų pirkimų konsultantas" in system_prompt
        assert "Analizės ataskaita:" in system_prompt
        assert "Šaltinių dokumentai:" in system_prompt


class TestMaxHistoryConstant:
    """Tests for the MAX_HISTORY_MESSAGES constant."""

    def test_max_history_value(self):
        """MAX_HISTORY_MESSAGES should be 20."""
        assert MAX_HISTORY_MESSAGES == 20
