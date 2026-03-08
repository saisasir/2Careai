"""
Test memory system — Redis session persistence and context builder.
Uses MockRedisSessionManager from conftest.
"""

import pytest
import pytest_asyncio
from memory.persistent_memory.context_builder import build_memory_context
from memory.persistent_memory.pg_manager import PGPersistentMemory
from tests.conftest import MockRedisSessionManager


# ══════════════════════════════════════════════════════════
# Redis Session Manager Tests
# ══════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_create_and_get_session(mock_redis: MockRedisSessionManager):
    """Session can be created and retrieved."""
    await mock_redis.create_session("sess-1", {"language": "hi", "patient_id": None})
    data = await mock_redis.get_session("sess-1")

    assert data is not None
    assert data["language"] == "hi"


@pytest.mark.asyncio
async def test_update_session_merges(mock_redis: MockRedisSessionManager):
    """Partial updates are merged into existing session."""
    await mock_redis.create_session("sess-2", {"language": "en", "patient_id": None})
    await mock_redis.update_session("sess-2", {"patient_id": 42})
    data = await mock_redis.get_session("sess-2")

    assert data["language"] == "en"
    assert data["patient_id"] == 42


@pytest.mark.asyncio
async def test_conversation_history_persistence(mock_redis: MockRedisSessionManager):
    """Conversation turns are appended and persist across retrieval."""
    await mock_redis.create_session("sess-3", {"conversation_history": []})

    # Simulate 3 turns
    await mock_redis.append_conversation("sess-3", {"role": "user", "content": "Book appointment"})
    await mock_redis.append_conversation("sess-3", {"role": "assistant", "content": "Sure! Which doctor?"})
    await mock_redis.append_conversation("sess-3", {"role": "user", "content": "Dr. Priya"})

    data = await mock_redis.get_session("sess-3")
    history = data["conversation_history"]

    assert len(history) == 3
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"
    assert history[2]["content"] == "Dr. Priya"


@pytest.mark.asyncio
async def test_conversation_history_capped_at_20(mock_redis: MockRedisSessionManager):
    """History is capped at 20 turns to prevent context bloat."""
    await mock_redis.create_session("sess-4", {"conversation_history": []})

    for i in range(25):
        await mock_redis.append_conversation("sess-4", {
            "role": "user" if i % 2 == 0 else "assistant",
            "content": f"Turn {i}",
        })

    data = await mock_redis.get_session("sess-4")
    assert len(data["conversation_history"]) == 20
    # Should contain only the latest 20
    assert data["conversation_history"][0]["content"] == "Turn 5"


@pytest.mark.asyncio
async def test_clear_session(mock_redis: MockRedisSessionManager):
    """Cleared sessions return None."""
    await mock_redis.create_session("sess-5", {"language": "ta"})
    await mock_redis.clear_session("sess-5")

    data = await mock_redis.get_session("sess-5")
    assert data is None


# ══════════════════════════════════════════════════════════
# Context Builder Tests
# ══════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_context_builder_empty_session(mock_redis: MockRedisSessionManager):
    """Empty session produces the 'no prior context' message."""
    pg_mem = PGPersistentMemory()
    context = await build_memory_context(mock_redis, pg_mem, "nonexistent-session")

    assert "No prior context" in context


@pytest.mark.asyncio
async def test_context_builder_includes_language(mock_redis: MockRedisSessionManager):
    """Context string includes the session language."""
    await mock_redis.create_session("sess-ctx", {"language": "ta", "conversation_history": []})
    pg_mem = PGPersistentMemory()
    context = await build_memory_context(mock_redis, pg_mem, "sess-ctx")

    assert "ta" in context
