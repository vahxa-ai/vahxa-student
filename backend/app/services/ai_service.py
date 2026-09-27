"""
AI plan generation and deadline reminders using Gemma 4 on Google Vertex AI.
Falls back gracefully if Vertex AI credentials are not configured.
"""
import asyncio
import json
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Optional

import google.auth
import httpx
from google.auth.exceptions import DefaultCredentialsError
from google.auth.transport.requests import Request as GoogleAuthRequest

from app.core.config import settings
from app.models.models import Student, Activity, Subject, CurriculumUnit


def _format_time(t: Optional[time]) -> str:
    if t is None:
        return "TBD"
    return t.strftime("%I:%M %p").lstrip("0")


def _activity_on(act: Activity, d: date) -> bool:
    hit = False
    if act.start_date and act.end_date:
        hit = act.start_date <= d <= act.end_date
    elif act.start_date:
        hit = act.start_date == d
    if act.recurrence.value != "none" and act.recurrence_days:
        hit = d.strftime("%a") in act.recurrence_days
    return hit


def _describe_student(student: Student) -> str:
    desc = student.name
    details = []
    if student.age:
        details.append(f"age {student.age}")
    if student.grade and student.school:
        details.append(f"{student.grade} at {student.school}")
    elif student.grade or student.school:
        details.append(student.grade or student.school)
    return f"{desc} ({', '.join(details)})" if details else desc


_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_credentials = None
_project_id: Optional[str] = None


def _load_credentials() -> bool:
    """Load credentials once — the configured key file, else Application Default Credentials.
    Returns False if no credentials or project are available."""
    global _credentials, _project_id
    if _credentials is None:
        try:
            if settings.google_credentials_file:
                key_path = Path(settings.google_credentials_file)
                if not key_path.is_absolute():
                    key_path = _BACKEND_DIR / key_path
                _credentials, adc_project = google.auth.load_credentials_from_file(str(key_path), scopes=_SCOPES)
            else:
                _credentials, adc_project = google.auth.default(scopes=_SCOPES)
        except DefaultCredentialsError:
            return False
        _project_id = settings.vertex_project_id or adc_project
    return bool(_project_id)


def _vertex_configured() -> bool:
    return _load_credentials()


async def _access_token() -> str:
    if not _credentials.valid:
        # google-auth refresh is blocking; keep it off the event loop
        await asyncio.to_thread(_credentials.refresh, GoogleAuthRequest())
    return _credentials.token


def _chat_completions_url() -> str:
    loc = settings.vertex_location
    host = "aiplatform.googleapis.com" if loc == "global" else f"{loc}-aiplatform.googleapis.com"
    return f"https://{host}/v1/projects/{_project_id}/locations/{loc}/endpoints/openapi/chat/completions"


async def _call_llm(prompt: str, max_tokens: int = 2048) -> str:
    """Call Gemma 4 on Vertex AI through its OpenAI-compatible Chat Completions endpoint."""
    payload = {
        "model": settings.vertex_model,
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful student planning assistant. Generate well-organized, practical output using markdown.",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
        "max_tokens": max_tokens,
    }
    headers = {"Authorization": f"Bearer {await _access_token()}"}
    async with httpx.AsyncClient(timeout=180) as client:
        response = await client.post(_chat_completions_url(), json=payload, headers=headers)
    if response.is_error:
        raise RuntimeError(f"Vertex AI request failed ({response.status_code}): {response.text[:500]}")
    return response.json()["choices"][0]["message"]["content"]


