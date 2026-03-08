# Deployment Guide

## Prerequisites

- Docker Desktop installed and running
- Git
- API keys (see Environment Variables below)

---

## Quick Start (Docker — Recommended)

```bash
# 1. Clone the repository
git clone <repo-url>
cd careai

# 2. Copy and fill environment variables
cp .env.example .env
# Edit .env with your API keys (see below)

# 3. Start all services
docker compose up -d --build

# 4. Open the voice agent UI
open http://localhost:8000
```

Services started:
| Service | Port | URL |
|---------|------|-----|
| Voice Agent API | 8000 | http://localhost:8000 |
| PostgreSQL | 5432 | Internal |
| Redis | 6379 | Internal |
| Prometheus | 9090 | http://localhost:9090 |

---

## Environment Variables

Edit `.env` before starting:

```env
# ── Required API Keys ──────────────────────────────────
DEEPGRAM_API_KEY=<your-deepgram-key>     # STT - https://deepgram.com
OPENAI_API_KEY=<your-groq-key>           # LLM - https://console.groq.com (use Groq key here)
ELEVENLABS_API_KEY=<your-elevenlabs-key> # TTS (optional - gTTS fallback works without it)

# ── Twilio (Outbound Campaigns - Optional) ─────────────
TWILIO_ACCOUNT_SID=<your-twilio-sid>
TWILIO_AUTH_TOKEN=<your-twilio-token>
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX

# ── Security (Change in production!) ───────────────────
JWT_SECRET=<random-32-char-string>

# ── LLM Settings ───────────────────────────────────────
LLM_MODEL=llama-3.3-70b-versatile
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_TEMPERATURE=0.1
LLM_MAX_TOKENS=512
```

---

## Local Development (Without Docker)

### Backend

```bash
# Python 3.11+ required
pip install -r requirements.txt

# Start PostgreSQL and Redis (via Docker or local install)
docker compose up postgres redis -d

# Run the FastAPI server
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Admin Dashboard (Next.js)

```bash
# Node.js 18+ required
npm install
npm run dev
# Opens at http://localhost:3000
```

---

## Running Tests

```bash
# Run all tests (requires running PostgreSQL for some tests)
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=. --cov-report=html

# Run just unit tests (no DB required)
pytest tests/test_language_detection.py tests/test_pipeline_latency.py -v
```

---

## Stopping Services

```bash
docker compose down

# To also remove stored data (appointments, sessions)
docker compose down -v
```

---

## Production Considerations

1. **Change JWT_SECRET** to a random 32+ character string
2. **Set CORS_ORIGINS** to your actual domain
3. **Use HTTPS** (add nginx reverse proxy with SSL)
4. **Enable DEBUG=false** (already default)
5. **Scale horizontally** with `docker compose up --scale app=3` (requires Redis-backed sessions — already implemented)
