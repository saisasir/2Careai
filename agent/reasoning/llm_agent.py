"""
LLM Agent — constructs messages with memory context, calls GPT-4o with tools,
and handles multi-turn tool calling with conversation history injection.
"""

import json
import logging
import asyncio
import time as _time
from datetime import datetime
from typing import Optional
from groq import AsyncGroq

from backend.config import get_settings
from agent.prompt.prompts import (
    SYSTEM_PROMPT,
    ERROR_MESSAGES,
    LLM_TIMEOUT_MESSAGES,
    RATE_LIMIT_MESSAGES,
)
from agent.tools.tools import TOOL_DEFINITIONS
from agent.tools.tool_executor import execute_tool

logger = logging.getLogger("careai.agent")
settings = get_settings()

# Groq client (lazily initialized)
_client: Optional[AsyncGroq] = None

# LLM timeout in seconds — Groq is fast, fail fast to stay within latency budget
LLM_TIMEOUT_SECONDS = 8.0
MAX_LLM_RETRIES = 1

# Simple in-memory cache for tool results (e.g., checkAvailability)
# Key: {tool_name}:{args_json}
# Value: (result_str, timestamp)
_tool_cache = {}
CACHE_TTL_SECONDS = 60  # 1 minute — slots change frequently


def _get_client() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.groq_api_key)
    return _client


async def process_with_agent(
    transcript: str,
    language: str = "en",
    memory_context: str = "",
    session_id: str = "",
    conversation_history: list = None,
) -> dict:
    """
    Process a user transcript through the LLM agent.
    """
    client = _get_client()

    # ── Build system message with memory context ──────────
    current_time = datetime.now()
    date_str = current_time.strftime("%A, %Y-%m-%d")
    time_str = current_time.strftime("%H:%M")
    
    lang_names = {"en": "English", "hi": "Hindi (हिन्दी)", "ta": "Tamil (தமிழ்)"}
    lang_name = lang_names.get(language, "English")

    system_message = SYSTEM_PROMPT
    if memory_context:
        system_message += f"\n\n## Current Memory Context\n{memory_context}"

    system_message += (
        f"\n\n## ACTIVE SESSION CONTEXT\n"
        f"Today's Date: {date_str}\n"
        f"Current Time: {time_str}\n"
        f"Session ID: {session_id}\n"
        f"⚠️  PATIENT LANGUAGE: {lang_name} — YOU MUST REPLY IN {lang_name} ONLY. "
        f"Do NOT reply in any other language. "
        f"If the patient speaks Hindi, reply entirely in Hindi. "
        f"If the patient speaks Tamil, reply entirely in Tamil. "
        f"If the patient speaks English, reply in English."
    )

    messages = [
        {"role": "system", "content": system_message},
    ]

    # ── Inject conversation history for multi-turn ────────
    if conversation_history:
        recent_history = conversation_history[-4:]  # Keep last 4 turns to reduce token usage
        for turn in recent_history:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": transcript})

    async def _call_llm_with_retry(msgs, use_tools=True):
        for attempt in range(MAX_LLM_RETRIES + 1):
            try:
                kwargs = dict(
                    model=settings.llm_model,
                    messages=msgs,
                    temperature=settings.llm_temperature,
                    max_tokens=settings.llm_max_tokens,
                )
                if use_tools:
                    kwargs["tools"] = TOOL_DEFINITIONS
                    kwargs["tool_choice"] = "auto"
                return await asyncio.wait_for(
                    client.chat.completions.create(**kwargs),
                    timeout=LLM_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                if attempt == MAX_LLM_RETRIES:
                    raise
                logger.warning(f"[{session_id}] LLM timeout (attempt {attempt+1}). Retrying...")
                await asyncio.sleep(0.5 * (2 ** attempt))
            except Exception as e:
                # Rate limit: wait 3s then retry once
                if "RateLimitError" in str(type(e)) or "429" in str(e):
                    if attempt < MAX_LLM_RETRIES:
                        logger.warning(f"[{session_id}] Rate limit hit, waiting 3s before retry...")
                        await asyncio.sleep(3)
                        continue
                    logger.error(f"[{session_id}] Rate limit hit after retries: {e}")
                    raise
                if attempt == MAX_LLM_RETRIES:
                    raise
                wait_time = 0.5 * (2 ** attempt)
                logger.warning(f"[{session_id}] LLM error (attempt {attempt+1}): {e}. Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)

    try:
        # ── First LLM call ──────────────────────────────
        response = await _call_llm_with_retry(messages)
        assistant_message = response.choices[0].message
        logger.debug(f"[{session_id}] LLM Init: content='{assistant_message.content}', tools={assistant_message.tool_calls}")
        tool_calls_made = []

        # ── Handle tool calls (multi-turn loop) ───────────
        max_tool_rounds = 2
        round_count = 0

        while assistant_message.tool_calls and round_count < max_tool_rounds:
            round_count += 1
            messages.append(assistant_message)

            for tool_call in assistant_message.tool_calls:
                func_name = tool_call.function.name
                func_args = json.loads(tool_call.function.arguments)
                
                # Check Cache for checkAvailability
                cache_key = f"{func_name}:{json.dumps(func_args, sort_keys=True)}"
                if func_name == "checkAvailability" and cache_key in _tool_cache:
                    cached_val, ts = _tool_cache[cache_key]
                    if _time.time() - ts < CACHE_TTL_SECONDS:
                        logger.info(f"[{session_id}] Tool cache hit: {func_name}")
                        result = cached_val
                    else:
                        del _tool_cache[cache_key]
                        result = None
                else:
                    result = None

                if result is None:
                    logger.info(f"[{session_id}] Tool call #{round_count}: {func_name}")
                    try:
                        result = await execute_tool(func_name, func_args, language)
                        # Cache the result if suitable
                        if func_name == "checkAvailability":
                            _tool_cache[cache_key] = (result, _time.time())
                    except Exception as tool_err:
                        logger.error(f"[{session_id}] Tool execution failed: {tool_err}")
                        result = json.dumps({
                            "error": f"Tool execution failed: {str(tool_err)}",
                            "suggestion": "Please try again or contact the clinic directly.",
                        })

                tool_calls_made.append({
                    "name": func_name,
                    "arguments": func_args,
                    "result": json.loads(result) if isinstance(result, str) else result,
                })

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })

            # ── Follow-up LLM call with tool results ──────
            response = await _call_llm_with_retry(messages)
            assistant_message = response.choices[0].message
            logger.debug(f"[{session_id}] LLM Round {round_count}: content='{assistant_message.content}', tools={assistant_message.tool_calls}")

        response_text = assistant_message.content or ""

        # If the LLM exited the tool loop without producing a text response
        # (i.e., still had pending tool calls when max_tool_rounds was hit,
        # or content is None after tool execution), force a final text-only reply.
        if not response_text.strip():
            logger.warning(f"[{session_id}] Empty response_text after tool loop — forcing final text reply")
            try:
                final_response = await _call_llm_with_retry(messages, use_tools=False)
                response_text = final_response.choices[0].message.content or ""
            except Exception as fe:
                logger.error(f"[{session_id}] Final text reply failed: {fe}")
                response_text = ERROR_MESSAGES.get(language, ERROR_MESSAGES["en"])

        intent = _determine_intent(tool_calls_made)
        logger.info(f"[{session_id}] Agent Final: intent={intent}, text_len={len(response_text)}")

        return {
            "response_text": response_text,
            "intent": intent,
            "tool_calls": tool_calls_made,
            "structured": _extract_structured(tool_calls_made),
        }

    except asyncio.TimeoutError:
        logger.warning(f"[{session_id}] LLM timeout after retries")
        return {
            "response_text": LLM_TIMEOUT_MESSAGES.get(language, LLM_TIMEOUT_MESSAGES["en"]),
            "intent": "timeout",
            "tool_calls": [],
            "structured": {},
        }
    except Exception as e:
        logger.error(f"[{session_id}] Agent error: {e}", exc_info=True)
        # Check for rate limit
        err_str = str(e)
        if "429" in err_str or "RateLimitError" in str(type(e)):
            return {
                "response_text": RATE_LIMIT_MESSAGES.get(language, RATE_LIMIT_MESSAGES["en"]),
                "intent": "rate_limit",
                "tool_calls": [],
                "structured": {},
            }
        
        # Log the specific type of error for easier debugging
        logger.error(f"[{session_id}] Error type: {type(e)}")
        return {
            "response_text": ERROR_MESSAGES.get(language, ERROR_MESSAGES["en"]),
            "intent": "error",
            "tool_calls": [],
            "structured": {},
        }


