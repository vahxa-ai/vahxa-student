"""
AI plan generation and deadline reminders using Gemma 4 on Google Vertex AI.
Falls back gracefully if Vertex AI credentials are not configured.
"""
import asyncio
import json
import re
from datetime import date, datetime, time, timedelta
from typing import Optional

import httpx

from app.core.config import settings
from app.services import gcp
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


def _vertex_configured() -> bool:
    return gcp.load()


def _chat_completions_url() -> str:
    loc = settings.vertex_location
    host = "aiplatform.googleapis.com" if loc == "global" else f"{loc}-aiplatform.googleapis.com"
    return f"https://{host}/v1/projects/{gcp.project_id()}/locations/{loc}/endpoints/openapi/chat/completions"


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
    headers = {"Authorization": f"Bearer {await gcp.access_token()}"}
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


_DIFFICULTIES = ("easy", "medium", "hard")


async def generate_unit_practice(
    student: Student, subject: Subject, unit: CurriculumUnit, details: Optional[dict]
) -> list[dict]:
    """Return [{"question", "answer", "explanation", "difficulty"}] — exam-style practice with worked solutions."""
    if not _vertex_configured():
        raise AIUnavailableError("Curriculum generation requires Vertex AI (Gemma 4) to be configured.")

    notes = ""
    if details:
        concepts = "\n".join(f"  - {c['name']}: {c['explanation']}" for c in details.get("key_concepts", []))
        formulas = "\n".join(f"  - {f['name']}: {f['expression']}" for f in details.get("formulas", []))
        notes = f"""Unit notes the student has studied (base your questions on these):
Summary: {details.get("summary", "")}
Key concepts:
{concepts or "  (none)"}
Formulas:
{formulas or "  (none)"}"""

    prompt = f"""You are an expert teacher and exam writer helping a student master their curriculum.

{_curriculum_context(student, subject)}
Curriculum: {subject.curriculum_framework or "not specified"}
Unit: {unit.title}
Unit overview: {unit.overview or "—"}

{notes}

Write the most important practice questions for this unit — the kinds of questions that appear on tests
and that check real understanding, not just recall.

Return ONLY a JSON object, no markdown, in exactly this shape:
{{
  "questions": [
    {{
      "difficulty": "easy | medium | hard",
      "question": "the question, self-contained (include any numbers, data or short passage needed)",
      "answer": "the short final answer",
      "explanation": "a clear step-by-step worked solution explaining WHY, as a student would need to see it"
    }}
  ]
}}
Rules:
- 4–6 questions, ordered from easy to hard; cover the unit's most important concepts and formulas.
- Mix types as the subject suits: concept checks, calculations/worked problems, applications, and
  interpretation or short-response questions (for non-quantitative subjects use analysis/evidence questions).
- For calculations, show each step of working in "explanation" on separate lines; use plain text and
  Unicode math symbols (e.g. "x² − 5x + 6 = 0", "√", "π", "≤") — no LaTeX.
- Mention common mistakes in the explanation when relevant.
- Match the student's grade level and the curriculum. Answers must be correct — double-check calculations."""

    data = _parse_json(await _call_llm(prompt, max_tokens=4000))
    questions = []
    for q in data.get("questions", []):
        if not isinstance(q, dict) or not str(q.get("question", "")).strip() or not str(q.get("answer", "")).strip():
            continue
        difficulty = str(q.get("difficulty", "medium")).strip().lower()
        questions.append({
            "question": str(q["question"]).strip(),
            "answer": str(q["answer"]).strip(),
            "explanation": str(q.get("explanation", "")).strip(),
            "difficulty": difficulty if difficulty in _DIFFICULTIES else "medium",
        })
    if not questions:
        raise ValueError("model returned no practice questions")
    return questions


QUIZ_BANK_SIZE = 15   # requested; verification typically removes a few
_MIN_QUIZ_QUESTIONS = 6


def _notes_block(details: Optional[dict]) -> str:
    if not details:
        return ""
    concepts = "\n".join(f"  - {c['name']}: {c['explanation']}" for c in details.get("key_concepts", []))
    formulas = "\n".join(f"  - {f['name']}: {f['expression']}" for f in details.get("formulas", []))
    return f"""Unit notes the student has studied:
Summary: {details.get("summary", "")}
Key concepts:
{concepts or "  (none)"}
Formulas:
{formulas or "  (none)"}"""


