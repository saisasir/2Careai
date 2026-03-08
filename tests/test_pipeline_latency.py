"""
Test pipeline latency metric tracking and rolling average correctness.
"""

import pytest
from backend.routes import update_metrics, _metrics


# ══════════════════════════════════════════════════════════
# Reset metrics before each test
# ══════════════════════════════════════════════════════════

@pytest.fixture(autouse=True)
def reset_metrics():
    """Reset the in-memory metrics store before each test."""
    _metrics["total_requests"] = 0
    _metrics["avg_latency_ms"] = 0.0
    _metrics["pipeline_stages"]["stt_avg_ms"] = 0.0
    _metrics["pipeline_stages"]["llm_avg_ms"] = 0.0
    _metrics["pipeline_stages"]["tts_avg_ms"] = 0.0
    yield


# ══════════════════════════════════════════════════════════
# Tests
# ══════════════════════════════════════════════════════════

def test_single_update():
    """Single update sets exact values."""
    update_metrics(stt_ms=100.0, llm_ms=200.0, tts_ms=80.0)

    assert _metrics["total_requests"] == 1
    assert _metrics["avg_latency_ms"] == 380.0
    assert _metrics["pipeline_stages"]["stt_avg_ms"] == 100.0
    assert _metrics["pipeline_stages"]["llm_avg_ms"] == 200.0
    assert _metrics["pipeline_stages"]["tts_avg_ms"] == 80.0


def test_rolling_average():
    """Rolling average computes correctly over multiple updates."""
    update_metrics(stt_ms=100.0, llm_ms=200.0, tts_ms=100.0)  # total=400
    update_metrics(stt_ms=120.0, llm_ms=180.0, tts_ms=80.0)   # total=380

    assert _metrics["total_requests"] == 2
    assert _metrics["avg_latency_ms"] == pytest.approx(390.0)  # (400+380)/2
    assert _metrics["pipeline_stages"]["stt_avg_ms"] == pytest.approx(110.0)
    assert _metrics["pipeline_stages"]["llm_avg_ms"] == pytest.approx(190.0)
    assert _metrics["pipeline_stages"]["tts_avg_ms"] == pytest.approx(90.0)


def test_latency_structure():
    """Verify the metrics dict has the expected shape."""
    assert "total_requests" in _metrics
    assert "avg_latency_ms" in _metrics
    assert "pipeline_stages" in _metrics
    assert "stt_avg_ms" in _metrics["pipeline_stages"]
    assert "llm_avg_ms" in _metrics["pipeline_stages"]
    assert "tts_avg_ms" in _metrics["pipeline_stages"]
