FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY . .

# Create non-root user for security
RUN addgroup --system careai && adduser --system --ingroup careai careai \
    && chown -R careai:careai /app
USER careai

# Expose port
EXPOSE 8000

# Run with production settings (no --reload, explicit workers)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--log-level", "warning", "--no-access-log"]
