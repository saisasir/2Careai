"""
Text-to-Speech service.
Strategy:
  - English: ElevenLabs (high quality) → gTTS fallback
  - Hindi/Tamil: gTTS primary (correct pronunciation, reliable) → ElevenLabs fallback
    (ElevenLabs eleven_multilingual_v2 can handle hi/ta but quality is inconsistent)
"""

import logging
import io
import httpx
import asyncio
from gtts import gTTS
from backend.config import get_settings

logger = logging.getLogger("careai.tts")
settings = get_settings()

# gTTS language codes (all confirmed working)
_GTTS_LANG_MAP = {
    "en": "en",
    "hi": "hi",
    "ta": "ta",
}

# Languages where gTTS is the preferred primary provider
_GTTS_PRIMARY_LANGUAGES = {"hi", "ta"}


def _get_voice_id(language: str) -> str:
    """Get the ElevenLabs voice ID for a given language."""
    voice_map = {
        "en": settings.elevenlabs_voice_en,
        "hi": settings.elevenlabs_voice_hi,
        "ta": settings.elevenlabs_voice_ta,
    }
    return voice_map.get(language, settings.elevenlabs_voice_en)


async def synthesize_speech(text: str, language: str = "en") -> bytes:
    """
    Convert text to speech — returns complete audio bytes (MP3).
    """
    if not text or not text.strip():
        return b""

    # For Hindi/Tamil: gTTS is primary (correct native pronunciation)
    if language in _GTTS_PRIMARY_LANGUAGES:
        try:
            audio = await _gtts_synthesize(text, language)
            if audio:
                return audio
        except Exception as e:
            logger.warning(f"gTTS failed for {language}, trying ElevenLabs: {e}")
        # Fallback to ElevenLabs multilingual
        if settings.elevenlabs_api_key:
            try:
                return await _elevenlabs_synthesize(text, language)
            except Exception as e:
                logger.error(f"ElevenLabs also failed for {language}: {e}")
        return b""

    # For English: ElevenLabs primary (higher quality)
    if settings.elevenlabs_api_key:
        try:
            return await _elevenlabs_synthesize(text, language)
        except Exception as e:
            logger.warning(f"ElevenLabs failed for {language}, falling back to gTTS: {e}")

    # gTTS fallback for English
    try:
        return await _gtts_synthesize(text, language)
    except Exception as e:
        logger.error(f"gTTS also failed for {language}: {e}")
    return b""


async def synthesize_speech_stream(text: str, language: str = "en"):
    """
    Stream TTS audio chunks. Used internally; calls synthesize_speech and chunks it.
    """
    audio = await synthesize_speech(text, language)
    if not audio:
        yield b""
        return
    chunk_size = 4096
    for i in range(0, len(audio), chunk_size):
        yield audio[i:i + chunk_size]


async def _elevenlabs_synthesize(text: str, language: str) -> bytes:
    """Use ElevenLabs eleven_multilingual_v2 for high-quality synthesis."""
    voice_id = _get_voice_id(language)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    headers = {
        "xi-api-key": settings.elevenlabs_api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        if response.status_code != 200:
            body = response.text
            raise httpx.HTTPStatusError(
                f"ElevenLabs {response.status_code}: {body}",
                request=response.request,
                response=response,
            )
        return response.content


async def _gtts_synthesize(text: str, language: str) -> bytes:
    """Use Google TTS — excellent for Hindi and Tamil, free, no API key needed."""
    lang_code = _GTTS_LANG_MAP.get(language, "en")

    def _sync_gtts():
        tts = gTTS(text=text, lang=lang_code, slow=False)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        return buf.getvalue()

    loop = asyncio.get_running_loop()
    audio_bytes = await loop.run_in_executor(None, _sync_gtts)
    logger.debug(f"gTTS ({language}): {len(audio_bytes)} bytes for '{text[:40]}...'")
    return audio_bytes
