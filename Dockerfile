# Single Cloud Run image: FastAPI backend that also serves the built React frontend.

# ─── 1. Build the frontend ────────────────────────────────────────────────────
FROM node:24-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Same-origin API: the backend serves both the app and /api
ENV REACT_APP_API_URL=/api
RUN npm run build

# ─── 2. Backend runtime ───────────────────────────────────────────────────────
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    DEBUG=false \
    FRONTEND_DIST=/app/frontend_dist
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY --from=frontend /frontend/build ./frontend_dist

RUN useradd --create-home --uid 10001 appuser
USER appuser

# Cloud Run sets $PORT; trust its proxy headers so redirects keep https
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips="*"
