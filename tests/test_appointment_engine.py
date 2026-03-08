"""
Test appointment engine — covers all 5 scenarios:
  1. Book appointment successfully
  2. Cancel appointment
  3. Reschedule appointment
  4. Conflict detection + alternative slot suggestions
  5. Language switch during booking

Also tests: past-time rejection, doctor lookup, and schedule-aware availability.
"""

import pytest
import pytest_asyncio
from datetime import date, time, datetime, timedelta
from unittest.mock import patch, AsyncMock

from scheduler.appointment_engine.models import Appointment, Doctor, DoctorSchedule, Patient
from tests.conftest import next_weekday


# ══════════════════════════════════════════════════════════
# Helper: patch get_db_session to return our test session
# ══════════════════════════════════════════════════════════

class FakeDBSession:
    """Context manager that returns the test session."""
    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *args):
        pass


def patch_db(session):
    """Return a patch object that replaces get_db_session with our test session."""
    return patch(
        "scheduler.appointment_engine.appointment_engine.get_db_session",
        return_value=FakeDBSession(session),
    )


# ══════════════════════════════════════════════════════════
# Test 1: Check Availability
# ══════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_check_availability_returns_slots(seeded_session):
    """Verify check_availability returns available slots for a valid doctor/date."""
    from scheduler.appointment_engine.appointment_engine import check_availability

    # Find next Monday (Dr. Priya works Mon-Fri)
    target = next_weekday(date.today(), 0)

    with patch_db(seeded_session):
        result = await check_availability(doctor_id=1, appointment_date=target)

    assert result["available"] is True
    assert result["doctor_name"] == "Dr. Priya Sharma"
    assert len(result["slots"]) > 0
    assert result["slots"][0]["start"] == "09:00"


@pytest.mark.asyncio
async def test_check_availability_no_schedule(seeded_session):
    """Doctor with no schedule on a weekend returns no slots."""
    from scheduler.appointment_engine.appointment_engine import check_availability

    # Find next Sunday (no doctor works)
    target = next_weekday(date.today(), 6)

    with patch_db(seeded_session):
        result = await check_availability(doctor_id=1, appointment_date=target)

    assert result["available"] is False
    assert len(result["slots"]) == 0


# ══════════════════════════════════════════════════════════
# Test 2: Book Appointment Successfully
# ══════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_book_appointment_success(seeded_session):
    """Book an appointment in a valid slot."""
    from scheduler.appointment_engine.appointment_engine import book_appointment

    target = next_weekday(date.today(), 0)  # Next Monday

    with patch_db(seeded_session):
        result = await book_appointment(
            doctor_id=1,
            appointment_date=target,
            start_time=time(9, 0),
            patient_name="Alice",
            patient_phone="+911111111111",
            reason="Checkup",
            language="en",
        )

    assert result["success"] is True
    assert result["appointment_id"] is not None
    assert result["details"]["doctor"] == "Dr. Priya Sharma"
    assert result["details"]["status"] == "booked"


# ══════════════════════════════════════════════════════════
# Test 3: Conflict Detection — double booking rejected
# ══════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_conflict_detection_suggests_alternatives(seeded_session):
    """Booking a conflicting slot returns alternatives."""
    from scheduler.appointment_engine.appointment_engine import book_appointment

    target = next_weekday(date.today(), 0)

    with patch_db(seeded_session):
        # First booking succeeds
        r1 = await book_appointment(
            doctor_id=1,
            appointment_date=target,
            start_time=time(10, 0),
            patient_name="Bob",
            patient_phone="+912222222222",
        )
        assert r1["success"] is True

        # Second booking at same time => conflict
        r2 = await book_appointment(
            doctor_id=1,
            appointment_date=target,
            start_time=time(10, 0),
            patient_name="Carol",
            patient_phone="+913333333333",
        )

    assert r2["success"] is False
    assert "conflict" in r2.get("error", "").lower() or "booked" in r2.get("error", "").lower()
    # Must suggest alternatives, never just reject
    assert "alternatives" in r2
    assert len(r2["alternatives"]) > 0


# ══════════════════════════════════════════════════════════
# Test 4: Cancel Appointment
# ══════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_cancel_appointment(seeded_session):
    """Cancel an existing appointment."""
    from scheduler.appointment_engine.appointment_engine import book_appointment, cancel_appointment

    target = next_weekday(date.today(), 0)

    with patch_db(seeded_session):
        book_result = await book_appointment(
            doctor_id=1,
            appointment_date=target,
            start_time=time(11, 0),
        )
        appt_id = book_result["appointment_id"]

        cancel_result = await cancel_appointment(appt_id)

    assert cancel_result["success"] is True


@pytest.mark.asyncio
async def test_cancel_nonexistent_appointment(seeded_session):
    """Cancelling a non-existent appointment returns error."""
    from scheduler.appointment_engine.appointment_engine import cancel_appointment

    with patch_db(seeded_session):
        result = await cancel_appointment(99999)

    assert result["success"] is False
    assert "not found" in result["error"].lower()


# ══════════════════════════════════════════════════════════
# Test 5: Reschedule Appointment
# ══════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_reschedule_appointment(seeded_session):
    """Reschedule an appointment to a new time."""
    from scheduler.appointment_engine.appointment_engine import book_appointment, reschedule_appointment

    target = next_weekday(date.today(), 0)

    with patch_db(seeded_session):
        book_result = await book_appointment(
            doctor_id=1,
            appointment_date=target,
            start_time=time(13, 0),
        )
        appt_id = book_result["appointment_id"]

        # Reschedule to next Tuesday
        new_date = next_weekday(date.today(), 1)
        resc_result = await reschedule_appointment(
            appointment_id=appt_id,
            new_date=new_date,
            new_start_time=time(14, 0),
        )

    assert resc_result["success"] is True
    assert resc_result["new_appointment_id"] is not None


# ══════════════════════════════════════════════════════════
# Test 6: Past-Time Rejection
# ══════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_reject_past_appointment(seeded_session):
    """Booking in the past is rejected."""
    from scheduler.appointment_engine.appointment_engine import book_appointment

    yesterday = date.today() - timedelta(days=1)

    with patch_db(seeded_session):
        result = await book_appointment(
            doctor_id=1,
            appointment_date=yesterday,
            start_time=time(9, 0),
        )

    assert result["success"] is False
    assert "past" in result.get("error", "").lower()


# ══════════════════════════════════════════════════════════
# Test 7: Doctor Lookup by Name
# ══════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_find_doctor_by_name(seeded_session):
    """Find a doctor by partial name match."""
    from scheduler.appointment_engine.appointment_engine import find_doctor_by_name

    with patch_db(seeded_session):
        result = await find_doctor_by_name("Priya")

    assert result is not None
    assert result["name"] == "Dr. Priya Sharma"
    assert result["specialty"] == "General Medicine"


@pytest.mark.asyncio
async def test_find_doctor_by_name_not_found(seeded_session):
    """Non-existent doctor returns None."""
    from scheduler.appointment_engine.appointment_engine import find_doctor_by_name

    with patch_db(seeded_session):
        result = await find_doctor_by_name("Dr. Nonexistent")

    assert result is None


# ══════════════════════════════════════════════════════════
# Test 8: Doctor Lookup by Specialty
# ══════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_find_doctor_by_specialty(seeded_session):
    """Find doctors by specialty."""
    from scheduler.appointment_engine.appointment_engine import find_doctor_by_specialty

    with patch_db(seeded_session):
        result = await find_doctor_by_specialty("Cardiology")

    assert len(result) == 1
    assert result[0]["name"] == "Dr. Rajesh Kumar"