async def generate_unit_quiz(
    student: Student, subject: Subject, unit: CurriculumUnit, details: Optional[dict]
) -> list[dict]:
    """Return a bank of multiple-choice questions:
    [{"id", "question", "options": [4 strings], "answer": index, "explanation", "difficulty"}]."""
    if not _vertex_configured():
        raise AIUnavailableError("Curriculum generation requires Vertex AI (Gemma 4) to be configured.")

    prompt = f"""You are an expert teacher writing a graded multiple-choice quiz for one unit.

{_curriculum_context(student, subject)}
Curriculum: {subject.curriculum_framework or "not specified"}
Unit: {unit.title}
Unit overview: {unit.overview or "—"}

{_notes_block(details)}

Write {QUIZ_BANK_SIZE} multiple-choice questions that test real understanding of this unit — the kind that appear on
tests. Mix recall, conceptual understanding, calculation/application and interpretation as the subject suits.

Return ONLY a JSON object, no markdown, in exactly this shape:
{{
  "questions": [
    {{
      "difficulty": "easy | medium | hard",
      "question": "self-contained question (include any numbers or short passage needed)",
      "options": ["option A", "option B", "option C", "option D"],
      "answer": 0,
      "explanation": "why the correct option is right, and why the most tempting wrong option is wrong"
    }}
  ]
}}
Rules:
- Exactly 4 options per question, exactly one correct; "answer" is the 0-based index of the correct option.
- Wrong options must be plausible — base them on real student mistakes (sign errors, wrong formula, common
  misconceptions). No "all of the above" / "none of the above". Options must all be different.
- Do not put the letter (A/B/C/D) inside option text. Vary the position of the correct answer.
- Options are shuffled for each student, so explanations must refer to options by their content — never by
  letter, number or position ("option 0", "B", "the second one").
- Mix difficulties: about 5 easy, 6 medium, 4 hard. Plain text and Unicode math (x², √, π, ≤) — no LaTeX.
- Work out every answer fully BEFORE writing the question. Each explanation must be a clean, final worked
  solution — no second-guessing, corrections or "let's re-check" — and every answer must be correct."""

    data = _parse_json(await _call_llm(prompt, max_tokens=6000))
    bank = []
    for i, q in enumerate(data.get("questions", [])):
        if not isinstance(q, dict):
            continue
        question = str(q.get("question", "")).strip()
        options = [str(o).strip() for o in q.get("options", []) if str(o).strip()]
        answer = q.get("answer")
        if not question or len(options) != 4 or len(set(o.lower() for o in options)) != 4:
            continue
        if not isinstance(answer, int) or isinstance(answer, bool) or not 0 <= answer < 4:
            continue
        difficulty = str(q.get("difficulty", "medium")).strip().lower()
        bank.append({
            "id": f"q{i}",
            "question": question,
            "options": options,
            "answer": answer,
            "explanation": _strip_positional(str(q.get("explanation", "")).strip()),
            "difficulty": difficulty if difficulty in _DIFFICULTIES else "medium",
        })
    # Drop questions whose explanation shows the model second-guessing itself
    bank = [q for q in bank if not _SELF_CORRECTION.search(q["explanation"])]
    bank = await _verify_quiz(bank)
    if len(bank) < _MIN_QUIZ_QUESTIONS:
        raise ValueError(f"only {len(bank)} quiz questions passed verification")
    return bank


# "option 0", "Option B", "choice (c)", "options 1 and 2", "the second option" — meaningless once options are shuffled
_POSITIONAL = re.compile(
    r"\b(?:options?|choices?|answers?)\s*\(?(?:[A-Da-d]|[0-3])\)?(?=[\s,.;:)]|$)"
    r"|\b(?:first|second|third|fourth|last)\s+(?:option|choice)\b",
    re.IGNORECASE,
)


def _strip_positional(explanation: str) -> str:
    """Remove sentences that refer to options by position; keep the explanation if nothing would remain."""
    sentences = re.split(r"(?<=[.!?])\s+", explanation)
    kept = [s for s in sentences if not _POSITIONAL.search(s)]
    return " ".join(kept).strip() if kept else explanation


_SELF_CORRECTION = re.compile(
    r"\b(?:wait\b|re-?calculat|re-?check|let'?s (?:check|verify|redo|try again)|actually,|correction\b|hmm+\b|oops\b"
    r"|mistake in the (?:question|options))",
    re.IGNORECASE,
)


