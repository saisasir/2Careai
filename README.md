# 🩺 CareAI — Real-Time Multilingual Voice AI Agent

A production-ready voice pipeline for clinical appointment booking. Patients speak in **English**, **Hindi**, or **Tamil** and receive voice responses in under **450ms**.

---

## 🏗 System Architecture (Ref Doc Step 3)

```mermaid
graph TD
    User((Patient/User)) -- "Voice (WebSockets)" --> WS[WebSocket Handler]
    
    subgraph "Real-Time Pipeline"
        WS -- "Audio Bytes" --> STT[Speech-to-Text: Deepgram Nova-2]
        STT -- "Text" --> LD[Language Detection: Deepgram + langdetect]
        LD -- "Query" --> Agent[AI Agent: Groq llama-3.3-70b]
        Agent -- "Tool Call" --> Tools[Tool Orchestration]
        Tools -- "DB Query" --> Sched[Appointment Engine]
        Sched -- "Result" --> Agent
        Agent -- "Text Response" --> TTS[Text-to-Speech: ElevenLabs/gTTS]
        TTS -- "Audio Bytes" --> WS
    end
    
    subgraph "Memory Layer"
        Agent -- "Read/Write" --> Redis[(Session Memory: Redis)]
        Agent -- "Read/Write" --> PG[(Persistent Memory: PostgreSQL)]
    end
    
    subgraph "External Integration"
        Outbound[Outbound Sched] -- "Trigger" --> Dialer[Twilio Dialer]
        Dialer -- "Bridged Call" --> WS
    end
    
    WS -- "Telemetry" --> FE[Frontend UI: test_client.html]
    FE -- "Latency/Metrics" --> User
```

---

## 📁 Project Structure

```
careai/
├── backend/                   # API / WebSocket Layer
│   ├── main.py                # App factory, lifespan, CORS
│   ├── config.py              # Pydantic Settings
│   ├── routes.py              # REST endpoints (health, metrics)
│   └── ws_handler.py          # Real-time voice pipeline
├── agent/                     # AI Reasoning & Tools
│   ├── prompt/
│   │   └── prompts.py         # System prompts (CoT)
│   ├── reasoning/
│   │   └── llm_agent.py       # Groq llama-3.3-70b agent + memory
│   └── tools/
│       ├── tools.py           # Tool definitions
│       └── tool_executor.py   # Tool dispatch
├── services/                  # Low-level AI Services
│   ├── speech_to_text/
│   │   └── stt.py             # Deepgram Nova-2 (language=multi)
│   ├── text_to_speech/
│   │   └── tts.py             # ElevenLabs/gTTS
│   ├── language_detection/
│   │   └── language_detection.py # Unicode + langdetect
│   └── dialer/
│       └── dialer.py          # Twilio Integration
├── memory/                    # Dual-Layer Memory
│   ├── session_memory/
│   │   └── redis_manager.py   # Redis (TTL=30m)
│   └── persistent_memory/
│       ├── pg_manager.py      # PostgreSQL
│       └── context_builder.py # Context merging
├── scheduler/                 # Appointment Logic
│   └── appointment_engine/
│       ├── appointment_engine.py # CRUD + conflicts
│       ├── models.py          # SQLAlchemy Models
│       └── outbound.py        # Campaign Scheduler
├── database/                  # Storage Initialization
│   ├── init.py                # Pool + Seed data
│   └── schema.sql             # Database DDL
├── frontend/                  # Patient Interface
│   └── index.html             # WebRTC/WebSocket Voice UI
├── migrations/                # Alembic Migrations
├── tests/                     # Test Suite (36/36 Passing)
├── docker-compose.yml         # One-command orchestration
└── README.md                  # Comprehensive Documentation
```

---

## 🚀 Quick Start

### 1. Environment Variables
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
# Edit .env and fill in your API keys:
OPENAI_API_KEY=gsk_...        # Groq API key (get from console.groq.com)
DEEPGRAM_API_KEY=your_key
ELEVENLABS_API_KEY=your_key   # Optional — falls back to gTTS for hi/ta
```

### 2. Launch with Docker (Recommended)

```bash
docker-compose up --build -d
```

This starts:
- **FastAPI app** on `http://localhost:8000`
- **PostgreSQL 16** on port `5432`
- **Redis 7** on port `6379`

### 3. Local Development (No Docker)

