# Family AI Assistant — Setup Guide

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

### Free AI — Groq (Llama 3.3-70b)
1. Sign up at https://console.groq.com (free, no credit card)
2. Create an API key
3. Add to `backend/.env`:
   ```
   GROQ_API_KEY=gsk_your_key_here
   ```

### Google Calendar (Optional)
1. Go to https://console.cloud.google.com
2. Create project → Enable **Google Calendar API**
3. Create **OAuth 2.0 Web Application** credentials
4. Add redirect URI: `http://localhost:8000/api/calendar/oauth/callback`
5. Add to `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

---

## Database Migration (SQLite → PostgreSQL)

```bash
# 1. Install async PostgreSQL driver
pip install asyncpg

# 2. Update backend/.env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/family_aid

# 3. Run migrations
alembic upgrade head
```

---

## Project Structure

```
family_aid/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # REST endpoints
│   │   │   ├── family.py    # Family & member CRUD
│   │   │   ├── activities.py# Activity management
│   │   │   ├── schedule.py  # AI schedule generation
│   │   │   └── calendar.py  # Google Calendar sync
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── ai_service.py      # Groq LLM integration
│   │   │   └── calendar_service.py# Google Calendar API
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

- **Family Management** — Add parents, students, guardians with color coding
- **Activity Tracking** — School, sports, family events with recurrence
- **AI Schedule Generation** — Llama 3.3-70b creates daily schedules per member or whole family
- **Google Calendar Sync** — Push activities to Google Calendar via OAuth
- **Conflict Detection** — AI identifies scheduling conflicts and suggests resolutions
- **Student Planning** — Protects homework time, handles school + sports schedules

## Free LLM Options

| Provider | Model | Free Tier |
|----------|-------|-----------|
| **Groq** (recommended) | Llama 3.3-70b | 14,400 req/day |
| Ollama (local) | Any | Unlimited (local GPU) |
| HuggingFace | Various | Limited |
| Google Gemini | Gemini 1.5 Flash | 15 req/min |

To use Ollama instead of Groq, change `ai_service.py` to call `http://localhost:11434/api/chat`.
