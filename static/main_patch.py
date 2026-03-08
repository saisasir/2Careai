"""
main.py — PATCH: Static file serving
-------------------------------------
Add this block to your existing main.py.
Place the StaticFiles mount AFTER all API routes to avoid shadowing them.

MERGE INSTRUCTIONS:
  1. Add the imports at the top of your existing main.py.
  2. Add the two mount/route lines after your existing route registrations,
     just before the if __name__ == "__main__" block (if present).
"""

# ── Add these imports to your existing import block ───────────────────────
from pathlib import Path

from fastapi import FastAPI  # already present — shown for context only
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# ── Add these lines after your existing app = FastAPI(...) and route setup ─

# Determine the directory containing this main.py file.
# Adjust BASE_DIR if your static folder lives elsewhere.
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

# Mount the entire static directory under /static.
# e.g., static/test_client.html → http://localhost:8000/static/test_client.html
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# Convenience: serve test_client.html directly at /test_client.html
# so the URL in the assignment spec works without the /static prefix.
@app.get("/test_client.html", include_in_schema=False)
async def serve_test_client():
    """Serve the WebSocket test client page directly at root level."""
    test_client_path = STATIC_DIR / "test_client.html"
    if not test_client_path.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="test_client.html not found in static/")
    return FileResponse(str(test_client_path), media_type="text/html")