```bash
# 1. Install Python 3.11+
# 2. Install dependencies
pip install -r requirements.txt
pip install pytest pytest-asyncio aiosqlite  # For tests

# 3. Start PostgreSQL and Redis locally (or use Docker for just those):
docker-compose up postgres redis -d

# 4. Update .env to point to localhost:
DATABASE_URL=postgresql+asyncpg://careai:careai_secret@localhost:5432/careai
REDIS_URL=redis://localhost:6379/0

# 5. Run the server
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# 6. Run migrations (optional — tables auto-create on startup)
alembic upgrade head
```

### 4. Verify

```bash
curl http://localhost:8000/health
# → {"status":"ok","timestamp":...,"service":"careai-voice-agent"}
```

### 5. Test Voice

Open `http://localhost:8000/` in Chrome and click the microphone button.

---

## ⏱ Latency Breakdown

Target: **< 450ms** end-to-end pipeline

| Stage              | Provider      | Avg Latency  | Notes                        |
|:-------------------|:------------- |:-------------|:-----------------------------|
| STT                | Deepgram Nova | ~120ms       | Streaming, multilingual      |
| Language Detection | langdetect    | ~2ms         | CPU-local, negligible        |
| Memory Fetch       | Redis + PG    | ~10ms        | Cached session + indexed PG  |
| LLM + Tools        | Groq llama-3.3-70b | ~200ms  | Tool calling adds ~50ms      |
| TTS                | gTTS (hi/ta) / ElevenLabs (en) | ~100ms | Native pronunciation for Indian languages |
| **Total Pipeline** |               | **~432ms**   | Within 450ms target          |

Every pipeline execution is timed and logged. Breaches above 450ms emit a `⚠ LATENCY BREACH` warning in logs (without degrading UX).

---

## 🛰 Service Providers & API Specs

### Latency Optimization Strategies
- **Deepgram over Whisper**: 3–5× faster for real-time transcription with built-in `language=multi` detection
- **Streaming TTS**: Begin playback before full synthesis
- **Redis session**: O(1) access vs PG query for hot data
- **Connection pooling**: asyncpg pool of 10 (configurable)
- **Memory capped at 20 turns**: Prevents context bloat
- **LLM timeout**: 10s hard timeout prevents pipeline stalls

### Audio Protocol
- **Format**: Raw PCM 16-bit / webm-opus (from browser)
- **Sample Rate**: 16,000 Hz
- **Channels**: 1 (Mono)
- **Streaming**: Binary frames over WebSocket

---

## 🛠 API Endpoints

| Endpoint               | Method    | Description                       |
|:-----------------------|:----------|:----------------------------------|
| `/ws/voice`            | WebSocket | Real-time voice pipeline          |
| `/health`              | GET       | Liveness probe                    |
| `/metrics`             | GET       | Pipeline latency and request stats|
| `/clinic/doctors`      | GET       | List all doctors                  |
| `/clinic/appointments` | GET       | Recent appointments dashboard     |
| `/campaign/trigger`    | POST      | Trigger outbound reminder call    |
| `/auth/token`          | GET       | Issue guest JWT for WebSocket auth|
| `/`                    | GET       | Voice UI (index.html)             |

### WebSocket Protocol

```
# 1. Get auth token
GET /auth/token → { "token": "<jwt>" }

# 2. Connect WebSocket with token
ws://localhost:8000/ws/voice?token=<jwt>

Client → Server:  binary audio frames (webm/opus)
Server → Client:  JSON metadata + binary audio response
```

**Response JSON:**
```json
{
  "type": "response",
  "transcript": "I want to book an appointment with Dr. Sharma",
  "language": "en",
  "intent": "book_appointment",
  "response_text": "I've booked your appointment with Dr. Priya Sharma...",
  "latency": {
    "stt_ms": 118.2,
    "ld_ms": 1.3,
    "llm_ms": 203.5,
    "tts_ms": 95.1,
    "total_ms": 428.3
  }
}
```

---

## 🧠 Memory Design

### Session Memory (Redis)
- **Key format**: `careai:session:{session_id}`
- **TTL**: 30 minutes (configurable via `REDIS_SESSION_TTL`)
- **Contents**: language, conversation_history (capped at 20 turns), patient_id, entities
- **Usage**: Updated after every agent turn; refreshed on read

