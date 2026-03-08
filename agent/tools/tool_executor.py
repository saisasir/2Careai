"""
Tool executor — dispatches LLM tool calls to actual scheduler functions.
"""

import json
import logging
from datetime import date, time, datetime
from typing import Optional

from scheduler.appointment_engine.appointment_engine import (
    check_availability,
    book_appointment,
    cancel_appointment,
    reschedule_appointment,
    find_doctor_by_name,
    find_doctor_by_specialty,
    list_doctors,
)

logger = logging.getLogger("careai.tool_exec")


def _parse_date(date_str: str) -> date:
    """Parse a date string in YYYY-MM-DD format."""
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def _parse_time(time_str: str) -> time:
    """Parse a time string in HH:MM format."""
    return datetime.strptime(time_str, "%H:%M").time()


async def execute_tool(tool_name: str, arguments: dict, language: str = "en") -> str:
    """
    Execute a tool call and return the result as a JSON string.
    """
    if arguments is None:
        arguments = {}
    
    logger.info(f"Executing tool: {tool_name} with args: {arguments}")

    try:
        if tool_name == "checkAvailability":
            return await _exec_check_availability(arguments)

        elif tool_name == "bookAppointment":
            return await _exec_book_appointment(arguments, language)

        elif tool_name == "cancelAppointment":
            return await _exec_cancel_appointment(arguments)

        elif tool_name == "rescheduleAppointment":
            return await _exec_reschedule_appointment(arguments)

        elif tool_name == "listDoctors":
            return await _exec_list_doctors()

        elif tool_name == "findDoctorBySpecialty":
            return await _exec_find_by_specialty(arguments)

        else:
            return json.dumps({"error": f"Unknown tool: {tool_name}"})

    except Exception as e:
        logger.error(f"Tool execution error ({tool_name}): {e}", exc_info=True)
        return json.dumps({"error": f"Tool execution failed: {str(e)}"})


async def _exec_check_availability(args: dict) -> str:
    """Execute checkAvailability tool."""
    if "date" not in args:
        return json.dumps({"error": "Missing required 'date' argument for availability check."})
        
    try:
        appt_date = _parse_date(args["date"])
    except Exception as e:
        return json.dumps({"error": f"Invalid date format: {args.get('date')}. Use YYYY-MM-DD."})

    # Resolve doctor by name or specialty
    doctor_id = await _resolve_doctor_id(
        args.get("doctor_name"),
        args.get("specialty"),
    )

    if not doctor_id:
        # If no specific doctor, find by specialty
        if args.get("specialty"):
            doctors = await find_doctor_by_specialty(args["specialty"])
            if doctors:
                results = []
                for doc in doctors:
                    avail = await check_availability(doc["id"], appt_date, args.get("preferred_time"))
                    avail["doctor_id"] = doc["id"]
                    results.append(avail)
                return json.dumps({"doctors_availability": results})
            return json.dumps({"error": f"No doctors found for specialty: {args.get('specialty')}"})

        return json.dumps({"error": "Please specify a doctor name or specialty"})

    result = await check_availability(doctor_id, appt_date, args.get("preferred_time"))
    result["doctor_id"] = doctor_id
    return json.dumps(result, default=str)


async def _exec_book_appointment(args: dict, language: str) -> str:
    """Execute bookAppointment tool."""
    doctor_id = await _resolve_doctor_id(args.get("doctor_name"))
    if not doctor_id:
        return json.dumps({"error": f"Doctor not found: {args.get('doctor_name')}"})

    if "date" not in args or "time" not in args:
        return json.dumps({"error": "Missing required 'date' or 'time' for booking."})

    try:
        appt_date = _parse_date(args["date"])
        appt_time = _parse_time(args["time"])
    except Exception as e:
        return json.dumps({"error": f"Invalid date/time format. Use YYYY-MM-DD and HH:MM."})

    result = await book_appointment(
        doctor_id=doctor_id,
        appointment_date=appt_date,
        start_time=appt_time,
        patient_name=args.get("patient_name"),
        patient_phone=args.get("patient_phone"),
        reason=args.get("reason"),
        language=language,
    )
    return json.dumps(result, default=str)


async def _exec_cancel_appointment(args: dict) -> str:
    """Execute cancelAppointment tool."""
    result = await cancel_appointment(args["appointment_id"])
    return json.dumps(result, default=str)


async def _exec_reschedule_appointment(args: dict) -> str:
    """Execute rescheduleAppointment tool."""
    result = await reschedule_appointment(
        appointment_id=args["appointment_id"],
        new_date=_parse_date(args["new_date"]),
        new_start_time=_parse_time(args["new_time"]),
    )
    return json.dumps(result, default=str)


async def _exec_list_doctors() -> str:
    """Execute listDoctors tool."""
    doctors = await list_doctors()
    return json.dumps({"doctors": doctors})


async def _exec_find_by_specialty(args: dict) -> str:
    """Execute findDoctorBySpecialty tool."""
    doctors = await find_doctor_by_specialty(args["specialty"])
    if doctors:
        return json.dumps({"doctors": doctors})
    return json.dumps({"error": f"No doctors found for specialty: {args['specialty']}"})


async def _resolve_doctor_id(
    name: Optional[str] = None,
    specialty: Optional[str] = None,
) -> Optional[int]:
    """Resolve a doctor name/specialty to a doctor ID."""
    if name:
        doctor = await find_doctor_by_name(name)
        if doctor:
            return doctor["id"]

    if specialty:
        doctors = await find_doctor_by_specialty(specialty)
        if doctors:
            return doctors[0]["id"]

    return None
