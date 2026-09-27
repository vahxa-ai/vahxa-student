"""
College prep content from Gemma 4: an admissions guide per country, a personalized grade-by-grade roadmap,
and per-college summaries. Nothing here is live data — prompts tell the model to leave unknown facts empty
rather than guess, and the UI labels college facts as "verify with the college".
"""
import re
from datetime import date
from typing import Optional

from app.models.models import Student, CollegeProfile
from app.services.ai_service import (
    AIUnavailableError, _call_llm, _parse_json, _vertex_configured, _SELF_CORRECTION,
)

ROADMAP_CATEGORIES = ("academics", "testing", "activities", "applications", "finances", "summer", "wellbeing")


def _require_ai() -> None:
    if not _vertex_configured():
        raise AIUnavailableError("College prep content requires Vertex AI (Gemma 4) to be configured.")


def _s(value, limit: int = 4000) -> str:
    return str(value or "").strip()[:limit]


def _str_list(value, limit: int = 12, each: int = 400) -> list[str]:
    return [_s(v, each) for v in (value or []) if isinstance(v, (str, int, float)) and _s(v)][:limit]


def _strip_numbering(title: str) -> str:
    """'1. Grades' / 'Chapter 2: Tests' → 'Grades' / 'Tests' (the UI numbers chapters itself)."""
    return re.sub(r"^\s*(?:chapter\s+)?\d+\s*[.:)\-–—]\s*", "", title, flags=re.IGNORECASE) or title


def _student_block(student: Student, profile: Optional[CollegeProfile]) -> str:
    lines = [
        f"Current grade: {student.grade or 'not specified'}",
        f"Country: {student.country or 'not specified'}",
        f"State / province: {student.state or 'not specified'}",
        f"School: {student.school or 'not specified'}",
    ]
    if profile:
        for label, value in [("Intended major(s)", profile.intended_majors), ("Interests", profile.interests),
                             ("Career goals", profile.career_goals), ("GPA", profile.gpa),
                             ("Test scores", profile.test_scores), ("Other notes", profile.notes)]:
            if value:
                lines.append(f"{label}: {value}")
    return "\n".join(lines)


# ─── Admissions guide (shared per country) ────────────────────────────────────

async def generate_admissions_guide(country: str) -> dict:
    """{"title", "intro", "chapters": [{"id", "title", "summary", "body", "key_takeaways": [...]}]}"""
    _require_ai()
    prompt = f"""You are an experienced, independent college admissions counselor writing a clear guide for high-school
students (starting around age 14) and their parents in {country}.

Explain how admission to universities/colleges works in {country}, in about 8 chapters, in the order a student
needs them. Cover (adapting to how {country} actually works): how admissions decisions are made; grades and course
choices/rigor; standardized or entrance exams and when to take them; extracurriculars, leadership and service;
personal statements/essays and recommendations; the application process, platforms and deadlines (and early
options if they exist); costs, financial aid and scholarships; and choosing where to apply (reach/target/likely).

Rules:
- Be accurate and general. Do NOT state specific acceptance rates, score cut-offs for particular colleges or exact
  dates that change each year; say "check the official website" where students must look something up, and name
  the official bodies/platforms students should consult.
- Write for a 14–17 year old: plain language, practical, encouraging, no fear-mongering.
- Chapter "body" is GitHub-flavored markdown (short paragraphs, bullet lists, bold key terms), 150–300 words.

Return ONLY a JSON object, no code fences:
{{"title": "…", "intro": "2–3 sentence intro",
  "chapters": [{{"title": "…", "summary": "one sentence", "body": "markdown", "key_takeaways": ["…", "…", "…"]}}]}}"""
    data = _parse_json(await _call_llm(prompt, max_tokens=9000))
    chapters = []
    for i, c in enumerate(data.get("chapters") or []):
        if not isinstance(c, dict) or not _s(c.get("title")) or not _s(c.get("body")):
            continue
        chapters.append({"id": f"c{i + 1}", "title": _strip_numbering(_s(c["title"], 200)), "summary": _s(c.get("summary"), 400),
                         "body": _s(c["body"], 6000), "key_takeaways": _str_list(c.get("key_takeaways"), 6)})
    if len(chapters) < 4:
        raise ValueError("admissions guide has too few chapters")
    return {"title": _s(data.get("title"), 200) or f"College admissions in {country}",
            "intro": _s(data.get("intro"), 1000), "chapters": chapters}


# ─── Personalized roadmap ─────────────────────────────────────────────────────

