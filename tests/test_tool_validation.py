"""
Test tool validation — input parsing, dispatch, and error handling.
"""

import pytest
import json
from datetime import date, time
from agent.tools.tool_executor import _parse_date, _parse_time, execute_tool


# ══════════════════════════════════════════════════════════
# Date/Time Parsing
# ══════════════════════════════════════════════════════════

def test_parse_date_valid():
    """Valid YYYY-MM-DD string parses correctly."""
    result = _parse_date("2026-03-15")
    assert result == date(2026, 3, 15)


def test_parse_date_invalid():
    """Invalid date string raises ValueError."""
    with pytest.raises(ValueError):
        _parse_date("not-a-date")


def test_parse_time_valid():
    """Valid HH:MM string parses correctly."""
    result = _parse_time("09:30")
    assert result == time(9, 30)


def test_parse_time_invalid():
    """Invalid time string raises ValueError."""
    with pytest.raises(ValueError):
        _parse_time("25:99")


# ══════════════════════════════════════════════════════════
# Tool Dispatch — Unknown Tool
# ══════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_unknown_tool_returns_error():
    """Calling an unknown tool returns an error JSON."""
    result = await execute_tool("nonExistentTool", {})
    parsed = json.loads(result)
    assert "error" in parsed


# ══════════════════════════════════════════════════════════
# Tool Dispatch — Missing Required Args
# ══════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_check_availability_missing_date():
    """checkAvailability without 'date' raises an error."""
    result = await execute_tool("checkAvailability", {})
    parsed = json.loads(result)
    # Should fail with a parsing or key error
    assert "error" in parsed


@pytest.mark.asyncio
async def test_book_appointment_missing_doctor():
    """bookAppointment without doctor_name returns error."""
    result = await execute_tool("bookAppointment", {
        "date": "2026-03-15",
        "time": "09:00",
    })
    parsed = json.loads(result)
    assert "error" in parsed
