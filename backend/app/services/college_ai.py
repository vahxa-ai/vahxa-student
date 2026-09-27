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


# ─── College recommendations (athletics / financial aid / academics) ─────────

_FITS = ("reach", "target", "likely")
_LEVEL_FITS = ("strong", "possible", "stretch")
_GROUP_TITLES = {"athletics": "Athletic fit", "aid": "Strong financial aid", "academics": "Academic quality for your goals"}


def _prefs_block(prefs: dict) -> str:
    lines = []
    for label, key in [("Preferred regions", "regions"), ("Size", "size"), ("Setting", "setting"),
                       ("Needs financial aid", "need_aid"), ("Budget notes", "budget_note")]:
        if prefs.get(key):
            lines.append(f"{label}: {prefs[key]}")
    if prefs.get("priorities"):
        lines.append("Top priorities (in order): " + ", ".join(prefs["priorities"]))
    ath = prefs.get("athletics") or {}
    if ath.get("sport"):
        details = "; ".join(f"{k.replace('_', ' ')}: {v}" for k, v in ath.items()
                            if k != "wants_to_compete" and v not in (None, ""))
        lines.append(f"Athletics: {details} — " + ("wants to compete in college" if ath.get("wants_to_compete")
                                                     else "not planning to compete in college"))
    return "\n".join(lines) or "No specific preferences given."


async def generate_recommendations(student: Student, profile: Optional[CollegeProfile], prefs: dict,
                                   achievements: list[str], already_listed: list[str]) -> dict:
    _require_ai()
    ath = prefs.get("athletics") or {}
    athletic = bool(ath.get("sport") and ath.get("wants_to_compete"))
    groups_wanted = (["athletics"] if athletic else []) + ["aid", "academics"]
    activities = "\n".join(f"  - {a}" for a in achievements[:30]) or "  (none recorded)"
    athlete_role = " who also advises student-athletes on recruiting" if athletic else ""
    levels_rule = "" if athletic else "athletic_levels must be an empty list (they are not planning to compete)."
    prompt = f"""You are an experienced, realistic college counselor{athlete_role}. Recommend colleges that genuinely
suit this student.

Student:
{_student_block(student, profile)}
Activities & achievements:
{activities}
Preferences:
{_prefs_block(prefs)}
Already on their list (do not repeat): {", ".join(already_listed[:40]) or "none"}

Produce these groups (use exactly these keys): {", ".join(groups_wanted)}
- "athletics": colleges where they could realistically compete in their sport, across the right competitive levels
  (NCAA Division I / II / III, NAIA, junior college, or the equivalent where they live). Judge their level honestly
  from their stats: most high-school athletes fit D2, D3 or NAIA; only suggest D1 if their results clearly support it.
  Performance standards differ for men's and women's teams: if the team isn't stated, don't judge their level from
  times or stats — mark every level "possible" and explain that it depends on the team they'd compete on.
  NCAA Division III offers no athletic scholarships (but can offer need-based or merit aid).
- "aid": colleges known for generous financial aid that fits their situation (e.g. meeting full demonstrated need,
  strong merit scholarships, in-state value, aid for international students if relevant).
- "academics": colleges with strong programs in their intended major and good teaching and outcomes, at their level.
Give 4-6 real, currently operating colleges per group, spread across reach / target / likely for this student and
respecting their preferences. Only name institutions you are sure exist. Do not state exact acceptance rates, costs,
scholarship amounts or deadlines. {levels_rule}

Return ONLY a JSON object, no code fences:
{{"summary": "3-4 sentences on what kind of colleges suit them and why",
  "athletic_levels": [{{"division": "NCAA Division III", "fit": "strong | possible | stretch", "why": "..."}}],
  "groups": [{{"key": "athletics | aid | academics", "intro": "one sentence",
               "colleges": [{{"name": "official name", "location": "city, state/region", "fit_category": "reach | target | likely",
                             "why": "1-2 sentences specific to this student", "division": "athletic division if relevant, else empty",
                             "athletics_note": "", "aid_note": "", "academic_note": ""}}]}}],
  "next_steps": ["3-6 concrete actions (e.g. recruiting profile, contacting coaches, net price calculators, visits)"]}}"""
    data = _parse_json(await _call_llm(prompt, max_tokens=7000))

    groups = []
    for g in data.get("groups") or []:
        key = _s(g.get("key") if isinstance(g, dict) else "", 20).lower()
        if key not in groups_wanted or any(x["key"] == key for x in groups):
            continue
        colleges = []
        for c in g.get("colleges") or []:
            if not isinstance(c, dict) or not _s(c.get("name")):
                continue
            fit = _s(c.get("fit_category"), 10).lower()
            colleges.append({
                "name": _s(c["name"], 200), "location": _s(c.get("location"), 200),
                "fit_category": fit if fit in _FITS else "target", "why": _s(c.get("why"), 600),
                "division": _s(c.get("division"), 80) if key == "athletics" else "",
                "athletics_note": _s(c.get("athletics_note"), 400), "aid_note": _s(c.get("aid_note"), 400),
                "academic_note": _s(c.get("academic_note"), 400),
            })
        if colleges:
            groups.append({"key": key, "title": _GROUP_TITLES[key], "intro": _s(g.get("intro"), 400), "colleges": colleges})
    if not groups:
        raise ValueError("no recommendations returned")
    levels = []
    for lv in (data.get("athletic_levels") or []) if athletic else []:
        if isinstance(lv, dict) and _s(lv.get("division")):
            fit = _s(lv.get("fit"), 10).lower()
            levels.append({"division": _s(lv["division"], 80), "fit": fit if fit in _LEVEL_FITS else "possible",
                           "why": _s(lv.get("why"), 500)})

    groups, removed = await _fact_check_recommendations(groups, ath.get("sport"))
    if not groups:
        raise ValueError("no recommendations passed the fact-check")
    return {"summary": _s(data.get("summary"), 1500), "athletic_levels": levels, "groups": groups,
            "next_steps": _str_list(data.get("next_steps"), 6), "removed_by_check": removed}


