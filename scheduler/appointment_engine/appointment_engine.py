"""
Appointment scheduling engine — availability checking, booking, cancellation,
rescheduling, and alternative slot suggestion with conflict detection.
"""

import logging
from datetime import date, time, datetime, timedelta
from typing import Optional

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database.init import get_db_session
from scheduler.appointment_engine.models import Appointment, DoctorSchedule, Doctor, Patient

logger = logging.getLogger("careai.scheduler")


async def check_availability(
    doctor_id: int,
    appointment_date: date,
    preferred_time: Optional[str] = None,
) -> dict:
    """
    Check if a doctor is available on a given date.

    Returns:
        {
            "available": bool,
            "slots": [{"start": "09:00", "end": "09:30"}, ...],
            "doctor_name": str,
            "date": str,
        }
    """
    async with get_db_session() as session:
        # Get doctor info
        doctor = await session.get(Doctor, doctor_id)
        if not doctor:
            return {"available": False, "error": "Doctor not found", "slots": []}

        # Get schedule for this day of week
        day_of_week = appointment_date.weekday()  # 0=Mon
        schedule_query = select(DoctorSchedule).where(
            and_(
                DoctorSchedule.doctor_id == doctor_id,
                DoctorSchedule.day_of_week == day_of_week,
                or_(DoctorSchedule.is_active == True, DoctorSchedule.is_active.is_(None)),
            )
        )
        result = await session.execute(schedule_query)
        schedules = result.scalars().all()

        if not schedules:
            return {
                "available": False,
                "doctor_name": doctor.name,
                "date": str(appointment_date),
                "slots": [],
                "message": f"Dr. {doctor.name} does not work on {appointment_date.strftime('%A')}s",
            }

        # Get existing appointments for this date
        appt_query = select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.appointment_date == appointment_date,
                Appointment.status.in_(["booked", "rescheduled"]),
            )
        )
        result = await session.execute(appt_query)
        existing_appts = result.scalars().all()

        # Generate available slots
        booked_times = {(a.start_time, a.end_time) for a in existing_appts}
        available_slots = []

        for sched in schedules:
            slot_start = datetime.combine(appointment_date, sched.start_time)
            slot_end_limit = datetime.combine(appointment_date, sched.end_time)
            duration = timedelta(minutes=sched.slot_duration)

            while slot_start + duration <= slot_end_limit:
                s_time = slot_start.time()
                e_time = (slot_start + duration).time()

                if (s_time, e_time) not in booked_times:
                    available_slots.append({
                        "start": s_time.strftime("%H:%M"),
                        "end": e_time.strftime("%H:%M"),
                    })

                slot_start += duration

        return {
            "available": len(available_slots) > 0,
            "doctor_name": doctor.name,
            "date": str(appointment_date),
            "slots": available_slots,
            "total_available": len(available_slots),
        }