def _build_plan_prompt(
    student: Student,
    start_date: date,
    end_date: Optional[date],
    start_time: Optional[time],
    end_time: Optional[time],
    location: Optional[str],
    activities: list[Activity],
    subjects: list[Subject],
    relax_minutes: int,
    include_study: bool,
    custom_prompt: Optional[str],
    additional_notes: Optional[str],
) -> str:
    days = []
    d = start_date
    end = end_date if (end_date and end_date > start_date) else start_date
    while d <= end:
        days.append(d)
        d += timedelta(days=1)

    is_multi = len(days) > 1
    date_label = (
        f"{start_date.strftime('%B %d')} – {end.strftime('%B %d, %Y')}"
        if is_multi else start_date.strftime("%A, %B %d, %Y")
    )

    # Per-day activity summary for context
    day_contexts = []
    for d in days:
        acts = []
        for act in activities:
            if _activity_on(act, d):
                tag = " ⚠️SPECIAL" if act.is_special else ""
                t = f" at {_format_time(act.start_time)}" if act.start_time else ""
                loc = f" @ {act.location}" if act.location else ""
                acts.append(f"{act.title} ({act.activity_type.value}{t}, {act.duration_minutes} min{loc}){tag}")
        day_contexts.append(
            f"**{d.strftime('%A %b %d')}:** " + ("; ".join(acts) if acts else "no fixed activities")
        )

    subject_lines = []
    for s in subjects:
        exam = f", EXAM {s.exam_date.strftime('%b %d')}" if s.exam_date else ""
        classes = f", classes {s.class_days}" if s.class_days else ""
        subject_lines.append(
            f"  - {s.name} – {s.difficulty.value} difficulty, "
            f"{s.homework_frequency.value} HW {s.homework_duration_minutes} min/session"
            f"{classes}{exam}"
        )
    subjects_section = "Enrolled subjects:\n" + "\n".join(subject_lines) if subject_lines else ""

    time_window = ""
    if start_time and end_time:
        time_window = f"Day window: {_format_time(start_time)} – {_format_time(end_time)}\n"
    elif start_time:
        time_window = f"Day starts at: {_format_time(start_time)}\n"
    elif end_time:
        time_window = f"Day ends by: {_format_time(end_time)}\n"

    location_line = f"Primary location: {location}\n" if location else ""
    notes_line = f"Notes: {additional_notes}\n" if additional_notes else ""

    routine_section = ""
    if student.default_prompt and student.default_prompt.strip():
        routine_section = (
            "Daily schedule template (structured by timeframe):\n"
            f"{student.default_prompt.strip()}\n"
        )
    custom_section = (
        f"\n--- Additional Routine & Preferences for this plan ---\n{custom_prompt.strip()}\n"
        f"--- End of Preferences ---\n"
        if custom_prompt and custom_prompt.strip() else ""
    )

    study_instruction = (
        "5. Insert 📚 Study/Homework rows for each subject on appropriate days — "
        f"respect the homework frequency and difficulty, and protect {relax_minutes} min of relax time per day.\n"
        "6. Add a 30-min 📖 Review row 2 days before any upcoming exam.\n"
        if include_study and subject_lines else ""
    )

    return f"""You are a student planning expert. Generate a personal daily planner for {_describe_student(student)}.
Output ONLY valid GitHub-Flavored Markdown with pipe tables. No prose paragraphs for time slots.

Period: {date_label}
{time_window}{location_line}{notes_line}
Fixed commitments per day:
{chr(10).join(day_contexts)}

{subjects_section}

{routine_section}{custom_section}
REQUIRED OUTPUT FORMAT:

## 📅 Personal Planner — {student.name} — {date_label}

{"Repeat the four timeframe sections below for EACH day, with a ### Date heading above them." if is_multi else ""}

Organise every activity into FOUR timeframe sections. Use the start/end times from the daily template (or sensible defaults). Each section has its own pipe table:

### 🌅 Morning
| Time | Activity / Study Task | Duration | Notes |
|------|-----------------------|----------|-------|

### 🏫 School Time
| Time | Activity / Study Task | Duration | Notes |
|------|-----------------------|----------|-------|

### ⚽ After School
| Time | Activity / Study Task | Duration | Notes |
|------|-----------------------|----------|-------|

### 🌙 Evening
| Time | Activity / Study Task | Duration | Notes |
|------|-----------------------|----------|-------|

Column rules:
- **Time**: 12-hour format (7:00 AM), rows chronological within section
- **Activity / Study Task**: short label + subject for study rows (e.g. "Homework — Maths")
- **Duration**: e.g. "45 min", "1 hr"
- **Notes**: ⚠️ conflicts, ⭐ SPECIAL tags, travel buffers, exam countdowns

Rules:
1. Never overlap time slots — no unexplained gaps in the day
2. Mark ⚠️ in Notes for any special activity or conflict
3. Use 12-hour time (7:00 AM)
4. Include all meals — Breakfast, Lunch, Dinner — even if not in the template
{study_instruction}
After all sections:

## 📊 Subject Summary

| Subject | Difficulty | HW Frequency | Sessions This Period | Est. Hours | Exam Date |
|---------|-----------|-------------|---------------------|-----------|-----------|

(Omit if no subjects exist.)

## ⚠️ Special Events & Conflicts

Bullet list of special/one-off events and any scheduling conflicts, with date and time.

## 💡 Tips

3–5 concise tips for {student.name} for this period.

Generate the plan now:"""


async def generate_plan(
    student: Student,
    start_date: date,
    activities: list[Activity],
    subjects: list[Subject],
    end_date: Optional[date] = None,
    start_time: Optional[time] = None,
    end_time: Optional[time] = None,
    location: Optional[str] = None,
    relax_minutes: int = 60,
    include_study: bool = True,
    custom_prompt: Optional[str] = None,
    additional_notes: Optional[str] = None,
) -> str:
    prompt = _build_plan_prompt(
        student, start_date, end_date, start_time, end_time, location,
        activities, subjects, relax_minutes, include_study, custom_prompt, additional_notes,
    )
    if not _vertex_configured():
        return _fallback_plan(student.name, start_date)
    return await _call_llm(prompt, max_tokens=4096)


