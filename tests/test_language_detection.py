"""
Test language detection — English, Hindi, Tamil + edge cases.
"""

import pytest
from services.language_detection.language_detection import detect_language, is_supported_language


# ══════════════════════════════════════════════════════════
# English Detection
# ══════════════════════════════════════════════════════════

def test_detect_english():
    """Standard English text is classified as 'en'."""
    assert detect_language("I want to book an appointment with a doctor") == "en"


def test_detect_english_long():
    """Longer English text is classified correctly."""
    text = "Hello, I would like to schedule a medical appointment for next Monday please."
    assert detect_language(text) == "en"


# ══════════════════════════════════════════════════════════
# Hindi Detection
# ══════════════════════════════════════════════════════════

def test_detect_hindi():
    """Hindi Devanagari text is classified as 'hi'."""
    assert detect_language("मुझे डॉक्टर से मिलने का समय चाहिए") == "hi"


# ══════════════════════════════════════════════════════════
# Tamil Detection
# ══════════════════════════════════════════════════════════

def test_detect_tamil():
    """Tamil text is classified as 'ta'."""
    assert detect_language("மருத்துவரை சந்திக்க நேரம் வேண்டும்") == "ta"


# ══════════════════════════════════════════════════════════
# Fallback / Edge Cases
# ══════════════════════════════════════════════════════════

def test_empty_input_defaults_to_english():
    """Empty or whitespace input falls back to English."""
    assert detect_language("") == "en"
    assert detect_language("   ") == "en"


def test_none_like_input():
    """None-ish strings fall back gracefully."""
    assert detect_language("") == "en"


def test_unsupported_language_defaults_to_english():
    """Text in an unsupported language falls back to English."""
    # French text — not in supported set
    result = detect_language("Je voudrais prendre un rendez-vous médical")
    assert result == "en"  # Fallback to English


# ══════════════════════════════════════════════════════════
# is_supported_language
# ══════════════════════════════════════════════════════════

def test_supported_languages():
    """Check supported language codes."""
    assert is_supported_language("en") is True
    assert is_supported_language("hi") is True
    assert is_supported_language("ta") is True
    assert is_supported_language("fr") is False
    assert is_supported_language("") is False