async def _verify_quiz(bank: list[dict]) -> list[dict]:
    """Independently re-solve every question (without the marked answers) and keep only those where the
    solver agrees with the answer key. Catches wrong keys and questions with zero or several right options."""
    if not bank:
        return bank
    listing = "\n\n".join(
        f"Question {i}:\n{q['question']}\n" + "\n".join(f"  {j}) {o}" for j, o in enumerate(q["options"]))
        for i, q in enumerate(bank)
    )
    prompt = f"""You are a meticulous exam checker. Solve each multiple-choice question below independently, from
scratch. Do not trust the options: first work out the answer yourself (for calculations, find EVERY unknown and
substitute your result back into the original equations to check it), then compare with the options.
For each question give the index (0-3) of the single correct option, or -1 if no option is fully correct or more
than one option is correct.

{listing}

Return ONLY a JSON object, no markdown:
{{"solutions": [{{"q": 0, "working": "brief working, including the check", "answer": index}}, ...]}}
with one entry per question, in order."""
    data = _parse_json(await _call_llm(prompt, max_tokens=250 * len(bank) + 500))
    solved = data.get("solutions", [])
    if not isinstance(solved, list) or len(solved) != len(bank):
        raise ValueError("quiz verification returned an unexpected number of answers")
    answers = [s.get("answer") if isinstance(s, dict) else None for s in solved]
    return [q for q, s in zip(bank, answers) if isinstance(s, int) and not isinstance(s, bool) and s == q["answer"]]


# ─── Sample tests (mock exam papers) ──────────────────────────────────────────

_SECTION_TYPES = ("mcq", "short", "long")
_MIN_PER_SECTION = {"mcq": 4, "short": 2, "long": 1}


def _clean_written(q: dict) -> Optional[dict]:
    question = str(q.get("question", "")).strip()
    model_answer = str(q.get("model_answer", "")).strip()
    if not question or not model_answer or _SELF_CORRECTION.search(model_answer):
        return None
    points = []
    for p in q.get("marking_points", []) or []:
        if isinstance(p, dict) and str(p.get("point", "")).strip():
            m = p.get("marks", 1)
            points.append({"point": str(p["point"]).strip(), "marks": m if isinstance(m, int) and not isinstance(m, bool) and 1 <= m <= 5 else 1})
    marks = sum(p["marks"] for p in points) if points else q.get("marks")
    if not isinstance(marks, int) or isinstance(marks, bool) or not 1 <= marks <= 10:
        return None
    if not points:
        points = [{"point": "Complete, correct answer as in the model answer", "marks": marks}]
    return {"question": question, "marks": marks, "model_answer": model_answer, "marking_points": points}


async def _verify_written(questions: list[dict]) -> list[dict]:
    """Keep only written questions whose model answer an independent check confirms is correct."""
    if not questions:
        return questions
    listing = "\n\n".join(f"Question {i}:\n{q['question']}\nModel answer:\n{q['model_answer']}" for i, q in enumerate(questions))
    prompt = f"""You are a meticulous exam checker. For each question below, first work out the correct answer yourself,
from scratch (for calculations, find every unknown and substitute back to check). Then judge whether the given model
answer is fully correct. Minor wording differences are fine; any wrong calculation, wrong fact, missing required
part or wrong final answer is not.

{listing}

Return ONLY a JSON object, no markdown:
{{"checks": [{{"q": 0, "working": "brief independent working", "correct": true or false}}, ...]}}
with one entry per question, in order."""
    data = _parse_json(await _call_llm(prompt, max_tokens=300 * len(questions) + 500))
    checks = data.get("checks", [])
    if not isinstance(checks, list) or len(checks) != len(questions):
        raise ValueError("written-answer verification returned an unexpected number of verdicts")
    return [q for q, c in zip(questions, checks) if isinstance(c, dict) and c.get("correct") is True]