async def book_appointment(
    doctor_id: int,
    appointment_date: date,
    start_time: time,
    patient_name: Optional[str] = None,
    patient_phone: Optional[str] = None,
    reason: Optional[str] = None,
    language: str = "en",
) -> dict:
    """
    Book an appointment after conflict checking.

    Returns:
        {"success": bool, "appointment_id": int, "details": {...}}
    """
    async with get_db_session() as session:
        # ── Past-time rejection (check first, before schedule lookup) ──
        appt_datetime_check = datetime.combine(appointment_date, start_time)
        if appt_datetime_check < datetime.now():
            return {
                "success": False,
                "error": "Cannot book an appointment in the past",
                "requested_time": appt_datetime_check.strftime("%Y-%m-%d %H:%M"),
            }

        # Get doctor
        doctor = await session.get(Doctor, doctor_id)
        if not doctor:
            return {"success": False, "error": "Doctor not found"}

        # Get slot duration from schedule
        day_of_week = appointment_date.weekday()
        sched_query = select(DoctorSchedule).where(
            and_(
                DoctorSchedule.doctor_id == doctor_id,
                DoctorSchedule.day_of_week == day_of_week,
                or_(DoctorSchedule.is_active == True, DoctorSchedule.is_active.is_(None)),
            )
        )
        result = await session.execute(sched_query)
        schedule = result.scalars().first()

        if not schedule:
            return {
                "success": False,
                "error": f"Dr. {doctor.name} is not available on {appointment_date.strftime('%A')}",
            }

        slot_duration = schedule.slot_duration
        appt_datetime = datetime.combine(appointment_date, start_time)
        end_time = (appt_datetime + timedelta(minutes=slot_duration)).time()

        # ── Conflict detection ────────────────────────────
        conflict_query = select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.appointment_date == appointment_date,
                Appointment.status.in_(["booked", "rescheduled"]),
                or_(
                    and_(
                        Appointment.start_time <= start_time,
                        Appointment.end_time > start_time,
                    ),
                    and_(
                        Appointment.start_time < end_time,
                        Appointment.end_time >= end_time,
                    ),
                ),
            )
        )
        result = await session.execute(conflict_query)
        conflicts = result.scalars().all()

        if conflicts:
            # Suggest alternatives
            alt_result = await suggest_alternatives(doctor_id, appointment_date, session)
            return {
                "success": False,
                "error": "Time slot already booked",
                "conflict_time": f"{start_time.strftime('%H:%M')} - {end_time.strftime('%H:%M')}",
                "alternatives": alt_result.get("slots", [])[:5],
            }

        # ── Create or find patient ────────────────────────
        patient_id = None
        if patient_phone:
            patient_query = select(Patient).where(Patient.phone == patient_phone)
            result = await session.execute(patient_query)
            patient = result.scalars().first()

            if not patient:
                patient = Patient(
                    name=patient_name or "Unknown",
                    phone=patient_phone,
                    preferred_lang=language,
                    preferred_doctor_id=doctor_id,
                )
                session.add(patient)
                await session.flush()

            patient_id = patient.id

        # ── Create appointment ────────────────────────────
        appointment = Appointment(
            patient_id=patient_id,
            doctor_id=doctor_id,
            appointment_date=appointment_date,
            start_time=start_time,
            end_time=end_time,
            status="booked",
            reason=reason,
            language_used=language,
        )
        session.add(appointment)
        await session.commit()

        return {
            "success": True,
            "appointment_id": appointment.id,
            "details": {
                "doctor": doctor.name,
                "specialty": doctor.specialty,
                "date": str(appointment_date),
                "time": f"{start_time.strftime('%H:%M')} - {end_time.strftime('%H:%M')}",
                "status": "booked",
            },
        }


async def cancel_appointment(appointment_id: int) -> dict:
    """Cancel an existing appointment."""
    async with get_db_session() as session:
        appointment = await session.get(Appointment, appointment_id)

        if not appointment:
            return {"success": False, "error": "Appointment not found"}

        if appointment.status == "cancelled":
            return {"success": False, "error": "Appointment is already cancelled"}

        appointment.status = "cancelled"
        appointment.updated_at = datetime.utcnow()
        await session.commit()

        doctor = await session.get(Doctor, appointment.doctor_id)

        return {
            "success": True,
            "message": f"Appointment with {doctor.name if doctor else 'doctor'} on "
                       f"{appointment.appointment_date} at {appointment.start_time.strftime('%H:%M')} "
                       f"has been cancelled.",
        }


async def reschedule_appointment(
    appointment_id: int,
    new_date: date,
    new_start_time: time,
) -> dict:
    """Reschedule an existing appointment to a new date/time."""
    async with get_db_session() as session:
        appointment = await session.get(Appointment, appointment_id)

        if not appointment:
            return {"success": False, "error": "Appointment not found"}

        if appointment.status not in ("booked", "rescheduled"):
            return {"success": False, "error": f"Cannot reschedule — status is '{appointment.status}'"}

        # Cancel old appointment
        appointment.status = "rescheduled"
        appointment.updated_at = datetime.utcnow()

        # Book new one
        doctor = await session.get(Doctor, appointment.doctor_id)
        result = await book_appointment(
            doctor_id=appointment.doctor_id,
            appointment_date=new_date,
            start_time=new_start_time,
            reason=appointment.reason,
            language=appointment.language_used,
        )

        if result["success"]:
            await session.commit()
            return {
                "success": True,
                "old_appointment_id": appointment_id,
                "new_appointment_id": result["appointment_id"],
                "details": result["details"],
                "message": f"Rescheduled to {new_date} at {new_start_time.strftime('%H:%M')} "
                           f"with {doctor.name if doctor else 'doctor'}",
            }
        else:
            await session.rollback()
            return result


