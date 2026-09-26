# 🏠 Family AI Assistant

An AI-powered family scheduling and planning app — daily schedules, student study plans, Google Calendar sync, and weekly reports, all driven by a **free** LLM (Llama 3.3-70b via Groq).

---

## Architecture

```mermaid
graph TB
    subgraph Client["🖥️ Frontend (React 18 + TypeScript)"]
        direction TB
        UI["Pages\nDashboard · Family · Activities\nSchedule · Study Plan · Reports · Calendar"]
        Store["Zustand Store\n(active family, members)"]
        AxiosClient["Axios API Client\n/services/api.ts"]
        UI <--> Store
        UI --> AxiosClient
    end

    subgraph Server["⚙️ Backend (FastAPI + Python)"]
        direction TB
        API["REST API\nfastapi · uvicorn"]

        subgraph Routes["API Routes"]
            R1["/families  /members"]
            R2["/activities"]
            R3["/subjects"]
            R4["/schedules  /reports"]
            R5["/study-plans"]
            R6["/calendar"]
        end

        subgraph Services["Services"]
            AI["ai_service.py\nPrompt builder\nSchedule · Report\nStudy Plan"]
            CAL["calendar_service.py\nOAuth flow\nEvent sync"]
        end

        ORM["SQLAlchemy ORM (async)"]
        API --> Routes
        Routes --> Services
        Routes --> ORM
    end

    subgraph Data["🗄️ Data Layer"]
        DB[("SQLite\nfamily_aid.db\n─────────────\nfamilies\nfamily_members\nactivities\nsubjects\ngenerated_schedules\nstudy_plans\ngoogle_calendar_tokens")]
    end

    subgraph External["☁️ External Services"]
        GROQ["Groq API (Free)\nLlama 3.3-70b\nconsole.groq.com"]
        GCAL["Google Calendar API\nOAuth 2.0"]
    end

    AxiosClient -->|"HTTP/JSON"| API
    ORM -->|"aiosqlite"| DB
    AI -->|"Chat completion"| GROQ
    CAL -->|"REST"| GCAL

    style Client fill:#EEF2FF,stroke:#6366F1,color:#1e1b4b
    style Server fill:#F0FDF4,stroke:#22C55E,color:#14532d
    style Data fill:#FFF7ED,stroke:#F97316,color:#7c2d12
    style External fill:#FDF4FF,stroke:#A855F7,color:#3b0764
```

---

## Data Model

```mermaid
erDiagram
    FAMILY {
        int id PK
        string name
        string timezone
    }
    FAMILY_MEMBER {
        int id PK
        int family_id FK
        string name
        enum role
        int age
        string school
        string grade
        string color
    }
    ACTIVITY {
        int id PK
        int member_id FK
        string title
        enum activity_type
        date start_date
        date end_date
        time start_time
        int duration_minutes
        enum recurrence
        bool is_special
    }
    SUBJECT {
        int id PK
        int member_id FK
        string name
        enum difficulty
        enum homework_frequency
        int homework_duration_minutes
        string class_days
        date exam_date
    }
    GENERATED_SCHEDULE {
        int id PK
        int family_id FK
        int member_id FK
        date schedule_date
        date schedule_end_date
        time start_time
        time end_time
        string location
        text content
        text custom_prompt
    }
    STUDY_PLAN {
        int id PK
        int member_id FK
        date week_start
        text content
    }
    GOOGLE_CALENDAR_TOKEN {
        int id PK
        int family_id FK
        text access_token
        text refresh_token
        string calendar_id
    }

    FAMILY ||--o{ FAMILY_MEMBER : "has"
    FAMILY_MEMBER ||--o{ ACTIVITY : "has"
    FAMILY_MEMBER ||--o{ SUBJECT : "enrolled in"
    FAMILY_MEMBER ||--o{ GENERATED_SCHEDULE : "has"
    FAMILY_MEMBER ||--o{ STUDY_PLAN : "has"
    FAMILY ||--o{ GOOGLE_CALENDAR_TOKEN : "connected to"
```

---

## Feature Overview

| Feature | Description |
|---------|-------------|
| 👨‍👩‍👧 **Family Management** | Multiple families, color-coded members (parent / student / guardian) |
| 📋 **Activity Tracking** | School, sports, family events with recurrence; one-time **special events** highlighted |
| 🤖 **AI Schedule Generator** | Llama 3.3-70b creates hour-by-hour daily/multi-day schedules with conflict detection |
| 📚 **Student Study Plan** | Per-student weekly study timetable (tabular) aware of subjects, sports, exams, and relax time |
| 📊 **Reports** | AI-generated daily and weekly schedule reports — printable / PDF-ready |
| 📅 **Google Calendar Sync** | OAuth 2.0 — push activities to Google Calendar, view upcoming events |
| 🔧 **Custom Prompt** | Paste your daily routine as a prompt; AI optimizes the schedule around it |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Zustand, React Router |
| Backend | FastAPI, SQLAlchemy (async), Pydantic v2 |
| Database | SQLite (dev) → PostgreSQL-ready (one env-var swap) |
| AI | **Groq free API** — Llama 3.3-70b-versatile |
| Calendar | Google Calendar API v3, OAuth 2.0 |
| Markdown | react-markdown + remark-gfm (table support) |

---

## Quick Start

**1. Backend**
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env     # fill in GROQ_API_KEY
uvicorn app.main:app --reload
# API docs → http://localhost:8000/docs
```

**2. Frontend**
```bash
cd frontend
npm install
npm start
# App → http://localhost:3000
```

**3. Get a free Groq API key**

Sign up at [console.groq.com](https://console.groq.com) — no credit card required.
Add the key to `backend/.env`:
```
GROQ_API_KEY=gsk_...
```

---

## Migrating to PostgreSQL

Change one line in `backend/.env`:
```bash
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/family_aid
```
Then install the async driver and run:
```bash
pip install asyncpg
# Restart the server — tables are created automatically via SQLAlchemy
```

---

## Project Structure

```
family_aid/
├── backend/
│   ├── app/
│   │   ├── api/routes/        # family · activities · subjects · schedule · study_plan · calendar
│   │   ├── models/models.py   # SQLAlchemy ORM models
│   │   ├── schemas/schemas.py # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── ai_service.py        # Groq LLM — schedule, report, study plan
│   │   │   └── calendar_service.py  # Google Calendar OAuth + sync
│   │   ├── core/config.py     # Settings loaded from .env
│   │   ├── db/database.py     # Async SQLAlchemy engine
│   │   └── main.py            # FastAPI app + CORS
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── pages/             # Dashboard · Family · Activities · Schedule
        │                      # StudyPlan · Reports · Calendar · Settings
        ├── components/
        │   ├── layout/        # Sidebar (family switcher) · Layout
        │   ├── family/        # MemberCard · MemberForm
        │   └── schedule/      # ScheduleViewer · StudyPlanViewer
        ├── services/api.ts    # Typed Axios client
        ├── store/appStore.ts  # Zustand global state
        └── types/index.ts     # TypeScript interfaces
```
