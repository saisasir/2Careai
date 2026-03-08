"""
REST routes — health check, metrics, and appointment REST fallback.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, field_validator
from typing import Optional
from backend.security import limiter, decode_access_token, create_access_token
import time

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)

# ── In-memory metrics store (replaced by Prometheus in Phase 7) ──────
_metrics: dict = {
    "total_requests": 0,
    "avg_latency_ms": 0.0,
    "pipeline_stages": {
        "stt_avg_ms": 0.0,
        "llm_avg_ms": 0.0,
        "tts_avg_ms": 0.0,
    },
    "active_sessions": 0,
}


def update_metrics(stt_ms: float, llm_ms: float, tts_ms: float):
    """Update rolling average metrics."""
    _metrics["total_requests"] += 1
    total = stt_ms + llm_ms + tts_ms
    n = _metrics["total_requests"]
    _metrics["avg_latency_ms"] = (
        (_metrics["avg_latency_ms"] * (n - 1) + total) / n
    )
    _metrics["pipeline_stages"]["stt_avg_ms"] = (
        (_metrics["pipeline_stages"]["stt_avg_ms"] * (n - 1) + stt_ms) / n
    )
    _metrics["pipeline_stages"]["llm_avg_ms"] = (
        (_metrics["pipeline_stages"]["llm_avg_ms"] * (n - 1) + llm_ms) / n
    )
    _metrics["pipeline_stages"]["tts_avg_ms"] = (
        (_metrics["pipeline_stages"]["tts_avg_ms"] * (n - 1) + tts_ms) / n
    )


# ── Auth dependency ───────────────────────────────────────

def require_auth(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return decode_access_token(credentials.credentials)


# ── Request models ────────────────────────────────────────

class CampaignTriggerRequest(BaseModel):
    phone: str
    campaign_type: str = "reminder"

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        import re
        v = v.strip()
        if not re.match(r"^\+?[1-9]\d{6,14}$", v):
            raise ValueError("Invalid phone number format")
        return v


class AppointmentCreateRequest(BaseModel):
    patient_name: str
    patient_phone: str
    doctor_id: int
    appointment_date: str   # YYYY-MM-DD
    start_time: str         # HH:MM
    language_used: str = "en"
    notes: Optional[str] = None


class AppointmentUpdateRequest(BaseModel):
    action: str             # cancel | reschedule | complete
    new_date: Optional[str] = None
    new_time: Optional[str] = None


# ── Routes ────────────────────────────────────────────────

@router.get("/auth/token")
async def get_auth_token():
    """Issue a guest JWT for WebSocket and API access (demo / assignment use)."""
    token = create_access_token({"sub": "guest", "role": "client"})
    return {"token": token, "token_type": "bearer"}


@router.get("/health")
async def health_check():
    """Basic liveness probe."""
    return {
        "status": "ok",
        "timestamp": time.time(),
        "service": "careai-voice-agent",
    }


@router.get("/metrics", dependencies=[Depends(require_auth)])
@limiter.limit("30/minute")
async def metrics(request: Request):
    """Pipeline latency and request metrics."""
    return _metrics


@router.post("/campaign/trigger", dependencies=[Depends(require_auth)])
@limiter.limit("10/minute")
async def trigger_campaign(request: Request, body: CampaignTriggerRequest):
    """Trigger an outbound reminder call."""
    from services.dialer.dialer import trigger_outbound_call
    call_sid = await trigger_outbound_call(body.phone, "This is a reminder for your clinical appointment.")
    return {"status": "triggered", "call_sid": call_sid}


@router.get("/clinic/doctors")
@limiter.limit("60/minute")
async def get_doctors(request: Request):
    """Fetch all doctors for the UI roster."""
    from database.init import get_db_session
    from scheduler.appointment_engine.models import Doctor
    from sqlalchemy import select
    async with get_db_session() as session:
        result = await session.execute(select(Doctor))
        doctors = result.scalars().all()
        return [{"id": d.id, "name": d.name, "specialty": d.specialty, "languages": d.languages} for d in doctors]


@router.get("/clinic/appointments", dependencies=[Depends(require_auth)])
@limiter.limit("60/minute")
async def get_appointments(request: Request):
    """Fetch recent appointments for the clinic dashboard."""
    from database.init import get_db_session
    from scheduler.appointment_engine.models import Appointment, Doctor, Patient
    from sqlalchemy import select
    async with get_db_session() as session:
        query = (
            select(Appointment, Doctor.name.label("doctor_name"), Patient.name.label("patient_name"))
            .join(Doctor, Appointment.doctor_id == Doctor.id)
            .outerjoin(Patient, Appointment.patient_id == Patient.id)
            .order_by(Appointment.created_at.desc())
            .limit(10)
        )
        result = await session.execute(query)
        data = []
        for appt, doc_name, pat_name in result.all():
            data.append({
                "id": appt.id,
                "patient": pat_name or "Guest",
                "doctor": doc_name,
                "date": str(appt.appointment_date),
                "time": appt.start_time.strftime("%H:%M"),
                "status": appt.status
            })
        return data


@router.post("/clinic/appointments", dependencies=[Depends(require_auth)])
@limiter.limit("30/minute")
async def create_appointment(request: Request, body: AppointmentCreateRequest):
    """Create a new appointment via the REST API (used by admin dashboard)."""
    from datetime import date as date_type, time as time_type
    from scheduler.appointment_engine.appointment_engine import book_appointment
    try:
        appt_date = date_type.fromisoformat(body.appointment_date)
        appt_time = time_type.fromisoformat(body.start_time)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date/time format: {e}")
    result = await book_appointment(
        doctor_id=body.doctor_id,
        appointment_date=appt_date,
        start_time=appt_time,
        patient_name=body.patient_name,
        patient_phone=body.patient_phone,
        reason=body.notes,
        language=body.language_used,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Booking failed"))
    return result


@router.patch("/clinic/appointments/{appointment_id}", dependencies=[Depends(require_auth)])
@limiter.limit("30/minute")
async def update_appointment(request: Request, appointment_id: int, body: AppointmentUpdateRequest):
    """Cancel, reschedule, or complete an appointment (used by admin dashboard)."""
    from scheduler.appointment_engine.appointment_engine import (
        cancel_appointment, reschedule_appointment
    )
    if body.action == "cancel":
        result = await cancel_appointment(appointment_id)
    elif body.action == "reschedule":
        if not body.new_date or not body.new_time:
            raise HTTPException(status_code=400, detail="new_date and new_time required for reschedule")
        from datetime import date as date_type, time as time_type
        try:
            new_date = date_type.fromisoformat(body.new_date)
            new_time = time_type.fromisoformat(body.new_time)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid date/time format: {e}")
        result = await reschedule_appointment(appointment_id, new_date, new_time)
    elif body.action == "complete":
        from database.init import get_db_session
        from scheduler.appointment_engine.models import Appointment
        async with get_db_session() as session:
            appt = await session.get(Appointment, appointment_id)
            if not appt:
                raise HTTPException(status_code=404, detail="Appointment not found")
            appt.status = "completed"
            await session.commit()
            result = {"success": True, "id": appointment_id, "status": "completed"}
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {body.action}")

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Update failed"))
    return result