def _determine_intent(tool_calls: list) -> str:
    """Determine the primary intent from tool calls made."""
    if not tool_calls or not isinstance(tool_calls, list):
        return "conversation"

    # Map tool names to intents
    intent_map = {
        "checkAvailability": "check_availability",
        "bookAppointment": "book_appointment",
        "cancelAppointment": "cancel_appointment",
        "rescheduleAppointment": "reschedule_appointment",
        "listDoctors": "list_doctors",
        "findDoctorBySpecialty": "find_doctor",
    }

    # Return the last tool's intent (most significant action)
    last_tool = tool_calls[-1]["name"]
    return intent_map.get(last_tool, "unknown")


def _extract_structured(tool_calls: list) -> dict:
    """Extract structured data from tool call arguments."""
    structured = {}
    if not tool_calls or not isinstance(tool_calls, list):
        return structured

    for call in tool_calls:
        if not isinstance(call, dict):
            continue
            
        args = call.get("arguments") or {}
        if not isinstance(args, dict):
            args = {}
            
        if "doctor_name" in args:
            structured["doctor"] = args["doctor_name"]
        if "date" in args or "new_date" in args:
            structured["date"] = args.get("date") or args.get("new_date")
        if "time" in args or "new_time" in args:
            structured["time"] = args.get("time") or args.get("new_time")
        if "specialty" in args:
            structured["specialty"] = args["specialty"]

        # Include result summary
        result = call.get("result") or {}
        if isinstance(result, dict):
            if result.get("success") is not None:
                structured["success"] = result["success"]
            if result.get("appointment_id"):
                structured["appointment_id"] = result["appointment_id"]
    return structured