def _division_key(text: str) -> Optional[str]:
    """Normalize 'NCAA Division III' / 'D3' / 'NAIA' / 'NJCAA' … to a comparable key; None if unknown."""
    t = text.lower()
    if "naia" in t:
        return "naia"
    if "njcaa" in t or "junior college" in t or "juco" in t:
        return "juco"
    m = re.search(r"\b(?:division|div\.?|d)\s*-?\s*(iii|ii|i|3|2|1)\b", t)
    if m:
        return {"iii": "d3", "3": "d3", "ii": "d2", "2": "d2", "i": "d1", "1": "d1"}[m.group(1)]
    if t.strip() == "none":
        return "none"
    return None


async def _fact_check_recommendations(groups: list[dict], sport: Optional[str]) -> tuple[list[dict], int]:
    """Independent check: drop colleges that don't exist; blank out location / division / aid claims that don't hold.
    The checker states the division it believes is correct (rather than approving ours), and we compare — asking a
    model to confirm a claim invites agreement."""
    items = [(g, c) for g in groups for c in g["colleges"]]
    sport_part = f" in {sport}" if sport else ""
    listing = "\n".join(
        f"{i}. {c['name']} | stated location: {c['location'] or '-'} | aid claim: {c['aid_note'] or '-'}"
        for i, (_, c) in enumerate(items)
    )
    prompt = f"""You are a meticulous fact-checker for college information. For each numbered institution, answer from
your own knowledge (do not assume the line is correct):
- "exists": does this institution exist and currently operate under that name (at the stated location, if given)?
- "location_ok": is the stated location right? (null if "-")
- "division": which athletic association/division does it currently compete in{sport_part}? One of "NCAA Division I",
  "NCAA Division II", "NCAA Division III", "NAIA", "NJCAA", "none", or "unknown". Account for recent reclassifications.
- "aid_ok": is the aid claim accurate and not exaggerated? (null if "-" or unsure)

{listing}

Return ONLY a JSON object, no code fences:
{{"checks": [{{"i": 0, "exists": true, "location_ok": true, "division": "NCAA Division III", "aid_ok": null}}, ...]}}
with one entry per line, in order."""
    data = _parse_json(await _call_llm(prompt, max_tokens=150 * len(items) + 400))
    checks = data.get("checks") or []
    if len(checks) != len(items):
        raise ValueError("recommendation fact-check returned an unexpected number of results")
    removed = 0
    for (g, c), chk in zip(items, checks):
        chk = chk if isinstance(chk, dict) else {}
        if chk.get("exists") is not True:
            c["_drop"] = True
            removed += 1
            continue
        if chk.get("location_ok") is False:
            c["location"] = ""
        if c["division"] or g["key"] == "athletics":
            claimed, checked = _division_key(c["division"]), _division_key(str(chk.get("division") or ""))
            confirmed = claimed is not None and claimed == checked
            if g["key"] == "athletics" and not confirmed:
                # The division is the point of an athletics pick: keep it only when the independent check
                # states the same division (unknown or different → drop).
                c["_drop"] = True
                removed += 1
                continue
            if not confirmed:
                c["division"], c["athletics_note"] = "", ""
        if chk.get("aid_ok") is False:
            c["aid_note"] = ""
    for g in groups:
        g["colleges"] = [c for c in g["colleges"] if not c.pop("_drop", False)]
    return [g for g in groups if g["colleges"]], removed
