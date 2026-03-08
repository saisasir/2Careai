"""
WebSocket handler — orchestrates the full voice pipeline:
  audio in → STT → language detect → memory inject → LLM agent → TTS → audio out
Logs timestamps at every stage for latency tracking.
Implements error handling at every pipeline stage per spec Step 13.

Latency optimizations:
  - Session data preloaded from Redis concurrently with STT (~5-15ms saved)
  - Language detection runs concurrently with session preload after STT
  - ConnectionManager tracks active connections for observability
"""

import asyncio
import json
import time
import uuid
import logging
from fastapi import WebSocket, WebSocketDisconnect
from backend.security import decode_access_token

from backend.config import get_settings
from services.speech_to_text.stt import transcribe_audio
from services.text_to_speech.tts import synthesize_speech
from services.language_detection.language_detection import detect_language
from agent.reasoning.llm_agent import process_with_agent
from agent.prompt.prompts import STT_RETRY_MESSAGES
from memory.session_memory.redis_manager import RedisSessionManager
from memory.persistent_memory.pg_manager import PGPersistentMemory
from memory.persistent_memory.context_builder import build_memory_context
from backend.routes import update_metrics

logger = logging.getLogger("careai.ws")
settings = get_settings()

# Latency warning threshold in milliseconds
LATENCY_WARN_THRESHOLD_MS = 450.0


class ConnectionManager:
    """Tracks active WebSocket connections for observability and graceful shutdown."""

    def __init__(self):
        self._connections: dict[str, WebSocket] = {}

    def connect(self, session_id: str, websocket: WebSocket) -> None:
        self._connections[session_id] = websocket
        logger.debug(f"ConnectionManager: +1 ({len(self._connections)} active)")

    def disconnect(self, session_id: str) -> None:
        self._connections.pop(session_id, None)
        logger.debug(f"ConnectionManager: -1 ({len(self._connections)} active)")

    @property
    def active_count(self) -> int:
        return len(self._connections)


# Module-level singleton — shared across all connections
_connection_manager = ConnectionManager()