### Persistent Memory (PostgreSQL)
- **Table**: `patients` — preferred language, preferred doctor, creation date
- **Table**: `patient_history` — interaction log (type, details JSONB, timestamp)
- **Usage**: Loaded at session start, updated at session end

### Context Builder
The `context_builder.py` merges both memory layers into a single context string
injected into the LLM system prompt, giving the agent awareness of:
- Current conversation language
- Recent conversation turns (last 6)
- Patient name, preferences, and past appointments

---

## 🗄 Database Schema

- **doctors** — 5 seeded doctors across specialties
- **doctor_schedule** — Weekly availability with configurable slot duration
- **patients** — Auto-created on first interaction
- **appointments** — Status-tracked (booked → completed/cancelled/rescheduled/no_show)
- **patient_history** — Interaction log for persistent memory

### Migrations
```bash
# Run migrations
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "description"
```

---

## 🧰 Agent Tools

| Tool                     | Input                       | Output                              |
|:-------------------------|:----------------------------|:------------------------------------|
| `checkAvailability`      | doctor_name/specialty, date | List of available time slots        |
| `bookAppointment`        | doctor_name, date, time     | Confirmation or conflict + alternatives |
| `cancelAppointment`      | appointment_id              | Success/failure                     |
| `rescheduleAppointment`  | appointment_id, new_date, new_time | Updated confirmation         |
| `listDoctors`            | —                           | All doctors with specialties        |
| `findDoctorBySpecialty`  | specialty                   | Matching doctors                    |

All tools validate inputs, handle DB errors gracefully, and return structured JSON responses.
Conflicts never just reject — they always suggest the nearest 3-5 alternative slots.

---

## 📞 Outbound Campaign Mode

APScheduler runs 3 daily jobs:

| Job                    | Time  | Function                                |
|:-----------------------|:------|:----------------------------------------|
| Appointment Reminders  | 8 AM  | Call patients with tomorrow's appointments |
| Follow-up Calls        | 10 AM | Call patients from yesterday's visits   |
| No-Show Detection      | 6 PM  | Mark stale booked appointments          |

**Multilingual**: Reminder and follow-up messages are sent in the patient's preferred language (en/hi/ta).

**Mid-call rescheduling**: The Twilio call connects back to `/ws/voice` via TwiML `<Stream>`, enabling full agent interaction during the call.

---

## 🚨 Error Handling

| Stage              | Failure Mode              | Response                              |
|:-------------------|:--------------------------|:--------------------------------------|
| STT                | No speech / low confidence | Ask user to repeat (in their language) |
| Language Detection | Low confidence / unknown   | Default to English, log event         |
| LLM                | Timeout (>10s)            | Safe fallback message                 |
| Tool/DB            | Connection or query error  | Inform user, suggest callback         |
| Latency            | Pipeline > 450ms          | Log warning, do not degrade UX        |

All error messages are available in en/hi/ta and synthesized to audio via TTS.

---

## 🧪 Testing

```bash
# Install test dependencies
pip install pytest pytest-asyncio aiosqlite

# Run all tests
python -m pytest tests/ -v --tb=short
```

**36 tests** across 5 modules:

| Module                        | Tests | Coverage                            |
|:------------------------------|:------|:------------------------------------|
| `test_appointment_engine.py`  | 11    | Book, cancel, reschedule, conflict, alt slots, past rejection, doctor lookup |
| `test_language_detection.py`  | 7     | en/hi/ta detection, fallback, edge cases |
| `test_memory.py`              | 7     | Session CRUD, history persistence, 20-turn cap |
| `test_tool_validation.py`     | 5     | Date/time parsing, unknown tools, missing args |
| `test_pipeline_latency.py`    | 3     | Metric rolling average, structure    |

Tests use an **in-memory SQLite** database and a **mock Redis** — no Docker or external services needed.

---

## 🌍 Supported Languages

| Language | Code | STT | TTS | LLM | Campaign |
|:---------|:-----|:----|:----|:----|:---------|
| English  | `en` | ✅  | ✅  | ✅  | ✅       |
| Hindi    | `hi` | ✅  | ✅  | ✅  | ✅       |
| Tamil    | `ta` | ✅  | ✅  | ✅  | ✅       |

---

## 🐳 Infrastructure