def _fallback_plan(student_name: str, start_date: date) -> str:
    label = start_date.strftime("%B %d, %Y")
    return f"""## 📅 Personal Planner — {student_name} — {label}

> *Plan generation requires Vertex AI (Gemma 4).*
> *Set up Vertex AI (Gemma 4) to enable this — see **Settings** in the app or `SETUP.md`.*

| Time | Activity / Study Task | Duration | Notes |
|------|-----------------------|----------|-------|
| 7:00 AM | Wake up & Morning Routine | 30 min | |
| 7:30 AM | Breakfast | 30 min | |
| 8:00 AM | *(add activities to see your schedule here)* | | |
| 6:30 PM | Dinner | 45 min | |
| 9:00 PM | Wind-down | 30 min | |

## 💡 Tips
- Configure Vertex AI to enable AI-powered planning
- Add your activities and subjects to include them in the plan
"""


async def generate_reminders(
    student_name: str,
    today: date,
    deadlines: list[dict],
) -> str:
    if not deadlines:
        return "## ✅ No Upcoming Deadlines\n\nNo open deadlines found. Add assignments, exams, or essays to get personalised reminders."

    deadline_lines = []
    for d in deadlines:
        due = datetime.fromisoformat(d["due_date"]).date()
        days_left = (due - today).days
        urgency = "🔴 URGENT" if days_left <= 3 else "🟡 Soon" if days_left <= 7 else "🟢 Upcoming"
        subject_part = f" [{d['subject']}]" if d["subject"] else ""
        desc_part = f" — {d['description']}" if d["description"] else ""
        deadline_lines.append(
            f"  • {urgency} {d['title']}{subject_part} ({d['type']}) — due {d['due_date']} ({days_left} days){desc_part}"
        )

    lines_text = "\n".join(deadline_lines)

    prompt = f"""You are a smart student reminder assistant. Generate a clear, actionable reminder plan for {student_name}.

Today's date: {today.isoformat()}

Upcoming deadlines (sorted by due date):
{lines_text}

Generate a structured reminder plan in GitHub-Flavored Markdown with these sections:

## 📋 Deadline Overview
A quick-glance table:
| # | Deadline | Type | Subject | Due Date | Days Left | Priority |
|---|----------|------|---------|----------|-----------|----------|
(Sort by due date ascending. Priority = High/Medium/Low based on urgency and type.)

## 🔴 Urgent (Due within 3 days)
For each urgent item, give:
- What needs to be done right now
- Specific action steps for today and tomorrow
- Time estimate

## 🟡 Coming Up (4–7 days)
For each item due in 4–7 days:
- Recommended prep start date
- Day-by-day mini plan
- Key milestones to hit

## 🟢 Plan Ahead (8+ days)
For each longer-horizon deadline:
- Suggested start date (work backwards from due date)
- Milestone checkpoints

## 📅 This Week's Prep Schedule
A day-by-day table for the next 7 days showing what to work on each day:
| Day | Date | Focus Task | Deadline | Est. Time |
|-----|------|------------|----------|-----------|

## 💡 Tips
3–5 practical tips tailored to the specific mix of deadlines (exams need spaced repetition, essays need outlines first, etc.)

Generate the reminder plan now:"""

    if not _vertex_configured():
        return f"""## 📋 Deadline Overview

> *Set up Vertex AI (Gemma 4) to enable this — see **Settings** in the app or `SETUP.md`.*

You have {len(deadlines)} upcoming deadline(s):

{chr(10).join(f"- **{d['title']}** ({d['type']}) — due {d['due_date']}" for d in deadlines)}
"""

    return await _call_llm(prompt, max_tokens=2500)


# ─── Curriculum ───────────────────────────────────────────────────────────────

class AIUnavailableError(RuntimeError):
    """Raised when a feature needs the LLM but Vertex AI is not configured."""


_MAX_SYLLABUS_CHARS = 12000


def _curriculum_context(student: Student, subject: Subject) -> str:
    location = ", ".join(p for p in [student.county, student.state, student.country] if p)
    lines = [
        f"Subject: {subject.name}",
        f"Grade: {student.grade or 'not specified'}",
        f"School: {student.school or 'not specified'}",
        f"Location: {location or 'not specified'}",
    ]
    if subject.teacher:
        lines.append(f"Teacher: {subject.teacher}")
    if subject.notes:
        lines.append(f"Student notes about this subject: {subject.notes}")
    return "\n".join(lines)