async def voice_ws_endpoint(websocket: WebSocket):
    """
    Main WebSocket handler for voice interactions.

    Protocol:
      Client → Server:  binary audio frames (PCM 16-bit, 16kHz)
      Server → Client:  JSON metadata + binary audio response

    Each connection gets a unique session_id stored in Redis.

    Pipeline stages (logged per spec Step 10):
      T1: STT → text
      T2: Language detection → lang code
      T3: Load session memory from Redis
      T4: LLM agent → intent + response text
      T5: Tool execution → appointment action result
      T6: Update session memory in Redis
      T7: TTS → audio bytes
      T8: Send audio bytes over WebSocket
      Total = T8 - T0, assert < 450ms, emit warning if exceeded
    """
    # ── JWT Authentication ────────────────────────────────
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing auth token")
        return
    try:
        decode_access_token(token)
    except Exception:
        await websocket.close(code=4003, reason="Invalid or expired token")
        return

    await websocket.accept()

    # Session Resumption: Check if client provided a session_id or manual language in query params
    query_params = websocket.query_params
    provided_session_id = query_params.get("session_id")
    manual_lang = query_params.get("language", "auto")
    if manual_lang == "auto":
        manual_lang = None

    redis_mgr = RedisSessionManager()
    pg_mem = PGPersistentMemory()

    if provided_session_id:
        existing_session = await redis_mgr.get_session(provided_session_id)
        if existing_session:
            session_id = provided_session_id
            logger.info(f"[{session_id}] WebSocket resumed existing session (manual_lang={manual_lang})")
        else:
            session_id = str(uuid.uuid4())
            logger.warning(f"[{provided_session_id}] Session not found, started new: {session_id}")
    else:
        session_id = str(uuid.uuid4())
        logger.info(f"[{session_id}] WebSocket connected (new session, manual_lang={manual_lang})")

    processing_task = None

    # Initialize/Refresh session in Redis
    if not provided_session_id or not await redis_mgr.get_session(session_id):
        await redis_mgr.create_session(session_id, {
            "language": manual_lang or "en",
            "conversation_history": [],
            "patient_id": None,
        })
    elif manual_lang:
        # Update existing session with manual language
        await redis_mgr.update_session(session_id, {"language": manual_lang})

    _connection_manager.connect(session_id, websocket)

    async def run_pipeline(audio_bytes, t0):
        """Internal helper to run the full pipeline as a task.

        Latency optimization: session is preloaded from Redis concurrently
        with STT so the Redis round-trip (~5-15ms) is hidden behind STT latency.
        """
        try:
            # ── Stage 1: STT + concurrent session preload ─────
            # Fire both concurrently — session preload hides behind STT latency
            t_stt_start = time.perf_counter()
            (transcript, stt_confidence, stt_detected_lang), session_data = await asyncio.gather(
                transcribe_audio(audio_bytes),
                redis_mgr.get_session(session_id),
            )
            t_stt_end = time.perf_counter()
            stt_ms = (t_stt_end - t_stt_start) * 1000

            # ── Error handling: STT failure ───────────────────
            if not transcript or not transcript.strip():
                lang = session_data.get("language", "en") if session_data else "en"
                retry_text = STT_RETRY_MESSAGES.get(lang, STT_RETRY_MESSAGES["en"])
                await websocket.send_json({
                    "type": "stt_retry",
                    "message": retry_text,
                    "language": lang,
                    "latency": {"stt_ms": round(stt_ms, 1)},
                })
                retry_audio = await synthesize_speech(retry_text, lang)
                if retry_audio:
                    await websocket.send_bytes(retry_audio)
                logger.info(f"[{session_id}] STT silence/failure — asked user to repeat")
                return

            logger.info(f"[{session_id}] STT ({stt_ms:.0f}ms) conf={stt_confidence:.2f}: {transcript}")

            # ── Stage 1.5: Send early transcript metadata ─────
            await websocket.send_json({
                "type": "transcript",
                "transcript": transcript,
                "session_id": session_id,
            })

            # ── Stage 2: Language detection ───────────────────
            # Priority: manual override > STT detected > Unicode/langdetect fallback
            t_ld_start = time.perf_counter()
            if manual_lang:
                detected_lang = manual_lang
                ld_source = "manual"
            elif stt_detected_lang:
                # Use Deepgram/Whisper's own language detection — most accurate
                detected_lang = stt_detected_lang
                ld_source = "stt"
            else:
                # Last resort: Unicode script + langdetect on transcript text
                detected_lang = detect_language(transcript)
                ld_source = "langdetect"
            t_ld_end = time.perf_counter()
            ld_ms = (t_ld_end - t_ld_start) * 1000

            logger.info(f"[{session_id}] Language ({ld_ms:.0f}ms) source={ld_source}: {detected_lang}")

            # Update language in Redis (fire-and-forget, don't block pipeline)
            asyncio.create_task(
                redis_mgr.update_session(session_id, {"language": detected_lang})
            )

            # ── Stage 3: Build Memory Context ─────────────────
            # session_data already fetched concurrently with STT above
            if session_data is None:
                session_data = {}
            patient_id = session_data.get("patient_id")
            conversation_history = session_data.get("conversation_history", [])
            memory_context = await build_memory_context(
                redis_mgr, pg_mem, session_id, patient_id
            )

            # Get persistent context for UI display
            patient_context = await pg_mem.get_patient_context(patient_id) if patient_id else {}

            # ── Stage 4: LLM Agent ───────────────────────────
            t_llm_start = time.perf_counter()
            agent_response = await process_with_agent(
                transcript=transcript,
                language=detected_lang,
                memory_context=memory_context,
                session_id=session_id,
                conversation_history=conversation_history,
            )
            t_llm_end = time.perf_counter()
            llm_ms = (t_llm_end - t_llm_start) * 1000

            response_text = agent_response.get("response_text", "")
            intent = agent_response.get("intent", "unknown")
            logger.info(f"[{session_id}] Agent Response: intent={intent}, text='{response_text[:50]}...'")

            # Save conversation turn to Redis
            await redis_mgr.append_conversation(session_id, {
                "role": "user",
                "content": transcript,
                "language": detected_lang,
            })
            await redis_mgr.append_conversation(session_id, {
                "role": "assistant",
                "content": response_text,
                "intent": intent,
            })

            # ── Stage 5: Text-to-Speech ──────────────────────
            t_tts_start = time.perf_counter()
            # Synthesize all at once for single binary blob (prevents frontend AbortError)
            audio_data = await synthesize_speech(response_text, detected_lang)
            t_tts_end = time.perf_counter()
            tts_ms = (t_tts_end - t_tts_start) * 1000

            if audio_data:
                await websocket.send_bytes(audio_data)

            # ── Stage 6: Send response + metrics ────────────────
            total_ms = (t_tts_end - t0) * 1000

            # Send metadata to UI
            await websocket.send_json({
                "type": "response",
                "transcript": transcript,
                "language": detected_lang,
                "language_source": ld_source,
                "intent": intent,
                "response_text": response_text,
                "patient_context": patient_context,
                "session_id": session_id,
                "latency": {
                    "stt_ms": round(stt_ms, 1),
                    "ld_ms": round(ld_ms, 1),
                    "llm_ms": round(llm_ms, 1),
                    "tts_ms": round(tts_ms, 1),
                    "total_ms": round(total_ms, 1),
                },
            })

            # ── Latency breach detection (Step 13) ────────────
            if total_ms > LATENCY_WARN_THRESHOLD_MS:
                logger.warning(
                    f"[{session_id}] ⚠ LATENCY BREACH: {total_ms:.0f}ms > "
                    f"{LATENCY_WARN_THRESHOLD_MS}ms threshold  "
                    f"(STT={stt_ms:.0f} LLM={llm_ms:.0f} TTS={tts_ms:.0f})"
                )

            logger.info(
                f"[{session_id}] Pipeline: "
                f"STT={stt_ms:.0f}ms LD={ld_ms:.0f}ms LLM={llm_ms:.0f}ms "
                f"TTS={tts_ms:.0f}ms Total={total_ms:.0f}ms"
            )
            update_metrics(stt_ms, llm_ms, tts_ms)

        except asyncio.CancelledError:
            logger.info(f"[{session_id}] Pipeline task cancelled (barge-in)")
            raise
        except Exception as e:
            logger.error(f"[{session_id}] Pipeline task error: {e}", exc_info=True)
            # Send error message to UI
            try:
                error_messages = {
                    "en": "I'm sorry, I encountered an error. Please try again.",
                    "hi": "मुझे खेद है, एक त्रुटி हुई। कृपया पुनः प्रयास करें।",
                    "ta": "மன்னிக்கவும், பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.",
                }
                lang = session_data.get("language", "en") if 'session_data' in locals() and session_data else "en"
                error_text = error_messages.get(lang, error_messages["en"])
                await websocket.send_json({
                    "type": "error",
                    "response_text": error_text,
                    "session_id": session_id,
                })
            except Exception:
                pass

    try:
        while True:
            # ── Stage 0: Receive data (Audio or Control) ──────
            t0 = time.perf_counter()
            message = await websocket.receive()

            if "text" in message:
                try:
                    data = json.loads(message["text"])
                    if data.get("type") == "control" and data.get("action") == "stop":
                        if processing_task and not processing_task.done():
                            processing_task.cancel()
                            logger.info(f"[{session_id}] Barge-in: Stopped current task")
                        continue
                except Exception as e:
                    logger.warning(f"[{session_id}] Error parsing control message: {e}")
                    continue

            if "bytes" not in message:
                continue

            # If we were already processing, cancel it (Implicit Barge-in)
            if processing_task and not processing_task.done():
                processing_task.cancel()
                logger.debug(f"[{session_id}] Cancelling old task for new audio")

            # Start the pipeline as a background task
            processing_task = asyncio.create_task(run_pipeline(message["bytes"], t0))

    except WebSocketDisconnect:
        logger.info(f"[{session_id}] WebSocket disconnected")
    except Exception as e:
        logger.error(f"[{session_id}] Pipeline error: {e}", exc_info=True)
        # ── Graceful voice fallback (Error Handling Step 13) ──
        try:
            error_messages = {
                "en": "I'm sorry, I encountered an error. Please try again.",
                "hi": "मुझे खेद है, एक त्रुटि हुई। कृपया पुनः प्रयास करें।",
                "ta": "மன்னிக்கவும், பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.",
            }
            session_data = await redis_mgr.get_session(session_id)
            lang = session_data.get("language", "en") if session_data else "en"
            error_text = error_messages.get(lang, error_messages["en"])

            fallback_audio = await synthesize_speech(error_text, lang)
            await websocket.send_json({
                "type": "error",
                "response_text": error_text,
            })
            if fallback_audio:
                await websocket.send_bytes(fallback_audio)
        except Exception:
            pass
    finally:
        _connection_manager.disconnect(session_id)
        logger.info(f"[{session_id}] Session cleanup ({_connection_manager.active_count} remaining)")