async def generate_sample_test(
    student: Student, subject: Subject, unit: CurriculumUnit, details: Optional[dict], avoid: list[str]
) -> dict:
    """Return a mock exam paper:
    {"title", "duration_minutes", "instructions", "total_marks",
     "sections": [{"id", "title", "type": "mcq"|"short"|"long", "instructions",
                   "questions": [mcq: {"id","question","options","answer","explanation","marks"} |
                                 written: {"id","question","marks","model_answer","marking_points":[{"point","marks"}]}]}]}"""
    if not _vertex_configured():
        raise AIUnavailableError("Curriculum generation requires Vertex AI (Gemma 4) to be configured.")

    avoid_block = ""
    if avoid:
        avoid_block = "Earlier sample tests for this unit already used these questions — write DIFFERENT ones:\n" + \
            "\n".join(f"  - {a}" for a in avoid[:60])

    prompt = f"""You are an experienced teacher writing a realistic end-of-unit test that a school would give.

{_curriculum_context(student, subject)}
Curriculum: {subject.curriculum_framework or "not specified"}
Unit: {unit.title}
Unit overview: {unit.overview or "—"}

{_notes_block(details)}

{avoid_block}

Write ONE complete sample test for this unit, pitched at the student's grade and curriculum, with three sections:
- Section A — multiple choice: 8 questions, 1 mark each.
- Section B — short answer: 4 questions, 2–3 marks each (calculations, definitions, brief explanations).
- Section C — extended response: 2 questions, 4–8 marks each (multi-step problems for quantitative subjects;
  analysis / evidence-based responses for others).

Return ONLY a JSON object, no markdown, in exactly this shape:
{{
  "title": "short test title",
  "duration_minutes": 45,
  "instructions": "instructions to the student (materials allowed, show working, etc.)",
  "sections": [
    {{"title": "Section A: Multiple Choice", "type": "mcq", "instructions": "…",
      "questions": [{{"question": "…", "options": ["…","…","…","…"], "answer": 0, "explanation": "…"}}]}},
    {{"title": "Section B: Short Answer", "type": "short", "instructions": "…",
      "questions": [{{"question": "…", "model_answer": "step-by-step model answer",
                      "marking_points": [{{"point": "what earns the mark", "marks": 1}}]}}]}},
    {{"title": "Section C: Extended Response", "type": "long", "instructions": "…",
      "questions": [{{"question": "…", "model_answer": "full worked solution / exemplar answer",
                      "marking_points": [{{"point": "what earns the mark", "marks": 2}}]}}]}}
  ]
}}
Rules:
- Multiple choice: exactly 4 distinct, plausible options (based on real mistakes), one correct; "answer" is its
  0-based index; explanations refer to options by content, never by letter or position.
- Written questions: marking_points list what earns each mark, like a real mark scheme; a question's marks are
  the sum of its marking points. Model answers show full working.
- Questions must be self-contained (include any numbers, data or short passage needed).
- Work out every answer fully BEFORE writing it. Model answers and explanations must be clean, final and correct —
  no second-guessing or corrections. Plain text and Unicode math (x², √, π, ≤) — no LaTeX."""

    data = _parse_json(await _call_llm(prompt, max_tokens=9000))

    by_type: dict[str, dict] = {}
    for sec in data.get("sections", []) or []:
        if not isinstance(sec, dict) or sec.get("type") not in _SECTION_TYPES or sec["type"] in by_type:
            continue
        kind = sec["type"]
        questions = []
        for q in sec.get("questions", []) or []:
            if not isinstance(q, dict):
                continue
            if kind == "mcq":
                options = [str(o).strip() for o in q.get("options", []) if str(o).strip()]
                answer = q.get("answer")
                explanation = str(q.get("explanation", "")).strip()
                if (str(q.get("question", "")).strip() and len(options) == 4 and len({o.lower() for o in options}) == 4
                        and isinstance(answer, int) and not isinstance(answer, bool) and 0 <= answer < 4
                        and not _SELF_CORRECTION.search(explanation)):
                    questions.append({"question": str(q["question"]).strip(), "options": options, "answer": answer,
                                      "explanation": _strip_positional(explanation), "marks": 1})
            else:
                cleaned = _clean_written(q)
                if cleaned:
                    questions.append(cleaned)
        by_type[kind] = {"title": str(sec.get("title") or "").strip(), "type": kind,
                         "instructions": str(sec.get("instructions") or "").strip(), "questions": questions}

    if set(by_type) != set(_SECTION_TYPES):
        raise ValueError("sample test is missing a section")

    # Verify all sections in parallel
    mcq, written = by_type["mcq"]["questions"], by_type["short"]["questions"] + by_type["long"]["questions"]
    mcq_ok, written_ok = await asyncio.gather(_verify_quiz(mcq), _verify_written(written))
    written_ids = {id(q) for q in written_ok}
    by_type["mcq"]["questions"] = mcq_ok
    for kind in ("short", "long"):
        by_type[kind]["questions"] = [q for q in by_type[kind]["questions"] if id(q) in written_ids]

    for kind, minimum in _MIN_PER_SECTION.items():
        if len(by_type[kind]["questions"]) < minimum:
            raise ValueError(f"too few verified {kind} questions")

    sections, total = [], 0
    for letter, kind in zip("ABC", _SECTION_TYPES):
        sec = by_type[kind]
        for n, q in enumerate(sec["questions"], 1):
            q["id"] = f"{letter}{n}"
            total += q["marks"]
        sections.append({"id": letter, **sec,
                         "title": sec["title"] or {"mcq": "Multiple Choice", "short": "Short Answer", "long": "Extended Response"}[kind]})
    duration = data.get("duration_minutes")
    return {
        "title": str(data.get("title") or f"{unit.title} — Sample Test").strip()[:200],
        "duration_minutes": duration if isinstance(duration, int) and not isinstance(duration, bool) and 10 <= duration <= 180 else 45,
        "instructions": str(data.get("instructions") or "Answer all questions. Show your working.").strip(),
        "total_marks": total,
        "sections": sections,
    }