async def generate_roadmap(student: Student, profile: Optional[CollegeProfile], colleges: list[str],
                           achievements: list[str]) -> dict:
    """{"overview", "stages": [{"id", "label", "focus", "goals": [...],
                                "milestones": [{"id", "title", "detail", "category"}]}]}"""
    _require_ai()
    college_block = "Colleges on their list: " + "; ".join(colleges[:15]) if colleges else "No colleges chosen yet."
    activity_block = ("Activities so far:\n" + "\n".join(f"  - {a}" for a in achievements[:25])) if achievements \
        else "No activities recorded yet."
    prompt = f"""You are an experienced college admissions counselor. Build a personalized, realistic preparation
roadmap for this student, from their CURRENT grade/term through submitting applications and choosing a college,
following how admissions works in their country.

Today's date: {date.today().strftime("%B %d, %Y")}
{_student_block(student, profile)}
{college_block}
{activity_block}

Structure the roadmap as stages, one per term/half-year (e.g. "Grade 9 — Fall", "Grade 9 — Summer", … through the
final application year and decision time). Work out the student's CURRENT term from today's date and the school
calendar in their country, start the roadmap at that term, and don't include terms that have already passed.
For each stage give:
- "focus": one or two sentences on what matters most right now for THIS student;
- "goals": 2–4 concrete goals;
- "milestones": 3–6 actionable checklist items, each with a short "detail" and a "category" from
  {list(ROADMAP_CATEGORIES)}.
Tailor to their intended major, interests and colleges (e.g. relevant courses, competitions, projects, summer
programs); build on activities they already do. Keep it balanced and healthy — include rest and wellbeing — and
avoid promising outcomes. Don't state exact exam dates or college-specific statistics; say when to check official
sites instead.

Return ONLY a JSON object, no code fences:
{{"overview": "3–4 sentences personalised summary of the plan",
  "stages": [{{"label": "Grade 9 — Fall", "focus": "…", "goals": ["…"],
               "milestones": [{{"title": "…", "detail": "…", "category": "academics"}}]}}]}}"""
    data = _parse_json(await _call_llm(prompt, max_tokens=9000))
    stages = []
    for i, st in enumerate(data.get("stages") or []):
        if not isinstance(st, dict) or not _s(st.get("label")):
            continue
        milestones = []
        for j, m in enumerate(st.get("milestones") or []):
            if not isinstance(m, dict) or not _s(m.get("title")):
                continue
            category = _s(m.get("category"), 30).lower()
            milestones.append({"id": f"s{i + 1}m{j + 1}", "title": _s(m["title"], 200), "detail": _s(m.get("detail"), 600),
                               "category": category if category in ROADMAP_CATEGORIES else "academics"})
        if milestones:
            stages.append({"id": f"s{i + 1}", "label": _s(st["label"], 80), "focus": _s(st.get("focus"), 600),
                           "goals": _str_list(st.get("goals"), 6, 300), "milestones": milestones})
    if len(stages) < 2:
        raise ValueError("roadmap has too few stages")
    return {"overview": _s(data.get("overview"), 1500), "stages": stages}


# ─── College summary ──────────────────────────────────────────────────────────

async def generate_college_summary(student: Student, profile: Optional[CollegeProfile], college_name: str) -> dict:
    _require_ai()
    prompt = f"""You are a careful college admissions counselor. A student has added "{college_name}" to their college list.

Student:
{_student_block(student, profile)}

If you are not confident which institution "{college_name}" refers to, or you don't know it, set "recognized" to
false and leave the other fields empty. Otherwise summarise what a student should know, based on your general
knowledge. IMPORTANT: facts like test policies, deadlines and acceptance rates change every year — only include
things you are confident about, phrase numbers as approximate, and leave a field empty rather than guess.

Return ONLY a JSON object, no code fences:
{{"recognized": true,
  "official_name": "…", "location": "city, region, country", "type": "e.g. public research university",
  "overview": "2–3 sentences",
  "what_they_look_for": ["…"],
  "typical_requirements": ["courses, exams, essays, recommendations, portfolio/interview if relevant"],
  "testing_policy": "brief, or empty if unsure",
  "application_options": "e.g. platforms and early/regular rounds, or empty if unsure",
  "selectivity": "e.g. 'highly selective' — no exact rate unless confident",
  "fit_for_student": "2–4 sentences on how this student's goals/interests fit, and gaps to work on",
  "next_steps": ["3–5 concrete actions for this student"]}}"""
    data = _parse_json(await _call_llm(prompt, max_tokens=2500))
    if data.get("recognized") is False:
        return {"recognized": False}
    summary = {
        "recognized": True,
        "official_name": _s(data.get("official_name"), 200) or college_name,
        "location": _s(data.get("location"), 200),
        "type": _s(data.get("type"), 200),
        "overview": _s(data.get("overview"), 1200),
        "what_they_look_for": _str_list(data.get("what_they_look_for"), 8),
        "typical_requirements": _str_list(data.get("typical_requirements"), 10),
        "testing_policy": _s(data.get("testing_policy"), 500),
        "application_options": _s(data.get("application_options"), 500),
        "selectivity": _s(data.get("selectivity"), 200),
        "fit_for_student": _s(data.get("fit_for_student"), 1200),
        "next_steps": _str_list(data.get("next_steps"), 6),
    }
    if not summary["overview"] or _SELF_CORRECTION.search(summary["overview"] + summary["fit_for_student"]):
        raise ValueError("college summary was incomplete")
    return summary