async def suggest_alternatives(
    doctor_id: int,
    target_date: date,
    session: Optional[AsyncSession] = None,
) -> dict:
    """Suggest alternative available slots around the target date."""
    own_session = session is None

    if own_session:
        ctx = get_db_session()
        session = await ctx.__aenter__()

    try:
        alternatives = []
        # Check target date +/- 3 days
        for delta in range(-1, 4):
            check_date = target_date + timedelta(days=delta)
            if check_date < date.today():
                continue

            availability = await check_availability(doctor_id, check_date)
            if availability.get("available"):
                for slot in availability["slots"][:3]:  # Max 3 per day
                    alternatives.append({
                        "date": str(check_date),
                        "day": check_date.strftime("%A"),
                        **slot,
                    })

            if len(alternatives) >= 5:
                break

        return {
            "slots": alternatives[:5],
            "total_found": len(alternatives),
        }
    finally:
        if own_session:
            await ctx.__aexit__(None, None, None)


async def find_doctor_by_name(name: str) -> Optional[dict]:
    """Find a doctor by name with more flexible matching."""
    if not name:
        return None
        
    async with get_db_session() as session:
        # 1. Try exact or partial match first
        query = select(Doctor).where(Doctor.name.ilike(f"%{name}%"))
        result = await session.execute(query)
        doctor = result.scalars().first()
        
        if not doctor:
            # 2. Token-level prefix matching — handles STT errors like "Rajes" → "Rajesh"
            # and concatenated names like "PriyaSharma" → ["Priya", "Sharma"]
            query = select(Doctor)
            result = await session.execute(query)
            all_doctors = result.scalars().all()

            # Strip common prefixes from input (dr, dr., doctor)
            _STRIP = {'dr', 'dr.', 'doctor'}
            input_tokens = [t.lower() for t in name.split() if t.lower() not in _STRIP]

            # If input has no spaces (e.g. "PriyaSharma"), keep it as one token
            if not input_tokens:
                input_tokens = [name.lower()]

            def _token_match(it: str, dt: str) -> bool:
                return dt.startswith(it) or it.startswith(dt)

            for doc in all_doctors:
                doc_tokens = [t.lower() for t in doc.name.split() if t.lower() not in _STRIP]
                # Multi-token input: all tokens must match a distinct doc token
                if len(input_tokens) > 1:
                    matched = all(any(_token_match(it, dt) for dt in doc_tokens) for it in input_tokens)
                else:
                    # Single-token input (e.g. "Priyasharma"): check against concatenated doc name
                    doc_concat = "".join(doc_tokens)
                    it = input_tokens[0]
                    matched = doc_concat.startswith(it) or it.startswith(doc_concat) or \
                              any(_token_match(it, dt) for dt in doc_tokens)

                if matched:
                    doctor = doc
                    break

        if doctor:
            return {
                "id": doctor.id,
                "name": doctor.name,
                "specialty": doctor.specialty,
                "languages": doctor.languages,
            }
        return None


async def find_doctor_by_specialty(specialty: str) -> list[dict]:
    """Find doctors by specialty."""
    async with get_db_session() as session:
        query = select(Doctor).where(Doctor.specialty.ilike(f"%{specialty}%"))
        result = await session.execute(query)
        doctors = result.scalars().all()

        return [
            {
                "id": d.id,
                "name": d.name,
                "specialty": d.specialty,
                "languages": d.languages,
            }
            for d in doctors
        ]


async def list_doctors() -> list[dict]:
    """List all available doctors."""
    async with get_db_session() as session:
        query = select(Doctor).order_by(Doctor.name)
        result = await session.execute(query)
        doctors = result.scalars().all()

        return [
            {
                "id": d.id,
                "name": d.name,
                "specialty": d.specialty,
                "languages": d.languages,
            }
            for d in doctors
        ]
