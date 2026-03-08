"""
outbound/outbound.py
--------------------
Outbound campaign scheduler.

KEY CHANGES vs partial implementation:
  1. Campaign-specific opening prompt with patient name + appointment details.
  2. Multilingual reminder message templates (en/hi/ta).
  3. Mid-call rescheduling by injecting campaign_mode into session context
     and routing audio through the same WebSocket voice pipeline.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent.prompts import build_campaign_opening
from memory.session_memory import SessionMemory

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Campaign session builder
# ─────────────────────────────────────────────────────────────────────────────

def build_campaign_session(
    patient: dict[str, Any],
    appointment: dict[str, Any],
    doctor: dict[str, Any],
    language: str,
) -> dict[str, Any]:
    """
    Build the initial Redis session payload for an outbound campaign call.

    Embeds:
    - campaign_mode flag so the LLM system prompt switches to campaign persona.
    - campaign_opening_message pre-rendered in the correct language.
    - Appointment context so mid-call rescheduling has all required IDs.
    - Empty conversation_history ready for multi-turn injection.
    """
    opening_message = build_campaign_opening(
        patient_name=patient["first_name"],
        hospital_name=appointment.get("hospital_name", "our clinic"),
        doctor_name=f"Dr. {doctor['last_name']}",
        appointment_date=appointment["date"],
        appointment_time=appointment["time"],
        language=language,
    )

    return {
        "session_id": str(uuid.uuid4()),
        "patient_id": str(patient["id"]),
        "language": language,
        "campaign_mode": True,
        "campaign_opening_message": opening_message,
        # Pre-loaded appointment context enables mid-call rescheduling
        # without the patient needing to repeat their appointment ID.
        "active_appointment_id": str(appointment["id"]),
        "active_appointment_date": appointment["date"],
        "active_appointment_time": appointment["time"],
        "active_doctor_id": str(doctor["id"]),
        "active_doctor_name": f"Dr. {doctor['last_name']}",
        # Conversation history starts empty; voice pipeline appends turns.
        "conversation_history": [],
        # Partial intent state cleared for fresh call.
        "pending_intent": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Campaign scheduler
# ─────────────────────────────────────────────────────────────────────────────

class OutboundCampaignScheduler:
    """
    Background task that queries upcoming appointments and seeds outbound
    campaign sessions in Redis.

    The actual call initiation (WebRTC dial-out / SIP) is handled by the
    telephony layer. This scheduler's sole responsibility is to:
      1. Find appointments needing reminders.
      2. Build campaign sessions in Redis.
      3. Enqueue call jobs for the telephony worker.

    Mid-call rescheduling works automatically because:
      - The campaign session contains the active appointment ID.
      - The WebSocket voice pipeline reads session context on every turn.
      - The LLM agent sees campaign_mode=true and uses campaign opening.
      - When patient says "reschedule", the agent finds appointment_id in
        session context and calls reschedule_appointment tool directly.
    """

    def __init__(
        self,
        redis_client: aioredis.Redis,
        db_session_factory,
        reminder_hours_before: int = 24,
        poll_interval_seconds: int = 300,   # Check every 5 minutes
    ):
        self.redis = redis_client
        self.db_session_factory = db_session_factory
        self.reminder_hours_before = reminder_hours_before
        self.poll_interval = poll_interval_seconds
        self._running = False

    async def start(self) -> None:
        """Start the background polling loop."""
        self._running = True
        logger.info(
            "Outbound campaign scheduler started. "
            "Polling every %ds, reminder window: %dh before appointment.",
            self.poll_interval,
            self.reminder_hours_before,
        )
        while self._running:
            try:
                await self._process_upcoming_appointments()
            except Exception as exc:
                logger.error("Campaign scheduler error: %s", exc, exc_info=True)
            await asyncio.sleep(self.poll_interval)

    async def stop(self) -> None:
        self._running = False
        logger.info("Outbound campaign scheduler stopped.")

    async def _process_upcoming_appointments(self) -> None:
        """Find appointments in the reminder window and seed campaign sessions."""
        now = datetime.now(timezone.utc)
        window_start = now
        window_end = now + timedelta(hours=self.reminder_hours_before)

        async with self.db_session_factory() as db:
            appointments = await self._fetch_upcoming_appointments(
                db, window_start, window_end
            )

        logger.info(
            "Campaign scheduler found %d appointments in reminder window.",
            len(appointments),
        )

        for appt in appointments:
            await self._seed_campaign_session(appt)

    async def _fetch_upcoming_appointments(
        self,
        db: AsyncSession,
        window_start: datetime,
        window_end: datetime,
    ) -> list[dict[str, Any]]:
        """
        Query appointments that:
          - Are confirmed (not cancelled/completed)
          - Have not already received a reminder today
          - Fall within the reminder window
        """
        # Import models here to avoid circular imports at module load time.
        # Adjust model import path to match your project layout.
        try:
            from scheduler.appointment_engine import Appointment, Doctor, Patient
        except ImportError:
            logger.warning("Could not import models — skipping campaign query.")
            return []

        result = await db.execute(
            select(Appointment, Doctor, Patient)
            .join(Doctor, Appointment.doctor_id == Doctor.id)
            .join(Patient, Appointment.patient_id == Patient.id)
            .where(
                Appointment.status == "confirmed",
                Appointment.reminder_sent == False,  # noqa: E712
                Appointment.appointment_datetime >= window_start,
                Appointment.appointment_datetime <= window_end,
            )
        )
        rows = result.fetchall()

        appointments = []
        for appt, doctor, patient in rows:
            appointments.append(
                {
                    "appointment": {
                        "id": appt.id,
                        "date": appt.appointment_datetime.strftime("%A, %B %d"),
                        "time": appt.appointment_datetime.strftime("%I:%M %p"),
                        "hospital_name": getattr(appt, "hospital_name", "our clinic"),
                    },
                    "doctor": {
                        "id": doctor.id,
                        "last_name": doctor.last_name,
                        "specialty": doctor.specialty,
                    },
                    "patient": {
                        "id": patient.id,
                        "first_name": patient.first_name,
                        "phone": patient.phone,
                        "preferred_language": getattr(
                            patient, "preferred_language", "en"
                        ),
                    },
                }
            )
        return appointments

    async def _seed_campaign_session(self, record: dict[str, Any]) -> None:
        """
        Build campaign session and store in Redis.
        Also enqueue a call job for the telephony worker.
        """
        patient = record["patient"]
        appointment = record["appointment"]
        doctor = record["doctor"]
        language = patient.get("preferred_language", "en")

        session_data = build_campaign_session(
            patient=patient,
            appointment=appointment,
            doctor=doctor,
            language=language,
        )

        session_id = session_data["session_id"]
        session_key = f"session:{session_id}"

        # Store in Redis with 2-hour TTL (call should complete well before then).
        await self.redis.set(
            session_key,
            __import__("json").dumps(session_data, ensure_ascii=False),
            ex=7200,
        )

        # Enqueue call job. The telephony worker reads this queue and dials out.
        # Payload contains session_id so worker can load context from Redis.
        call_job = {
            "session_id": session_id,
            "patient_id": str(patient["id"]),
            "phone": patient["phone"],
            "language": language,
            "campaign_type": "appointment_reminder",
        }
        await self.redis.lpush(
            "outbound_call_queue",
            __import__("json").dumps(call_job),
        )

        logger.info(
            "Campaign session seeded: session_id=%s patient=%s language=%s",
            session_id,
            patient["id"],
            language,
        )

        # Mark appointment as reminder_sent to prevent duplicate calls.
        await self._mark_reminder_sent(record["appointment"]["id"])

    async def _mark_reminder_sent(self, appointment_id) -> None:
        """Mark appointment so it is not reminded again."""
        try:
            from scheduler.appointment_engine import Appointment

            async with self.db_session_factory() as db:
                appt = await db.get(Appointment, appointment_id)
                if appt:
                    appt.reminder_sent = True
                    await db.commit()
        except Exception as exc:
            logger.error(
                "Failed to mark appointment %s as reminder_sent: %s",
                appointment_id,
                exc,
            )
