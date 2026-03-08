"""
PostgreSQL persistent memory — patient preferences, history, and long-term context.
"""

import logging
from typing import Optional
from sqlalchemy import select

from database.init import get_db_session
from scheduler.appointment_engine.models import Patient, PatientHistory, Appointment, Doctor

logger = logging.getLogger("careai.pg_memory")


class PGPersistentMemory:
    """Manages long-term patient data in PostgreSQL."""

    async def get_patient_context(self, patient_id: Optional[int]) -> dict:
        """
        Retrieve patient's persistent context for LLM injection.

        Returns:
            {
                "patient_name": str,
                "preferred_language": str,
                "preferred_doctor": str,
                "past_appointments": [...],
                "interaction_count": int,
            }
        """
        if not patient_id:
            return {}

        async with get_db_session() as session:
            patient = await session.get(Patient, patient_id)
            if not patient:
                return {}

            # Get past appointments
            appt_query = (
                select(Appointment, Doctor)
                .join(Doctor, Appointment.doctor_id == Doctor.id)
                .where(Appointment.patient_id == patient_id)
                .order_by(Appointment.created_at.desc())
                .limit(5)
            )
            result = await session.execute(appt_query)
            past_appts = []
            for appt, doc in result.all():
                past_appts.append({
                    "id": appt.id,
                    "doctor": doc.name,
                    "specialty": doc.specialty,
                    "date": str(appt.appointment_date),
                    "time": appt.start_time.strftime("%H:%M"),
                    "status": appt.status,
                })

            # Get preferred doctor name
            pref_doc_name = None
            if patient.preferred_doctor_id:
                pref_doc = await session.get(Doctor, patient.preferred_doctor_id)
                pref_doc_name = pref_doc.name if pref_doc else None

            # Count total interactions
            hist_query = select(PatientHistory).where(
                PatientHistory.patient_id == patient_id
            )
            result = await session.execute(hist_query)
            interaction_count = len(result.scalars().all())

            return {
                "patient_name": patient.name,
                "preferred_language": patient.preferred_lang,
                "preferred_doctor": pref_doc_name,
                "past_appointments": past_appts,
                "interaction_count": interaction_count,
            }

    async def save_patient_prefs(
        self,
        patient_id: int,
        language: Optional[str] = None,
        preferred_doctor_id: Optional[int] = None,
    ) -> None:
        """Update patient preferences."""
        async with get_db_session() as session:
            patient = await session.get(Patient, patient_id)
            if not patient:
                return

            if language:
                patient.preferred_lang = language
            if preferred_doctor_id:
                patient.preferred_doctor_id = preferred_doctor_id

            await session.commit()
            logger.info(f"Updated preferences for patient {patient_id}")

    async def log_interaction(
        self,
        patient_id: int,
        interaction_type: str,
        details: dict,
    ) -> None:
        """Log a patient interaction for history tracking."""
        async with get_db_session() as session:
            history = PatientHistory(
                patient_id=patient_id,
                interaction_type=interaction_type,
                details=details,
            )
            session.add(history)
            await session.commit()
            logger.debug(f"Logged {interaction_type} for patient {patient_id}")

    async def find_patient_by_phone(self, phone: str) -> Optional[dict]:
        """Find a patient by phone number."""
        async with get_db_session() as session:
            query = select(Patient).where(Patient.phone == phone)
            result = await session.execute(query)
            patient = result.scalars().first()

            if patient:
                return {
                    "id": patient.id,
                    "name": patient.name,
                    "phone": patient.phone,
                    "preferred_lang": patient.preferred_lang,
                }
            return None
