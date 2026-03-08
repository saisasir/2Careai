"""
Context builder — merges Redis session + PostgreSQL persistent memory
into a context string injected into every LLM call.
"""

import logging
from typing import Optional

from memory.session_memory.redis_manager import RedisSessionManager
from memory.persistent_memory.pg_manager import PGPersistentMemory

logger = logging.getLogger("careai.context")


async def build_memory_context(
    redis_mgr: RedisSessionManager,
    pg_mem: PGPersistentMemory,
    session_id: str,
    patient_id: Optional[int] = None,
) -> str:
    """
    Build a unified memory context string for LLM injection.

    Combines:
    - Redis: current session state, conversation history
    - PostgreSQL: patient preferences, past appointments

    Returns:
        A formatted context string ready for system prompt injection.
    """
    parts = []

    # ── Session Memory (Redis) ────────────────────────────
    session = await redis_mgr.get_session(session_id)
    if session:
        lang = session.get("language", "unknown")
        parts.append(f"[Session] Current language: {lang}")

        # NOTE: conversation history is injected directly as LLM messages in llm_agent.py,
        # so we skip it here to avoid sending it twice and inflating the prompt.

        # Include any extracted entities
        entities = session.get("entities", {})
        if entities:
            parts.append(f"[Session] Extracted entities: {entities}")

    # ── Persistent Memory (PostgreSQL) ────────────────────
    if patient_id:
        patient_ctx = await pg_mem.get_patient_context(patient_id)
        if patient_ctx:
            name = patient_ctx.get("patient_name")
            if name:
                parts.append(f"[Patient] Name: {name}")

            pref_lang = patient_ctx.get("preferred_language")
            if pref_lang:
                parts.append(f"[Patient] Preferred language: {pref_lang}")

            pref_doc = patient_ctx.get("preferred_doctor")
            if pref_doc:
                parts.append(f"[Patient] Preferred doctor: {pref_doc}")

            past = patient_ctx.get("past_appointments", [])
            if past:
                parts.append("[Patient] Recent appointments:")
                for appt in past[:3]:
                    parts.append(
                        f"  - {appt['doctor']} ({appt['specialty']}) on "
                        f"{appt['date']} at {appt['time']} — {appt['status']}"
                    )

            count = patient_ctx.get("interaction_count", 0)
            if count > 0:
                parts.append(f"[Patient] Total past interactions: {count}")

    if not parts:
        return "[Memory] No prior context available — this is a new conversation."

    return "\n".join(parts)
