# 🎓 Student AI Assistant

An AI-powered personal planner for a single student — activities, subjects, deadlines, AI-generated daily/weekly schedules and deadline reminders, all driven by Google's open **Gemma 4** model on Vertex AI.

---

## Architecture

```mermaid
graph TB
    subgraph Client["🖥️ Frontend (React 18 + TypeScript)"]
        direction TB
        UI["Pages\nDashboard · Activities · Academic Tracker\nAI Schedule · Profile · Settings"]
        Store["Zustand Store\n(student profile)"]
        AxiosClient["Axios API Client\n/services/api.ts"]
        UI <--> Store
        UI --> AxiosClient
    end

    subgraph Server["⚙️ Backend (FastAPI + Python)"]
        direction TB
        API["REST API\nfastapi · uvicorn"]

        subgraph Routes["API Routes"]
            R1["/student"]
            R2["/activities"]
            R3["/subjects"]
            R4["/deadlines"]
            R5["/schedule"]
        end

        subgraph Services["Services"]
            AI["ai_service.py\nPlan prompt builder\nDeadline reminders"]
        end

        ORM["SQLAlchemy ORM (async)"]
        API --> Routes
        Routes --> Services
        Routes --> ORM
    end

    subgraph Data["🗄️ Data Layer"]
        DB[("SQLite\nstudent_aid.db\n─────────────\nstudent\nactivities\nsubjects\ndeadlines")]
    end

    subgraph External["☁️ External Services"]
        VERTEX["Google Vertex AI\nGemma 4 26B (serverless)\nOpenAI-compatible API"]
    end

    AxiosClient -->|"HTTP/JSON"| API
    ORM -->|"aiosqlite"| DB
    AI -->|"Chat completion"| VERTEX

    style Client fill:#EEF2FF,stroke:#6366F1,color:#1e1b4b
    style Server fill:#F0FDF4,stroke:#22C55E,color:#14532d
    style Data fill:#FFF7ED,stroke:#F97316,color:#7c2d12
    style External fill:#FDF4FF,stroke:#A855F7,color:#3b0764
```

---

## Data Model

Each app instance belongs to one student, so records carry no owner ID.

```mermaid
erDiagram
    STUDENT {
        int id PK
        string name
        int age
        string school
        string grade
        string timezone
        text default_prompt
    }
    ACTIVITY {
        int id PK
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
        string name
        enum difficulty
        enum homework_frequency
        int homework_duration_minutes
        string class_days
        date exam_date
    }
    DEADLINE {
        int id PK
        int subject_id FK
        string title
        enum deadline_type
        date due_date
        bool completed
    }

    SUBJECT ||--o{ DEADLINE : "has"
```

---

## Feature Overview

| Feature | Description |
|---------|-------------|
| 🎓 **Student Profile** | Name, age, school and grade — set once on first launch, used to personalise every plan |
| 🕒 **Daily Routine** | Morning / school / after-school / evening timeframes the AI builds plans around |
| 📋 **Activity Tracking** | School, sports, medical and hobby activities with recurrence; one-time **special events** highlighted |
| 📚 **Academic Tracker** | Subjects (difficulty, homework frequency, exam dates) and deadlines with AI-generated reminder plans |
| 🤖 **AI Schedule** | Gemma 4 builds a 1-day, multi-day or weekly plan with study sessions, relax time and conflict detection |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Zustand, React Router |
| Backend | FastAPI, SQLAlchemy (async), Pydantic v2 |
| Database | SQLite (dev) → PostgreSQL-ready (one env-var swap) |
| AI | **Gemma 4 26B A4B** on Google Vertex AI (serverless MaaS), auth via Application Default Credentials |
| Markdown | react-markdown + remark-gfm (table support) |

---

## Quick Start

**1. Backend**
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env     # set VERTEX_PROJECT_ID
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

On first launch the app asks for the student's profile; everything else hangs off it.

**3. Connect Vertex AI (Gemma 4)**

1. In your Google Cloud project, enable the Vertex AI API and enable **Gemma 4 26B A4B IT (MaaS)** in Model Garden.
2. Authenticate locally (or set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account key with the *Vertex AI User* role):
   ```bash
   gcloud auth application-default login
   ```
3. Set your project in `backend/.env`:
   ```
   VERTEX_PROJECT_ID=your-gcp-project-id
   ```

Without credentials the app still runs and returns placeholder plans.

---

## Migrating to PostgreSQL

Change one line in `backend/.env`:
```bash
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/student_aid
```
Then install the async driver and run:
```bash
pip install asyncpg
# Restart the server — tables are created automatically via SQLAlchemy
```

---

## Project Structure

```
student_aid/
├── backend/
│   ├── app/
│   │   ├── api/routes/        # student · activities · subjects · deadlines · schedule
│   │   ├── models/models.py   # SQLAlchemy ORM models
│   │   ├── schemas/schemas.py # Pydantic request/response schemas
│   │   ├── services/
│   │   │   └── ai_service.py        # Gemma 4 via Vertex AI — plan generation, deadline reminders
│   │   ├── core/config.py     # Settings loaded from .env
│   │   ├── db/database.py     # Async SQLAlchemy engine
│   │   └── main.py            # FastAPI app + CORS
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── pages/             # Dashboard · Activities · StudyPlanner (Academic Tracker)
        │                      # Schedule · Profile · Settings
        ├── components/
        │   ├── layout/        # Sidebar · Layout (loads profile, onboarding)
        │   └── profile/       # ProfileForm
        ├── services/api.ts    # Typed Axios client
        ├── store/appStore.ts  # Zustand global state
        └── types/index.ts     # TypeScript interfaces
```
