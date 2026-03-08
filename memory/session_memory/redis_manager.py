"""
Redis session manager — per-session conversation memory with TTL.
"""

import json
import logging
from typing import Optional
import redis.asyncio as redis

from backend.config import get_settings

logger = logging.getLogger("careai.redis")
settings = get_settings()

# Global Redis client
_redis_client: Optional[redis.Redis] = None


def _get_client() -> redis.Redis:
    """Get or create the Redis client."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
        )
    return _redis_client


class RedisSessionManager:
    """Manages per-session conversation state in Redis."""

    def __init__(self):
        self.client = _get_client()
        self.ttl = settings.redis_session_ttl  # 30 min default

    def _key(self, session_id: str) -> str:
        return f"careai:session:{session_id}"

    async def ping(self) -> bool:
        """Check Redis connectivity."""
        try:
            return await self.client.ping()
        except Exception as e:
            logger.error(f"Redis ping failed: {e}")
            return False

    async def create_session(self, session_id: str, initial_data: dict) -> None:
        """Create a new session with initial data."""
        key = self._key(session_id)
        await self.client.set(key, json.dumps(initial_data), ex=self.ttl)
        logger.debug(f"Session created: {session_id}")

    async def get_session(self, session_id: str) -> Optional[dict]:
        """Get session data."""
        key = self._key(session_id)
        data = await self.client.get(key)
        if data:
            # Refresh TTL on access
            await self.client.expire(key, self.ttl)
            return json.loads(data)
        return None

    async def update_session(self, session_id: str, updates: dict) -> None:
        """Merge updates into existing session data."""
        key = self._key(session_id)
        data = await self.client.get(key)
        if data:
            current = json.loads(data)
            current.update(updates)
            await self.client.set(key, json.dumps(current), ex=self.ttl)
        else:
            await self.client.set(key, json.dumps(updates), ex=self.ttl)

    async def append_conversation(self, session_id: str, turn: dict) -> None:
        """Append a conversation turn to the session history."""
        session = await self.get_session(session_id)
        if session is None:
            session = {"conversation_history": []}

        history = session.get("conversation_history", [])
        history.append(turn)

        # Keep last 20 turns to avoid context bloat
        if len(history) > 20:
            history = history[-20:]

        session["conversation_history"] = history
        key = self._key(session_id)
        await self.client.set(key, json.dumps(session), ex=self.ttl)

    async def clear_session(self, session_id: str) -> None:
        """Delete a session."""
        key = self._key(session_id)
        await self.client.delete(key)
        logger.debug(f"Session cleared: {session_id}")

    async def close(self) -> None:
        """Close Redis connection."""
        global _redis_client
        if _redis_client:
            await _redis_client.close()
            _redis_client = None
            logger.info("Redis connection closed")
