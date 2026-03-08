# 2Care.ai API Reference

## Base URL
```
http://localhost:8000
```

---

## Authentication

All protected endpoints require a Bearer JWT token.

### Get Auth Token
```http
GET /auth/token
```
**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

---

## Health & Metrics

### Health Check
```http
GET /health
```
**Response:**
```json
{ "status": "ok", "timestamp": 1772962695.6, "service": "careai-voice-agent" }
```

### Pipeline Metrics
```http
GET /metrics
Authorization: Bearer <token>
```
**Response:**
```json
{
  "total_requests": 142,
  "avg_latency_ms": 387.4,
  "pipeline_stages": {
    "stt_avg_ms": 118.2,
    "llm_avg_ms": 203.5,
    "tts_avg_ms": 98.7
  },
  "active_sessions": 3
}
```

---

## Voice WebSocket

### Connect
```
ws://localhost:8000/ws/voice?token=<jwt>&session_id=<id>&language=<auto|en|hi|ta>
```

**Query params:**
| Param | Required | Description |
|-------|----------|-------------|
| token | Yes | JWT from /auth/token |
| session_id | No | Resume existing session |
| language | No | Force language (default: auto) |

**Client → Server (binary):** Raw audio bytes (webm/opus from browser mic)

**Client → Server (JSON, barge-in):**
```json
{ "type": "control", "action": "stop" }
```

**Server → Client (JSON - transcript):**
```json
{
  "type": "transcript",
  "transcript": "Book appointment with cardiologist tomorrow",
  "session_id": "abc123"
}
```

**Server → Client (JSON - response):**
```json
{
  "type": "response",
  "transcript": "Book appointment with cardiologist tomorrow",
  "language": "en",
  "language_source": "stt",
  "intent": "check_availability",
  "response_text": "I found Dr. Priya Sharma (Cardiology). She has slots at 10:00 AM and 2:00 PM tomorrow. Which do you prefer?",
  "session_id": "abc123",
  "latency": {
    "stt_ms": 121.3,
    "ld_ms": 0.8,
    "llm_ms": 198.4,
    "tts_ms": 94.2,
    "total_ms": 414.7
  }
}
```

**Server → Client (binary):** MP3 audio bytes of TTS response

**Error codes:**
| Code | Meaning |
|------|---------|
| 4001 | Missing auth token |
| 4003 | Invalid/expired token |

---

## Clinic Endpoints

### List Doctors
```http
GET /clinic/doctors
```
**Response:**
```json
[
  {
    "id": 1,
    "name": "Dr. Priya Sharma",
    "specialty": "Cardiology",
    "languages": ["en", "hi"]
  }
]
```

### List Appointments
```http
GET /clinic/appointments
Authorization: Bearer <token>
```
**Response:**
```json
[
  {
    "id": 42,
    "patient": "Rajesh Kumar",
    "doctor": "Dr. Priya Sharma",
    "date": "2026-03-09",
    "time": "10:00",
    "status": "booked"
  }
]
```

---

## Outbound Campaigns

### Trigger Campaign Call
```http
POST /campaign/trigger
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "+919876543210",
  "campaign_type": "reminder"
}
```
**campaign_type values:** `reminder`, `followup`, `confirmation`

**Response:**
```json
{ "status": "triggered", "call_sid": "CA1234..." }
```

---

## Agent Tools (Internal — called by LLM)

| Tool | Args | Description |
|------|------|-------------|
| checkAvailability | date, doctor_name?, specialty? | Returns available time slots |
| bookAppointment | doctor_name, date, time, patient_name?, phone? | Creates booking |
| cancelAppointment | appointment_id | Cancels booking |
| rescheduleAppointment | appointment_id, new_date, new_time | Reschedules |
| listDoctors | — | Returns all doctors |
| findDoctorBySpecialty | specialty | Finds doctors by specialty |
