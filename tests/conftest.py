"""
Shared test fixtures — async SQLite in-memory engine, mocked Redis, sample data.
All tests run without Docker or external services.
"""

import asyncio
import json
import sys
import os
from datetime import date, time, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Ensure project root is in Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scheduler.appointment_engine.models import Base, Doctor, DoctorSchedule, Patient, Appointment


# ══════════════════════════════════════════════════════════
# Async Event Loop
# ══════════════════════════════════════════════════════════

@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for the whole test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ══════════════════════════════════════════════════════════
# SQLite In-Memory Async Engine
# ══════════════════════════════════════════════════════════

@pytest_asyncio.fixture
async def test_engine():
    """Create an async SQLite engine for isolated test runs."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    # SQLite needs SAVEPOINT support — enable it
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine):
    """Create a test database session."""
    factory = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with factory() as session:
        yield session


# ══════════════════════════════════════════════════════════
# Seed Data Fixtures
# ══════════════════════════════════════════════════════════

@pytest_asyncio.fixture
async def seeded_session(test_session):
    """Session pre-loaded with 3 doctors, schedules, and 1 patient."""
    session = test_session

    # ── Doctors ──────────────────────────────────────────
    dr_priya = Doctor(id=1, name="Dr. Priya Sharma", specialty="General Medicine")
    dr_rajesh = Doctor(id=2, name="Dr. Rajesh Kumar", specialty="Cardiology")
    dr_lakshmi = Doctor(id=3, name="Dr. Lakshmi Venkat", specialty="Dermatology")
    session.add_all([dr_priya, dr_rajesh, dr_lakshmi])

    # ── Schedules (Mon-Fri for Dr. Priya, Mon/Wed/Fri for Dr. Rajesh) ──
    # Note: SQLite doesn't support ARRAY, so we skip 'languages' for tests
    for day in range(5):  # Mon–Fri
        session.add(DoctorSchedule(
            doctor_id=1,
            day_of_week=day,
            start_time=time(9, 0),
            end_time=time(17, 0),
            slot_duration=30,
            is_active=True,
        ))

    for day in [0, 2, 4]:  # Mon, Wed, Fri
        session.add(DoctorSchedule(
            doctor_id=2,
            day_of_week=day,
            start_time=time(10, 0),
            end_time=time(16, 0),
            slot_duration=30,
            is_active=True,
        ))

    # ── Patient ──────────────────────────────────────────
    patient = Patient(
        id=1,
        name="Test Patient",
        phone="+919876543210",
        preferred_lang="en",
        preferred_doctor_id=1,
    )
    session.add(patient)

    await session.commit()
    yield session


# ══════════════════════════════════════════════════════════
# Mocked Redis Session Manager
# ══════════════════════════════════════════════════════════

class MockRedisSessionManager:
    """In-memory mock of RedisSessionManager for testing."""

    def __init__(self):
        self._store: dict[str, dict] = {}

    async def ping(self) -> bool:
        return True

    async def create_session(self, session_id: str, initial_data: dict) -> None:
        self._store[session_id] = initial_data.copy()

    async def get_session(self, session_id: str) -> dict | None:
        data = self._store.get(session_id)
        return data.copy() if data else None

    async def update_session(self, session_id: str, updates: dict) -> None:
        if session_id in self._store:
            self._store[session_id].update(updates)
        else:
            self._store[session_id] = updates.copy()

    async def append_conversation(self, session_id: str, turn: dict) -> None:
        if session_id not in self._store:
            self._store[session_id] = {"conversation_history": []}
        history = self._store[session_id].setdefault("conversation_history", [])
        history.append(turn)
        if len(history) > 20:
            self._store[session_id]["conversation_history"] = history[-20:]

    async def clear_session(self, session_id: str) -> None:
        self._store.pop(session_id, None)

    async def close(self) -> None:
        self._store.clear()


@pytest.fixture
def mock_redis():
    """Provide a MockRedisSessionManager instance."""
    return MockRedisSessionManager()


# ══════════════════════════════════════════════════════════
# Helper: next weekday from today
# ══════════════════════════════════════════════════════════

def next_weekday(start_date: date, weekday: int) -> date:
    """Return the next occurrence of a given weekday (0=Mon)."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)
