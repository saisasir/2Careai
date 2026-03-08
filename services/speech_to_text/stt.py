"""
Speech-to-Text service — Deepgram (primary) with Groq Whisper fallback.
Returns (transcript, confidence, detected_language) — language from STT is
more accurate than post-hoc langdetect on the transcript.
"""

import logging
import io
import httpx
from backend.config import get_settings

logger = logging.getLogger("careai.stt")
settings = get_settings()

# Deepgram language code → our internal code
_DEEPGRAM_LANG_MAP = {
    "hi": "hi",
    "ta": "ta",
    "en": "en",
    "en-us": "en",
    "en-in": "en",
    "en-gb": "en",
    "en-au": "en",
}

# Whisper language names → our internal code
_WHISPER_LANG_MAP = {
    "hindi": "hi",
    "tamil": "ta",
    "english": "en",
    "hi": "hi",
    "ta": "ta",
    "en": "en",
}


async def transcribe_audio(audio_bytes: bytes) -> tuple[str, float, str]:
    """
    Convert audio bytes to text.

    Returns:
        Tuple of (transcript_text, confidence_score, detected_language)
        detected_language is "" if STT could not detect it.
    """
    if settings.deepgram_api_key:
        try:
            return await _deepgram_transcribe(audio_bytes)
        except Exception as e:
            logger.warning(f"Deepgram STT failed, falling back to Whisper: {e}")

    if settings.groq_api_key:
        try:
            return await _whisper_transcribe(audio_bytes)
        except Exception as e:
            logger.error(f"Whisper STT also failed: {e}")

    logger.error("No STT provider available — check API keys")
    return ("", 0.0, "")


async def _deepgram_transcribe(audio_bytes: bytes) -> tuple[str, float, str]:
    """Use Deepgram's REST API for fast transcription with language detection."""
    url = "https://api.deepgram.com/v1/listen"
    params = {
        "model": "nova-2",
        "language": "multi",        # auto-detect: en, hi, ta and many more
        "smart_format": "true",
        "punctuate": "true",
        "detect_language": "true",
    }
    headers = {
        "Authorization": f"Token {settings.deepgram_api_key}",
        "Content-Type": "audio/webm",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(url, params=params, headers=headers, content=audio_bytes)
        response.raise_for_status()
        data = response.json()

    channels = data.get("results", {}).get("channels", [])
    if not channels:
        return ("", 0.0, "")

    channel = channels[0]
    alternatives = channel.get("alternatives", [])
    if not alternatives:
        return ("", 0.0, "")

    best = alternatives[0]
    transcript = best.get("transcript", "")
    confidence = best.get("confidence", 0.0)

    # Extract language detected by Deepgram (most accurate source)
    raw_lang = channel.get("detected_language", "").lower()
    detected_lang = _DEEPGRAM_LANG_MAP.get(raw_lang, "")

    logger.debug(f"Deepgram: '{transcript}' conf={confidence:.2f} lang={raw_lang}→{detected_lang}")
    return (transcript, confidence, detected_lang)


async def _whisper_transcribe(audio_bytes: bytes) -> tuple[str, float, str]:
    """Use Groq Whisper API as fallback."""
    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
    }

    files = {
        "file": ("audio.webm", io.BytesIO(audio_bytes), "audio/webm"),
        "model": (None, "whisper-large-v3-turbo"),
        "response_format": (None, "verbose_json"),
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers, files=files)
        response.raise_for_status()
        data = response.json()

    transcript = data.get("text", "")
    raw_lang = data.get("language", "").lower()
    detected_lang = _WHISPER_LANG_MAP.get(raw_lang, "")

    confidence = 0.85 if transcript else 0.0
    logger.debug(f"Whisper: '{transcript}' lang={raw_lang}→{detected_lang}")
    return (transcript, confidence, detected_lang)
