"""
Language detection — langdetect (primary) with LLM-inferred fallback.
Supports: English (en), Hindi (hi), Tamil (ta).
"""

import logging
from langdetect import detect, DetectorFactory, LangDetectException

logger = logging.getLogger("careai.langdetect")

# Make langdetect deterministic
DetectorFactory.seed = 42

# Supported languages
SUPPORTED_LANGUAGES = {"en", "hi", "ta"}

# Default fallback
DEFAULT_LANGUAGE = "en"


import re

# Unicode ranges for scripts
# Devanagari: \u0900-\u097F
# Tamil: \u0B80-\u0BFF
RE_HINDI = re.compile(r"[\u0900-\u097F]")
RE_TAMIL = re.compile(r"[\u0B80-\u0BFF]")


def detect_language(text: str) -> str:
    """
    Detect the language of the given text.
    Uses Unicode script checks for native scripts, falling back to langdetect.
    """
    if not text or not text.strip():
        return DEFAULT_LANGUAGE

    # 1. Unicode Script Check (High Confidence)
    if RE_HINDI.search(text):
        logger.debug(f"Unicode check: Detected Hindi (hi) for '{text[:20]}...'")
        return "hi"
    if RE_TAMIL.search(text):
        logger.debug(f"Unicode check: Detected Tamil (ta) for '{text[:20]}...'")
        return "ta"

    # 2. Probabilistic Detection (Fallback)
    try:
        detected = detect(text)
        logger.debug(f"langdetect result: {detected} for '{text[:60]}...'")

        # Map detected language to supported set
        if detected in SUPPORTED_LANGUAGES:
            return detected

        # Some langdetect codes may differ
        lang_map = {
            "en": "en",
            "hi": "hi",
            "ta": "ta",
            "mr": "hi",  # Marathi → Hindi fallback
            "ne": "hi",  # Nepali → Hindi fallback
        }

        result = lang_map.get(detected, DEFAULT_LANGUAGE)
        logger.info(f"Probabilistic mapping '{detected}' → '{result}'")
        return result

    except LangDetectException as e:
        logger.warning(f"Language detection failed: {e}")
        return DEFAULT_LANGUAGE
    except Exception as e:
        logger.error(f"Unexpected language detection error: {e}")
        return DEFAULT_LANGUAGE


def is_supported_language(lang_code: str) -> bool:
    """Check if a language code is supported."""
    return lang_code in SUPPORTED_LANGUAGES
