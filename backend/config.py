"""
Centralized configuration — loads all secrets from .env via pydantic-settings.
"""

from typing import Optional
from pydantic import ConfigDict
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Server ────────────────────────────────────────────
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_external_url: str = ""  # e.g. "https://your-ngrok-url.ngrok-free.app"
    debug: bool = False
    log_level: str = "warning"

    # ── Security ──────────────────────────────────────────
    # Comma-separated list of allowed CORS origins (e.g. "https://app.example.com,https://admin.example.com")
    cors_origins: str = "http://localhost:3000"
    # Secret for signing JWT tokens (must be set in production)
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60
    # Max request body size in bytes (10 MB)
    max_request_size: int = 10_485_760

    # ── Database ──────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://careai:careai_secret@postgres:5432/careai"
    database_url_sync: str = "postgresql://careai:careai_secret@postgres:5432/careai"
    postgres_user: str = "careai"
    postgres_password: str = "careai_secret"
    postgres_db: str = "careai"

    # ── Redis ─────────────────────────────────────────────
    redis_url: str = "redis://redis:6379/0"
    redis_session_ttl: int = 1800  # 30 minutes

    # ── API Keys ──────────────────────────────────────────
    deepgram_api_key: str = ""
    groq_api_key: str = ""
    elevenlabs_api_key: str = ""

    # ── TTS Voice IDs (ElevenLabs) ────────────────────────
    elevenlabs_voice_en: str = "21m00Tcm4TlvDq8ikWAM"
    elevenlabs_voice_hi: str = "21m00Tcm4TlvDq8ikWAM"
    elevenlabs_voice_ta: str = "21m00Tcm4TlvDq8ikWAM"  # Default

    # --- Twilio (Outbound Dialer) ---
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # ── LLM ───────────────────────────────────────────────
    llm_model: str = "llama-3.3-70b-versatile"
    llm_base_url: Optional[str] = None
    llm_temperature: float = 0.3
    llm_max_tokens: int = 1024


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
