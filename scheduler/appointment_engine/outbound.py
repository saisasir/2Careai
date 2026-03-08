"""
Outbound campaign scheduler — appointment reminders and follow-up calls.
Uses APScheduler for background task management.
Supports multilingual opening prompts and mid-call rescheduling via full agent pipeline.
"""

import logging
from datetime import date, datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select, and_

from database.init import get_db_session
from scheduler.appointment_engine.models import Appointment, Doctor, Patient
from services.dialer.dialer import trigger_outbound_call
from agent.prompt.prompts import CAMPAIGN_OPENING_PROMPTS

logger = logging.getLogger("careai.outbound")

# Global scheduler instance
_scheduler: AsyncIOScheduler = None


async def init_outbound_scheduler():
    """Initialize and start the outbound campaign scheduler."""
    global _scheduler
    _scheduler = AsyncIOScheduler()

    # ── Job 1: Appointment reminders (24h before) ─────────
    _scheduler.add_job(
        send_appointment_reminders,
        CronTrigger(hour=8, minute=0),  # Run daily at 8 AM
        id="daily_reminders",
        name="24h Appointment Reminders",
        replace_existing=True,
    )

    # ── Job 2: Follow-up calls (1 day after) ──────────────
    _scheduler.add_job(
        send_followup_calls,
        CronTrigger(hour=10, minute=0),  # Run daily at 10 AM
        id="daily_followups",
        name="Post-Appointment Follow-ups",
        replace_existing=True,
    )

    # ── Job 3: No-show detection ──────────────────────────
    _scheduler.add_job(
        detect_no_shows,
        CronTrigger(hour=18, minute=0),  # Run daily at 6 PM
        id="no_show_detection",
        name="No-Show Detection",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info("Outbound campaign scheduler started with 3 jobs")


async def shutdown_outbound_scheduler():
    """Gracefully shut down scheduler."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        logger.info("Outbound scheduler stopped")


def _build_reminder_message(patient: Patient, doctor: Doctor, appt: Appointment) -> str:
    """
    Build a multilingual reminder message using campaign opening prompts.
    Selects language based on patient's preferred language.
    """
    lang = patient.preferred_lang if patient else "en"
    template = CAMPAIGN_OPENING_PROMPTS.get(lang, CAMPAIGN_OPENING_PROMPTS["en"])

    return template.format(
        patient_name=patient.name if patient else "Patient",
        doctor_name=doctor.name if doctor else "your doctor",
        date=appt.appointment_date.strftime("%B %d, %Y"),
        time=appt.start_time.strftime("%H:%M"),
    )


async def send_appointment_reminders():
    """
    Find appointments scheduled for tomorrow and trigger reminder calls.
    Uses the campaign-specific opening prompt with pre-filled context
    (patient name, appointment details) in the patient's preferred language.
    The outbound call connects to the same /ws/voice pipeline, enabling
    natural mid-call rescheduling via the full agent.
    """
    tomorrow = date.today() + timedelta(days=1)

    async with get_db_session() as session:
        query = (
            select(Appointment, Doctor, Patient)
            .join(Doctor, Appointment.doctor_id == Doctor.id)
            .outerjoin(Patient, Appointment.patient_id == Patient.id)
            .where(
                and_(
                    Appointment.appointment_date == tomorrow,
                    Appointment.status == "booked",
                )
            )
        )
        result = await session.execute(query)
        appointments = result.all()

        for appt, doctor, patient in appointments:
            phone = patient.phone if (patient and patient.phone) else None
            if not phone:
                logger.warning(
                    f"Skipping reminder for appointment {appt.id} — no phone number"
                )
                continue

            # Build multilingual reminder with campaign opening prompt
            message = _build_reminder_message(patient, doctor, appt)

            logger.info(
                f"📞 TRIGGERING REMINDER CALL: appt_id={appt.id} "
                f"phone={phone} lang={patient.preferred_lang if patient else 'en'}"
            )
            await trigger_outbound_call(phone, message)

        logger.info(
            f"Processed {len(appointments)} appointment reminders for {tomorrow}"
        )


async def send_followup_calls():
    """
    Find appointments from yesterday and queue follow-up calls.
    Uses multilingual templates based on patient's preferred language.
    """
    yesterday = date.today() - timedelta(days=1)

    # Follow-up message templates
    followup_templates = {
        "en": (
            "Hi {patient_name}, we hope your session with Dr. {doctor_name} went well. "
            "We would love to get your feedback on the care provided."
        ),
        "hi": (
            "नमस्ते {patient_name}, हमें उम्मीद है कि Dr. {doctor_name} के साथ आपका सत्र अच्छा रहा। "
            "हमें आपकी प्रतिक्रिया जानकर खुशी होगी।"
        ),
        "ta": (
            "வணக்கம் {patient_name}, Dr. {doctor_name} உடன் உங்கள் சந்திப்பு நன்றாக இருந்திருக்கும் என நம்புகிறோம். "
            "உங்கள் கருத்துகளை அறிய விரும்புகிறோம்."
        ),
    }

    async with get_db_session() as session:
        query = (
            select(Appointment, Doctor, Patient)
            .join(Doctor, Appointment.doctor_id == Doctor.id)
            .outerjoin(Patient, Appointment.patient_id == Patient.id)
            .where(
                and_(
                    Appointment.appointment_date == yesterday,
                    Appointment.status == "completed",
                )
            )
        )
        result = await session.execute(query)
        appointments = result.all()

        for appt, doctor, patient in appointments:
            phone = patient.phone if (patient and patient.phone) else None
            if not phone:
                continue

            lang = patient.preferred_lang if patient else "en"
            template = followup_templates.get(lang, followup_templates["en"])
            message = template.format(
                patient_name=patient.name if patient else "Patient",
                doctor_name=doctor.name if doctor else "your doctor",
            )

            logger.info(f"📞 TRIGGERING FOLLOW-UP: appt_id={appt.id} phone={phone}")
            await trigger_outbound_call(phone, message)

        logger.info(
            f"Processed {len(appointments)} follow-up calls for {yesterday}"
        )


async def detect_no_shows():
    """
    Mark past appointments that are still 'booked' as 'no_show'.
    """
    today = date.today()

    async with get_db_session() as session:
        query = select(Appointment).where(
            and_(
                Appointment.appointment_date < today,
                Appointment.status == "booked",
            )
        )
        result = await session.execute(query)
        stale_appts = result.scalars().all()

        for appt in stale_appts:
            appt.status = "no_show"
            appt.updated_at = datetime.utcnow()

        if stale_appts:
            await session.commit()
            logger.info(f"Marked {len(stale_appts)} past appointments as no-show")
