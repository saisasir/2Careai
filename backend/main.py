"""
FastAPI application factory — mounts routes, WebSocket, and lifespan events.
"""

import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.config import get_settings
from backend.security import limiter
from backend.routes import router as api_router
from backend.ws_handler import voice_ws_endpoint
from database.init import init_database, close_database
from memory.session_memory.redis_manager import RedisSessionManager
from scheduler.appointment_engine.outbound import init_outbound_scheduler, shutdown_outbound_scheduler

settings = get_settings()

# ── Logging ───────────────────────────────────────────────
class _JsonFormatter(logging.Formatter):
    """Emit log records as single-line JSON for log aggregators."""
    import json as _json

    def format(self, record: logging.LogRecord) -> str:
        import json
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)

_handler = logging.StreamHandler()
_handler.setFormatter(_JsonFormatter())
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.WARNING),
    handlers=[_handler],
)
logger = logging.getLogger("careai")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("🚀  Starting CareAI Voice Agent...")

    # Initialize database pool + tables + seed data
    await init_database()
    logger.info("✅  Database ready")

    # Warm up Redis connection
    redis_mgr = RedisSessionManager()
    await redis_mgr.ping()
    logger.info("✅  Redis ready")

    # Start outbound campaign scheduler
    await init_outbound_scheduler()
    logger.info("✅  Outbound scheduler ready")

    logger.info("✅  CareAI Voice Agent is live")
    yield

    # Shutdown
    logger.info("🛑  Shutting down...")
    await shutdown_outbound_scheduler()
    await close_database()
    await redis_mgr.close()
    logger.info("👋  Goodbye")


def create_app() -> FastAPI:
    """Build and return the FastAPI application."""
    app = FastAPI(
        title="CareAI — Multilingual Voice Agent",
        description="Real-time multilingual voice AI for clinical appointment booking",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    # ── Rate limiting ─────────────────────────────────────
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── CORS ──────────────────────────────────────────────
    allowed_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )

    # ── Security headers ──────────────────────────────────
    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(self)"
        return response

    # ── Request size limit ────────────────────────────────
    @app.middleware("http")
    async def limit_request_size(request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > settings.max_request_size:
            return JSONResponse(status_code=413, content={"detail": "Request body too large"})
        return await call_next(request)

    # ── REST routes ───────────────────────────────────────
    app.include_router(api_router)

    # ── WebSocket endpoint ────────────────────────────────
    app.websocket("/ws/voice")(voice_ws_endpoint)

    # ── Serve frontend ────────────────────────────────────
    def _serve_frontend():
        html_path = Path(__file__).parent.parent / "frontend" / "index.html"
        if html_path.exists():
            return HTMLResponse(content=html_path.read_text(encoding="utf-8"))
        return HTMLResponse(content=f"<h1>Frontend not found at {html_path}</h1>", status_code=404)

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def serve_root():
        return _serve_frontend()

    @app.get("/test_client.html", response_class=HTMLResponse, include_in_schema=False)
    async def serve_test_client():
        return _serve_frontend()

    return app


# Main app instance used by uvicorn
app = create_app()
