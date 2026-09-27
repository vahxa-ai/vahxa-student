# Student AI Assistant — Setup Guide

## Quick Start

### 1. Backend (Python / FastAPI)

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # Edit with your keys
uvicorn app.main:app --reload
# API docs: http://localhost:8000/docs
```

### 2. Frontend (React)

```bash
cd frontend
npm install
npm start
# App: http://localhost:3000
```

---

## Configuration

### AI — Gemma 4 on Google Vertex AI
1. In a Google Cloud project with billing, enable the **Vertex AI API**
2. In Model Garden, open **Gemma 4 26B A4B IT (MaaS)** and enable it
3. Authenticate with Application Default Credentials:
   ```
   gcloud auth application-default login
   ```
   (or set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account key with the *Vertex AI User* role)
4. Add to `backend/.env`:
   ```
   VERTEX_PROJECT_ID=your-gcp-project-id
   VERTEX_LOCATION=global
   VERTEX_MODEL=google/gemma-4-26b-a4b-it-maas
   ```

---

## Database Migration (SQLite → PostgreSQL)

```bash
# 1. Install async PostgreSQL driver
pip install asyncpg

# 2. Update backend/.env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/student_aid

# 3. Run migrations
alembic upgrade head
```

---

## Project Structure

```
student_aid/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # REST endpoints
│   │   │   ├── student.py   # Student profile
│   │   │   ├── activities.py# Activity management
│   │   │   ├── subjects.py  # Subjects
│   │   │   ├── deadlines.py # Deadlines + AI reminders
│   │   │   └── schedule.py  # AI plan generation
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/
│   │   │   └── ai_service.py      # Gemma 4 (Vertex AI) integration
│   │   ├── core/config.py   # Settings from .env
│   │   ├── db/database.py   # SQLAlchemy async engine
│   │   └── main.py          # FastAPI app entrypoint
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── pages/           # Route-level page components
        ├── components/      # Reusable UI components
        ├── services/api.ts  # Axios API client
        ├── store/appStore.ts# Zustand global state
        └── types/index.ts   # TypeScript interfaces
```

---

## Features

- **Student Profile** — One student per app instance; set up on first launch
- **Activity Tracking** — School, sports, medical and hobby activities with recurrence
- **Academic Tracker** — Subjects, deadlines and AI-generated reminder plans
- **AI Schedule Generation** — Gemma 4 creates 1-day, multi-day or weekly plans around your daily routine
- **Conflict Detection** — AI identifies scheduling conflicts and suggests resolutions
