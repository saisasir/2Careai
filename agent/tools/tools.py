"""
Tool definitions — OpenAI function-calling schema for appointment operations.
"""

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "checkAvailability",
            "description": "Check if a doctor is available on a specific date. Returns available time slots.",
            "parameters": {
                "type": "object",
                "properties": {
                    "doctor_name": {
                        "type": ["string", "null"],
                        "description": "Name of the doctor (partial match supported), e.g. 'Dr. Priya' or 'Sharma'",
                    },
                    "specialty": {
                        "type": ["string", "null"],
                        "description": "Medical specialty, e.g. 'Cardiology', 'General Medicine', 'Dermatology'",
                    },
                    "date": {
                        "type": ["string", "null"],
                        "description": "Appointment date in YYYY-MM-DD format",
                    },
                    "preferred_time": {
                        "type": ["string", "null"],
                        "description": "Preferred time in HH:MM format (24-hour), optional",
                    },
                },
                "required": ["date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "bookAppointment",
            "description": "Book an appointment with a doctor at a specific date and time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "doctor_name": {
                        "type": ["string", "null"],
                        "description": "Name of the doctor",
                    },
                    "date": {
                        "type": ["string", "null"],
                        "description": "Appointment date in YYYY-MM-DD format",
                    },
                    "time": {
                        "type": ["string", "null"],
                        "description": "Appointment start time in HH:MM format (24-hour)",
                    },
                    "patient_name": {
                        "type": ["string", "null"],
                        "description": "Patient's full name",
                    },
                    "patient_phone": {
                        "type": ["string", "null"],
                        "description": "Patient's phone number",
                    },
                    "reason": {
                        "type": ["string", "null"],
                        "description": "Reason for the appointment",
                    },
                },
                "required": ["doctor_name", "date", "time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "cancelAppointment",
            "description": "Cancel an existing appointment by its ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "appointment_id": {
                        "type": ["integer", "null"],
                        "description": "The appointment ID to cancel",
                    },
                },
                "required": ["appointment_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "rescheduleAppointment",
            "description": "Reschedule an existing appointment to a new date and time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "appointment_id": {
                        "type": ["integer", "null"],
                        "description": "The appointment ID to reschedule",
                    },
                    "new_date": {
                        "type": ["string", "null"],
                        "description": "New appointment date in YYYY-MM-DD format",
                    },
                    "new_time": {
                        "type": ["string", "null"],
                        "description": "New appointment start time in HH:MM format (24-hour)",
                    },
                },
                "required": ["appointment_id", "new_date", "new_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "listDoctors",
            "description": "List all available doctors with their specialties and supported languages.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "findDoctorBySpecialty",
            "description": "Find doctors by their medical specialty.",
            "parameters": {
                "type": "object",
                "properties": {
                    "specialty": {
                        "type": ["string", "null"],
                        "description": "Medical specialty to search for, e.g. 'Cardiology'",
                    },
                },
                "required": ["specialty"],
            },
        },
    },
]