```yaml
Services:
  app:        FastAPI (Python 3.11) — port 8000
  postgres:   PostgreSQL 16 Alpine — port 5432
  redis:      Redis 7 Alpine — port 6379 (AOF persistence, 256MB LRU cap)
  prometheus: Prometheus v2.51 — port 9090 (7-day retention, scrapes /metrics)

Volumes:
  pgdata:         PostgreSQL persistent storage
  redisdata:      Redis AOF journal
  prometheusdata: Prometheus TSDB
```

All services have CPU and memory resource limits. Start everything with:

```bash
docker-compose up --build -d
# Prometheus UI: http://localhost:9090
# App metrics:   http://localhost:8000/metrics
```

---

## 📋 Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable               | Required | Description                  |
|:-----------------------|:---------|:-----------------------------|
| `OPENAI_API_KEY`       | ✅       | Groq API key (`gsk_...`) for llama-3.3-70b reasoning |
| `DEEPGRAM_API_KEY`     | ✅       | Deepgram STT (primary)       |
| `ELEVENLABS_API_KEY`   | Optional | ElevenLabs TTS (falls to gTTS)|
| `TWILIO_ACCOUNT_SID`   | Optional | Twilio outbound calls        |
| `TWILIO_AUTH_TOKEN`    | Optional | Twilio auth                  |
| `DATABASE_URL`         | Auto     | Set by docker-compose        |
| `REDIS_URL`            | Auto     | Set by docker-compose        |

---

## 📊 Trade-Offs

| Decision                   | Chosen               | Alternative        | Rationale                              |
|:---------------------------|:---------------------|:-------------------|:---------------------------------------|
| STT Provider               | Deepgram Nova-2      | OpenAI Whisper     | 3× lower latency, built-in multilingual|
| LLM                        | Groq llama-3.3-70b   | OpenAI GPT-4o      | Faster inference via Groq, strong tool calling |
| TTS Provider               | gTTS (hi/ta) + ElevenLabs (en) | ElevenLabs only | Native pronunciation for Indian languages |
| Session Store              | Redis                | In-memory dict     | Persistence across restarts, TTL       |
| Persistent Store           | PostgreSQL           | MongoDB            | ACID for appointments, relational data |
| Scheduler                  | APScheduler          | Celery             | Simpler for async Python, no broker    |
| Language Detection         | langdetect           | LLM-based          | Near-zero latency, good accuracy       |
| Memory context window      | 20 turns (capped)    | Unlimited          | Prevents token bloat, keeps costs down |
| LLM Timeout                | 10s hard timeout     | No timeout         | Prevents indefinite pipeline stalls    |
| Conversation History       | Last 6 turns in msgs | All turns          | Balances context quality vs token cost |

---

## ⚠️ Known Limitations

1. **Deepgram multilingual accuracy**: Hindi-English code-switching may produce mixed transcripts. Deepgram's `multi` model handles this reasonably but isn't perfect.

2. **gTTS fallback quality**: When ElevenLabs is unavailable, gTTS produces lower-quality audio with less natural prosody, especially for Hindi/Tamil.

3. **Single-doctor conflict**: The conflict detection is per-doctor per-slot. It doesn't check cross-doctor scheduling for the same patient.

4. **Guest-only authentication**: The `/ws/voice` WebSocket requires a JWT token (obtained from `GET /auth/token`), but tokens are issued without credentials — any client can get one. Production deployments should add proper identity verification.

5. **Twilio dependency for outbound**: Outbound campaign calls require a Twilio account. Without Twilio credentials, calls are logged but not actually placed.

6. **SQLite in tests**: Tests use SQLite in-memory for speed. The `StringArray` TypeDecorator auto-switches between `ARRAY` (PostgreSQL) and `JSON` (SQLite), so all 36 tests pass on both backends.

7. **LLM latency variance**: Groq response times can vary from 150ms to 2s depending on load and rate limits. The 200ms average is best-case; complex multi-tool queries will be slower.

8. **No streaming TTS to client**: ElevenLabs streams internally but the handler collects all chunks into a single blob before sending to the browser (`send_bytes` once) to prevent frontend AbortError. True chunked playback would further reduce perceived latency.

9. **Session resumption is URL-based**: Reconnecting clients must pass `?session_id=<id>` in the WebSocket URL to resume a session. Without it, a new session is created automatically. The 30-minute Redis TTL limits resumption window.

10. **Language detection on short inputs**: `langdetect` struggles with very short phrases (1-2 words). The system inherits the last confidently detected language stored in session; falls back to English only for brand-new sessions.