def _parse_json(text: str) -> dict:
    """Parse a JSON object from model output, tolerating code fences or surrounding prose."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("model response contained no JSON object")
    return json.loads(text[start:end + 1])


async def generate_curriculum_outline(student: Student, subject: Subject) -> dict:
    """Return {"framework": str, "source": "syllabus"|"standards", "units": [{"title", "overview"}]}."""
    if not _vertex_configured():
        raise AIUnavailableError("Curriculum generation requires Vertex AI (Gemma 4) to be configured.")

    syllabus = (subject.syllabus_text or "").strip()[:_MAX_SYLLABUS_CHARS]
    if syllabus:
        source_rules = f"""The student has provided their school's syllabus / table of contents below.
Follow it: use its units or chapters, in its order, keeping its titles (you may tidy wording).
Do not add units that are not in it. Set "framework" to the course or textbook the syllabus describes.

--- SYLLABUS ---
{syllabus}
--- END SYLLABUS ---"""
    else:
        source_rules = """No syllabus was provided. Infer the curriculum this student most likely follows from the
grade, subject and location — e.g. the state/provincial standards, national curriculum or exam board
used there (such as Common Core / TEKS / CBSE / GCSE). Name it in "framework"."""

    prompt = f"""You are an expert curriculum designer. Lay out the curriculum for this course as units or chapters
in the order they are normally taught across the school year.

{_curriculum_context(student, subject)}

{source_rules}

Return ONLY a JSON object, no markdown, in exactly this shape:
{{
  "framework": "short name of the curriculum / standards / textbook",
  "units": [
    {{"title": "Unit 1: ...", "overview": "1–2 sentences on what this unit covers"}}
  ]
}}
Use 5–15 units. Keep titles concise."""

    data = _parse_json(await _call_llm(prompt, max_tokens=2500))
    units = [
        {"title": str(u["title"]).strip()[:200], "overview": str(u.get("overview", "")).strip()}
        for u in data.get("units", [])
        if isinstance(u, dict) and str(u.get("title", "")).strip()
    ]
    if not units:
        raise ValueError("model returned no units")
    return {
        "framework": str(data.get("framework") or "").strip()[:200] or None,
        "source": "syllabus" if syllabus else "standards",
        "units": units,
    }


async def generate_unit_details(
    student: Student, subject: Subject, unit: CurriculumUnit, all_unit_titles: list[str]
) -> dict:
    """Return {"summary": str, "key_concepts": [{"name", "explanation"}], "formulas": [{"name", "expression", "explanation"}]}."""
    if not _vertex_configured():
        raise AIUnavailableError("Curriculum generation requires Vertex AI (Gemma 4) to be configured.")

    outline = "\n".join(f"  {i + 1}. {t}" for i, t in enumerate(all_unit_titles))
    prompt = f"""You are an expert teacher writing concise study notes for a student.

{_curriculum_context(student, subject)}
Curriculum: {subject.curriculum_framework or "not specified"}

Full course outline (for context — cover ONLY the target unit, avoid repeating other units):
{outline}

Target unit: {unit.title}
Unit overview: {unit.overview or "—"}

Return ONLY a JSON object, no markdown, in exactly this shape:
{{
  "summary": "a clear 100–180 word summary of the unit at this grade level",
  "key_concepts": [
    {{"name": "concept", "explanation": "1–3 sentence student-friendly explanation"}}
  ],
  "formulas": [
    {{"name": "formula name", "expression": "the formula", "explanation": "what each symbol means / when to use it"}}
  ]
}}
Rules:
- 4–8 key concepts, the most important ones for tests.
- Formulas: include every important formula, equation, rule or law for this unit. Write expressions in plain
  text with Unicode symbols (e.g. "x = (−b ± √(b² − 4ac)) / 2a", "a² + b² = c²") — no LaTeX.
- If the subject has no formulas (e.g. history, literature), return "formulas": [].
- Pitch everything at the student's grade level."""

    data = _parse_json(await _call_llm(prompt, max_tokens=3000))
    summary = str(data.get("summary") or "").strip()
    if not summary:
        raise ValueError("model returned no summary")
    return {
        "summary": summary,
        "key_concepts": [
            {"name": str(c.get("name", "")).strip(), "explanation": str(c.get("explanation", "")).strip()}
            for c in data.get("key_concepts", []) if isinstance(c, dict) and c.get("name")
        ],
        "formulas": [
            {"name": str(f.get("name", "")).strip(), "expression": str(f.get("expression", "")).strip(),
             "explanation": str(f.get("explanation", "")).strip()}
            for f in data.get("formulas", []) if isinstance(f, dict) and f.get("expression")
        ],
    }
