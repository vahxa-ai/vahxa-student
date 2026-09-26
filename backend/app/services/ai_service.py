"""
AI Schedule Generation and Report using Groq (free) — Llama 3.3-70b.
Falls back gracefully if no API key is set.
"""
from datetime import date, time, timedelta
from typing import Optional
from groq import AsyncGroq

from app.core.config import settings
from app.models.models import FamilyMember, Activity, Subject


def _format_time(t: Optional[time]) -> str:
    if t is None:
        return "TBD"
    return t.strftime("%I:%M %p").lstrip("0")


def _build_study_plan_prompt(
    member: FamilyMember,
    subjects: list[Subject],
    activities: list[Activity],
    week_start: date,
    relax_minutes: int,
    additional_notes: Optional[str],
) -> str:
    week_end = week_start + timedelta(days=6)
    week_label = f"{week_start.strftime('%B %d')} – {week_end.strftime('%B %d, %Y')}"

    student_info = f"{member.name}"
    if member.age:
        student_info += f", age {member.age}"
    if member.school and member.grade:
        student_info += f", {member.grade} at {member.school}"

    # Build subjects section
    subject_lines = []
    for s in subjects:
        days_str = f" (class days: {s.class_days})" if s.class_days else ""
        hw_str = f"{s.homework_frequency.value} homework, ~{s.homework_duration_minutes} min/session"
        exam_str = f", EXAM on {s.exam_date.strftime('%b %d')}" if s.exam_date else ""
        notes_str = f" — {s.notes}" if s.notes else ""
        subject_lines.append(
            f"  • {s.name} [difficulty: {s.difficulty.value}]{days_str} | {hw_str}{exam_str}{notes_str}"
        )
    subjects_section = "\n".join(subject_lines) if subject_lines else "  (no subjects enrolled yet)"

    # Build weekly activity grid
    days = [week_start + timedelta(days=i) for i in range(7)]
    activity_lines = []
    for d in days:
        day_acts = []
        for act in activities:
            day_match = False
            if act.start_date and act.end_date:
                day_match = act.start_date <= d <= act.end_date
            elif act.start_date:
                day_match = act.start_date == d
            if act.recurrence.value != "none" and act.recurrence_days:
                day_match = d.strftime("%a") in act.recurrence_days
            if day_match:
                special_tag = " ⚠️ SPECIAL" if act.is_special else ""
                time_str = f" at {_format_time(act.start_time)}" if act.start_time else ""
                day_acts.append(f"{act.title} ({act.activity_type.value}{time_str}, {act.duration_minutes} min){special_tag}")
        acts_str = "; ".join(day_acts) if day_acts else "free"
        activity_lines.append(f"  {d.strftime('%A %b %d')}: {acts_str}")
    activities_section = "\n".join(activity_lines)

    notes_section = f"\nAdditional notes: {additional_notes}" if additional_notes else ""

    return f"""You are an expert academic planner. Create a realistic, balanced weekly study plan for a student.
Output ONLY valid GitHub-Flavored Markdown. Use markdown tables (pipe syntax) for ALL schedules and summaries — no prose lists for timetables.

Student: {student_info}
Week: {week_label}
Protected relax/free time per day: {relax_minutes} minutes minimum
{notes_section}

Enrolled Subjects:
{subjects_section}

Weekly Activity Schedule (fixed commitments):
{activities_section}

Requirements:
1. Schedule specific study sessions for each subject across the week
2. Harder subjects get more total time and priority morning/early-afternoon slots
3. Daily homework subjects get a slot every school day
4. Block at least {relax_minutes} min of free/relax time each day — non-negotiable
5. No study sessions during existing fixed activities — work around them
6. Add a 30-min review session 2 days before any upcoming exam
7. Flag ⚠️ SPECIAL events inline in the tables so they stand out
8. Saturday/Sunday: lighter study load, more free time

Output EXACTLY these sections in order (use pipe-table syntax for every table):

## 📚 Weekly Study Plan — {week_label}

### 📅 Day-by-Day Schedule

One table per day (Monday through Sunday). Each table has these columns:
| Time | Activity | Subject / Task | Duration | Notes |
|------|----------|---------------|----------|-------|

Rules for the day tables:
- Time column: 12-hour format (e.g. 7:00 AM)
- Activity column: "Study", "Homework", "Sports", "Meal", "Relax", "Sleep", or the activity name
- Subject / Task column: subject name + brief task (e.g. "Algebra — Ch.5 exercises")
- Duration column: e.g. "45 min"
- Notes column: exam countdowns, ⚠️ SPECIAL tags, tips

### 📊 Subject Summary

One summary table:
| Subject | Difficulty | Total Sessions | Total Hours | Homework Days | Exam Date | Days Until Exam |
|---------|-----------|---------------|-------------|---------------|-----------|----------------|

### ⚠️ Special Events This Week

Bullet list of any ⚠️ SPECIAL activities, with date and time.

### 💡 Study Tips

3–5 concise bullet tips tailored to this student's subject mix and week.

Generate the study plan now:"""


def _build_member_context(member: FamilyMember, activities: list[Activity], target_date: date) -> str:
    lines = [f"- {member.name} ({member.role.value}"]
    if member.age:
        lines[0] += f", age {member.age}"
    if member.school and member.grade:
        lines[0] += f", {member.grade} at {member.school}"
    lines[0] += ")"

    for act in activities:
        day_match = True
        if act.start_date and act.end_date:
            day_match = act.start_date <= target_date <= act.end_date
        elif act.start_date:
            day_match = act.start_date == target_date

        if act.recurrence.value != "none" and act.recurrence_days:
            weekday = target_date.strftime("%a")
            day_match = weekday in act.recurrence_days

        if day_match:
            time_str = _format_time(act.start_time)
            special_tag = " ⭐ SPECIAL EVENT" if act.is_special else ""
            lines.append(
                f"  • {act.title} ({act.activity_type.value}) at {time_str}, {act.duration_minutes} min"
                + (f" @ {act.location}" if act.location else "")
                + special_tag
            )
    return "\n".join(lines)


def _build_schedule_prompt(
    family_name: str,
    target_date: date,
    end_date: Optional[date],
    start_time: Optional[time],
    end_time: Optional[time],
    location: Optional[str],
    members: list[FamilyMember],
    all_activities: dict[int, list[Activity]],
    focus_member: Optional[FamilyMember],
    additional_notes: Optional[str],
    custom_prompt: Optional[str],
) -> str:
    is_multi_day = end_date and end_date > target_date
    date_str = (
        f"{target_date.strftime('%A, %B %d')} – {end_date.strftime('%A, %B %d, %Y')}"
        if is_multi_day
        else target_date.strftime("%A, %B %d, %Y")
    )

    active_members = [focus_member] if focus_member else members

    # ── Fixed calendar activities ──────────────────────────────────────────────
    member_contexts = [
        _build_member_context(m, all_activities.get(m.id, []), target_date)
        for m in active_members
    ]
    fixed_activities_section = "\n".join(member_contexts)

    # ── Daily schedule templates (from structured sections) ────────────────────
    template_blocks = []
    for m in active_members:
        if m.default_prompt and m.default_prompt.strip():
            template_blocks.append(
                f"=== {m.name} ({m.role.value}) ===\n{m.default_prompt.strip()}"
            )

    templates_section = ""
    if template_blocks:
        templates_section = (
            "\n--- Daily Schedule Templates ---\n"
            "Each member's typical day is broken into timeframe sections below.\n"
            "Use these as the base schedule. Activities listed in each section should appear "
            "under the matching timeframe in the output.\n"
            "IMPORTANT: Any activity that appears in the same section across MULTIPLE members "
            "(e.g. Breakfast, Family dinner, Morning routine) → assign Who = \"👨‍👩‍👧 Family\".\n"
            "Activities unique to one person → assign Who = that member's name.\n\n"
            + "\n\n".join(template_blocks)
            + "\n--- End of Templates ---\n"
        )

    # ── Optional fields ────────────────────────────────────────────────────────
    time_window = ""
    if start_time and end_time:
        time_window = f"\nSchedule window: {_format_time(start_time)} – {_format_time(end_time)}"
    elif start_time:
        time_window = f"\nStarts at: {_format_time(start_time)}"
    elif end_time:
        time_window = f"\nEnds by: {_format_time(end_time)}"

    location_line = f"\nPrimary location: {location}" if location else ""
    notes_line = f"\nAdditional notes: {additional_notes}" if additional_notes else ""

    focus_instruction = (
        f"Generate a schedule ONLY for {focus_member.name}. Do not include other members."
        if focus_member
        else "Generate a unified schedule for the entire family."
    )
    who_rule = (
        f'Use "{focus_member.name}" in the Who column for every row.'
        if focus_member
        else 'Use "👨‍👩‍👧 Family" for shared activities (meals, morning routine, bedtime); use the member\'s name for individual activities.'
    )
    multi_day_note = "Repeat the four sections for EACH day, with a ### Date heading above them." if is_multi_day else ""

    return f"""You are a smart family schedule assistant. {focus_instruction}
Output ONLY valid GitHub-Flavored Markdown with pipe tables. No prose paragraphs for time slots.

Family: {family_name}
Date: {date_str}{time_window}{location_line}{notes_line}

{templates_section}
Fixed calendar activities for this period:
{fixed_activities_section}

REQUIRED OUTPUT FORMAT:

## 📅 Schedule — {date_str}

{multi_day_note}
Organise every activity into FOUR timeframe sections. Use the start/end times from the member templates above (or sensible defaults). Each section has its own pipe table:

### 🌅 Morning
| Time | Who | Activity | Duration | Notes |
|------|-----|----------|----------|-------|

### 🏫 School / Office Time
| Time | Who | Activity | Duration | Notes |
|------|-----|----------|----------|-------|

### ⚽ After School / Work
| Time | Who | Activity | Duration | Notes |
|------|-----|----------|----------|-------|

### 🌙 Evening
| Time | Who | Activity | Duration | Notes |
|------|-----|----------|----------|-------|

Column rules:
- **Time**: 12-hour format (e.g. 7:00 AM), rows sorted chronologically within each section
- **Who**: {who_rule}
- **Activity**: short clear label (e.g. "Breakfast", "Soccer Practice", "Homework")
- **Duration**: e.g. "30 min", "1 hr"
- **Notes**: ⚠️ conflicts, ⭐ SPECIAL tags, travel buffers

Rules:
1. Every member must appear in at least one section — no one gets omitted
2. Place each fixed calendar activity in the correct timeframe section
3. Fill the remaining slots from the daily templates
4. Add ⚠️ in Notes for any time conflicts
5. Include all meals — Breakfast, Lunch, Dinner — even if not in templates

After the sections:

## ⚠️ Conflicts & Notes
Bullet list of scheduling conflicts and reminders.

## 💡 Tips for the Day
3–5 practical tips for this specific day.

Generate the schedule now:"""


def _build_report_prompt(
    family_name: str,
    report_type: str,
    anchor_date: date,
    members: list[FamilyMember],
    all_activities: dict[int, list[Activity]],
    focus_member: Optional[FamilyMember],
) -> str:
    if report_type == "weekly":
        days = [anchor_date + timedelta(days=i) for i in range(7)]
        date_range = f"{anchor_date.strftime('%B %d')} – {days[-1].strftime('%B %d, %Y')}"
        title = f"Weekly Schedule Report — {date_range}"
        scope = f"Generate a comprehensive weekly report covering {date_range}."
        day_sections = []
        for d in days:
            day_acts = []
            for m in members:
                for act in all_activities.get(m.id, []):
                    day_match = False
                    if act.start_date and act.end_date:
                        day_match = act.start_date <= d <= act.end_date
                    elif act.start_date:
                        day_match = act.start_date == d
                    if act.recurrence.value != "none" and act.recurrence_days:
                        day_match = d.strftime("%a") in act.recurrence_days
                    if day_match:
                        day_acts.append(f"  [{m.name}] {act.title} ({act.activity_type.value})"
                                        + (f" at {_format_time(act.start_time)}" if act.start_time else ""))
            if day_acts:
                day_sections.append(f"**{d.strftime('%A, %B %d')}:**\n" + "\n".join(day_acts))
            else:
                day_sections.append(f"**{d.strftime('%A, %B %d')}:** No scheduled activities")
        activities_text = "\n\n".join(day_sections)
        structure = """
Report structure:
## 📊 Weekly Overview
- Total scheduled activities, breakdown by type
- Busiest day / lightest day

## 📅 Day-by-Day Summary
(brief paragraph per day highlighting key events)

## ⚠️ Conflicts & Overlaps
(list any scheduling conflicts found)

## 👨‍👩‍👧 Per-Member Highlights
(brief highlight per family member)

## 💡 Weekly Recommendations
(3-5 actionable suggestions to improve the week)

## ✅ Action Items
(concrete tasks to prepare for the week)"""
    else:
        days = [anchor_date]
        date_range = anchor_date.strftime("%A, %B %d, %Y")
        title = f"Daily Schedule Report — {date_range}"
        scope = f"Generate a detailed daily report for {date_range}."
        day_acts = []
        for m in members:
            for act in all_activities.get(m.id, []):
                day_match = False
                if act.start_date and act.end_date:
                    day_match = act.start_date <= anchor_date <= act.end_date
                elif act.start_date:
                    day_match = act.start_date == anchor_date
                if act.recurrence.value != "none" and act.recurrence_days:
                    day_match = anchor_date.strftime("%a") in act.recurrence_days
                if day_match:
                    day_acts.append(f"  [{m.name}] {act.title} ({act.activity_type.value})"
                                    + (f" at {_format_time(act.start_time)}" if act.start_time else ""))
        activities_text = "\n".join(day_acts) if day_acts else "No scheduled activities"
        structure = """
Report structure:
## 📋 Day at a Glance
- Quick summary of the day

## ⏰ Detailed Timeline
(hour-by-hour breakdown for all family members)

## ⚠️ Conflicts & Overlaps
(any scheduling issues)

## 👨‍👩‍👧 Per-Member Breakdown
(what each family member has today)

## 🎯 Priorities
(top 3 priorities for the day)

## 💡 Daily Tips
(practical tips for making the day run smoothly)"""

    focus_note = (
        f"\nFocus the report on: {focus_member.name}"
        if focus_member
        else "\nCover all family members."
    )
    members_text = "\n".join(
        f"- {m.name} ({m.role.value}{f', age {m.age}' if m.age else ''}"
        + (f", {m.grade} at {m.school}" if m.school else "") + ")"
        for m in members
    )

    return f"""You are a family schedule analyst. {scope}

Family: {family_name}{focus_note}

Family members:
{members_text}

Activities for this period:
{activities_text}

{structure}

Use markdown with emojis. Be specific, practical, and actionable. Generate the report now:"""


async def _call_groq(prompt: str, max_tokens: int = 2048) -> str:
    client = AsyncGroq(api_key=settings.groq_api_key)
    response = await client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {
                "role": "system",
                "content": "You are a helpful family schedule assistant. Generate well-organized, practical output using markdown.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


async def generate_schedule(
    family_name: str,
    target_date: date,
    members: list[FamilyMember],
    all_activities: dict[int, list[Activity]],
    end_date: Optional[date] = None,
    start_time: Optional[time] = None,
    end_time: Optional[time] = None,
    location: Optional[str] = None,
    focus_member: Optional[FamilyMember] = None,
    additional_notes: Optional[str] = None,
    custom_prompt: Optional[str] = None,
) -> str:
    prompt = _build_schedule_prompt(
        family_name, target_date, end_date, start_time, end_time, location,
        members, all_activities, focus_member, additional_notes, custom_prompt,
    )
    if not settings.groq_api_key:
        return _fallback_schedule(target_date, members, focus_member)
    return await _call_groq(prompt, max_tokens=2048)


def _build_unified_prompt(
    family_name: str,
    start_date: date,
    end_date: Optional[date],
    start_time: Optional[time],
    end_time: Optional[time],
    location: Optional[str],
    members: list[FamilyMember],
    all_activities: dict[int, list[Activity]],
    all_subjects: dict[int, list[Subject]],
    focus_member: Optional[FamilyMember],
    relax_minutes: int,
    include_study: bool,
    all_study_plans: dict,
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

    is_focused = focus_member is not None
    scope = focus_member.name if is_focused else f"all {len(members)} family members"
    active_members = [focus_member] if is_focused else members

    # Per-day activity summary for context
    day_contexts = []
    for d in days:
        acts = []
        for m in active_members:
            for act in all_activities.get(m.id, []):
                hit = False
                if act.start_date and act.end_date:
                    hit = act.start_date <= d <= act.end_date
                elif act.start_date:
                    hit = act.start_date == d
                if act.recurrence.value != "none" and act.recurrence_days:
                    hit = d.strftime("%a") in act.recurrence_days
                if hit:
                    tag = " ⚠️SPECIAL" if act.is_special else ""
                    t = f" at {_format_time(act.start_time)}" if act.start_time else ""
                    acts.append(f"  [{m.name}] {act.title} ({act.activity_type.value}{t}, {act.duration_minutes} min){tag}")
        day_contexts.append(
            f"**{d.strftime('%A %b %d')}:** " + ("; ".join(a.strip() for a in acts) if acts else "no fixed activities")
        )

    # Subjects for student members
    subject_lines = []
    for m in active_members:
        subs = all_subjects.get(m.id, [])
        if subs:
            for s in subs:
                exam = f", EXAM {s.exam_date.strftime('%b %d')}" if s.exam_date else ""
                subject_lines.append(
                    f"  [{m.name}] {s.name} – {s.difficulty.value} difficulty, "
                    f"{s.homework_frequency.value} HW {s.homework_duration_minutes} min/session"
                    f"{exam}"
                )

    subjects_section = (
        "Enrolled subjects:\n" + "\n".join(subject_lines)
        if subject_lines else ""
    )

    time_window = ""
    if start_time and end_time:
        time_window = f"Day window: {_format_time(start_time)} – {_format_time(end_time)}\n"
    elif start_time:
        time_window = f"Day starts at: {_format_time(start_time)}\n"
    elif end_time:
        time_window = f"Day ends by: {_format_time(end_time)}\n"

    location_line = f"Primary location: {location}\n" if location else ""
    notes_line = f"Notes: {additional_notes}\n" if additional_notes else ""
    custom_section = (
        f"\n--- User's Daily Routine & Preferences ---\n{custom_prompt.strip()}\n"
        f"--- End of Preferences ---\n"
        if custom_prompt and custom_prompt.strip() else ""
    )
    study_instruction = (
        "7. Insert 📚 Study/Homework rows for each student subject on appropriate days — "
        f"respect the homework frequency, difficulty, and protect {relax_minutes} min relax per day.\n"
        "8. Add a 30-min 📖 Review row 2 days before any upcoming exam."
        if include_study and subject_lines else ""
    )

    # Per-member daily schedule templates
    member_prompt_blocks = []
    for m in active_members:
        dp = getattr(m, "default_prompt", None)
        if dp and dp.strip():
            member_prompt_blocks.append(f"=== {m.name} ({m.role.value}) ===\n{dp.strip()}")
    member_prompts_section = ""
    if member_prompt_blocks:
        member_prompts_section = (
            "Daily schedule templates (structured by timeframe):\n"
            "Activities common across multiple members → Who = \"👨‍👩‍👧 Family\".\n"
            "Activities unique to one member → Who = that member's name.\n\n"
            + "\n\n".join(member_prompt_blocks)
        )

    # Saved study plans — give the AI the pre-built weekly schedule for each student
    study_plan_blocks = []
    for m in active_members:
        sp = all_study_plans.get(m.id)
        if sp:
            week_label = sp.week_start.strftime("%B %d, %Y")
            # Truncate very long plans to keep the prompt manageable
            content_preview = sp.content[:2000] + "\n...(truncated)" if len(sp.content) > 2000 else sp.content
            study_plan_blocks.append(
                f"=== {m.name}'s saved study plan (week of {week_label}) ===\n{content_preview}"
            )
    study_plans_section = (
        "Saved study plans — use these to schedule study/homework rows accurately:\n\n"
        + "\n\n".join(study_plan_blocks)
        if study_plan_blocks else ""
    )

    if is_focused:
        member_instruction = (
            f"1. Generate the plan ONLY for {focus_member.name} — do NOT include other family members\n"
            f"2. Use \"{focus_member.name}\" in the Member column for every row\n"
            "3. Never overlap time slots"
        )
        member_col_note = f"Member column: always \"{focus_member.name}\""
    else:
        member_instruction = (
            "1. Include EVERY family member — no gaps in time\n"
            "2. For shared activities (meals, morning, bedtime) use \"👨‍👩‍👧 Family\" in Member column\n"
            "3. Never overlap time slots for the same member"
        )
        member_col_note = "For shared activities use \"👨‍👩‍👧 Family\" in Member column"

    return f"""You are a family planning expert. Generate a UNIFIED daily planner for {family_name} covering {scope}.
Output ONLY valid GitHub-Flavored Markdown with pipe tables. No prose paragraphs for time slots.

Period: {date_label}
{time_window}{location_line}{notes_line}{custom_section}
Fixed commitments per day:
{chr(10).join(day_contexts)}

{subjects_section}

{member_prompts_section}

{study_plans_section}

REQUIRED OUTPUT FORMAT:

## 📅 {"Personal Planner" if is_focused else "Unified Family Planner"} — {scope} — {date_label}

{"Repeat the four timeframe sections below for EACH day, with a ### Date heading above them." if is_multi else ""}

Organise every activity into FOUR timeframe sections. Use the start/end times from the member templates (or sensible defaults). Each section has its own pipe table:

### 🌅 Morning
| Time | Who | Activity / Study Task | Duration | Notes |
|------|-----|-----------------------|----------|-------|

### 🏫 School / Office Time
| Time | Who | Activity / Study Task | Duration | Notes |
|------|-----|-----------------------|----------|-------|

### ⚽ After School / Work
| Time | Who | Activity / Study Task | Duration | Notes |
|------|-----|-----------------------|----------|-------|

### 🌙 Evening
| Time | Who | Activity / Study Task | Duration | Notes |
|------|-----|-----------------------|----------|-------|

Column rules:
- **Time**: 12-hour format (7:00 AM), rows chronological within section
- **Who**: {member_col_note}
- **Activity / Study Task**: short label + subject for study rows (e.g. "Homework — Maths")
- **Duration**: e.g. "45 min", "1 hr"
- **Notes**: ⚠️ conflicts, ⭐ SPECIAL tags, travel buffers, exam countdowns

Rules:
{member_instruction}
4. Mark ⚠️ in Notes for any special activity or conflict
{study_instruction}
5. Use 12-hour time (7:00 AM)
6. Include all meals — Breakfast, Lunch, Dinner — even if not in templates

After all sections:

## 📊 Subject Summary

| Subject | Student | Difficulty | HW Frequency | Sessions This Period | Est. Hours | Exam Date |
|---------|---------|-----------|-------------|---------------------|-----------|-----------|

(Omit if no student subjects exist.)

## ⚠️ Special Events & Conflicts

Bullet list of special/one-off events and any scheduling conflicts, with date, time, member.

## 💡 Tips

3–5 concise tips{"for " + focus_member.name if is_focused else " for this family/week"}.

Generate the unified plan now:"""


async def generate_unified_plan(
    family_name: str,
    start_date: date,
    members: list[FamilyMember],
    all_activities: dict[int, list[Activity]],
    all_subjects: dict[int, list[Subject]],
    end_date: Optional[date] = None,
    start_time: Optional[time] = None,
    end_time: Optional[time] = None,
    location: Optional[str] = None,
    focus_member: Optional[FamilyMember] = None,
    relax_minutes: int = 60,
    include_study: bool = True,
    all_study_plans: dict = {},
    custom_prompt: Optional[str] = None,
    additional_notes: Optional[str] = None,
) -> str:
    prompt = _build_unified_prompt(
        family_name, start_date, end_date, start_time, end_time, location,
        members, all_activities, all_subjects, focus_member,
        relax_minutes, include_study, all_study_plans, custom_prompt, additional_notes,
    )
    if not settings.groq_api_key:
        return _fallback_unified(start_date, end_date)
    return await _call_groq(prompt, max_tokens=4096)


def _fallback_unified(start_date: date, end_date: Optional[date]) -> str:
    label = start_date.strftime("%B %d, %Y")
    return f"""## 📅 Unified Family Planner — {label}

> *Unified plan generation requires a Groq API key.*
> *Add `GROQ_API_KEY` to `backend/.env` — free at [console.groq.com](https://console.groq.com)*

| Time | Member | Activity / Study Task | Type | Duration | Location | Notes |
|------|--------|-----------------------|------|----------|----------|-------|
| 7:00 AM | 👨‍👩‍👧 Family | Wake up & Morning Routine | 🌅 Morning | 30 min | Home | |
| 7:30 AM | 👨‍👩‍👧 Family | Breakfast | 🍳 Breakfast | 30 min | Home | |
| 8:00 AM | — | *(add activities to see your schedule here)* | | | | |
| 6:30 PM | 👨‍👩‍👧 Family | Family Dinner | 🍽️ Dinner | 45 min | Home | |
| 9:00 PM | 👨‍👩‍👧 Family | Wind-down | 😴 Sleep | 30 min | Home | |

## 💡 Tips
- Add your Groq API key to enable AI-powered planning
- Add family members and their activities first
- Students: add subjects to include study sessions
"""


async def generate_study_plan(
    member: FamilyMember,
    subjects: list[Subject],
    activities: list[Activity],
    week_start: date,
    relax_minutes: int = 60,
    additional_notes: Optional[str] = None,
) -> str:
    prompt = _build_study_plan_prompt(
        member, subjects, activities, week_start, relax_minutes, additional_notes
    )
    if not settings.groq_api_key:
        return _fallback_study_plan(member.name, week_start)
    return await _call_groq(prompt, max_tokens=3000)


async def generate_report(
    family_name: str,
    report_type: str,
    anchor_date: date,
    members: list[FamilyMember],
    all_activities: dict[int, list[Activity]],
    focus_member: Optional[FamilyMember] = None,
) -> str:
    prompt = _build_report_prompt(
        family_name, report_type, anchor_date, members, all_activities, focus_member
    )
    if not settings.groq_api_key:
        return _fallback_report(report_type, anchor_date)
    return await _call_groq(prompt, max_tokens=3000)


def _fallback_schedule(
    target_date: date,
    members: list[FamilyMember],
    focus_member: Optional[FamilyMember],
) -> str:
    date_str = target_date.strftime("%A, %B %d, %Y")
    names = focus_member.name if focus_member else ", ".join(m.name for m in members)
    return f"""## 📅 Schedule — {date_str}

> *AI schedule generation requires a Groq API key. Add `GROQ_API_KEY` to `backend/.env` — free at [console.groq.com](https://console.groq.com)*

### Schedule for: {names}

| Time | Member | Activity | Type | Duration | Location | Notes |
|------|--------|----------|------|----------|----------|-------|
| 7:00 AM | 👨‍👩‍👧 Family | Wake up & Morning Routine | 🌅 Morning | 30 min | Home | |
| 7:30 AM | 👨‍👩‍👧 Family | Breakfast | 🍳 Breakfast | 30 min | Home | |
| 8:00 AM | 👨‍👩‍👧 Family | Departure / Start of Day | 💼 Work | 15 min | | |
| 12:00 PM | 👨‍👩‍👧 Family | Lunch | 🍽️ Lunch | 45 min | | |
| 3:00 PM | 👨‍👩‍👧 Family | After-school activities | ⚽ Sports | 1 hr | | |
| 5:00 PM | 👨‍👩‍👧 Family | Homework / Work wrap-up | 📚 Study | 1 hr | Home | |
| 6:30 PM | 👨‍👩‍👧 Family | Family Dinner | 🍜 Dinner | 45 min | Home | |
| 7:30 PM | 👨‍👩‍👧 Family | Family Time | 👨‍👩‍👧 Family | 1 hr | Home | |
| 9:00 PM | 👨‍👩‍👧 Family | Wind-down & Bedtime | 😴 Bedtime | 30 min | Home | |

## 💡 Tips for the Day
- Stay hydrated throughout the day
- Check in with each family member
- Plan tomorrow's priorities tonight
"""


def _fallback_study_plan(student_name: str, week_start: date) -> str:
    return f"""# 📚 Study Plan — {student_name}
## Week of {week_start.strftime("%B %d, %Y")}

> *Study plan generation requires a Groq API key. Add GROQ_API_KEY to your .env file.*

Add your Groq API key to generate AI-optimized study plans.
"""


async def generate_shopping_health_advice(history: list, family_name: str) -> str:
    if not history:
        return "No purchase history yet. Start checking off items to track your shopping and get personalised health advice."

    from collections import Counter
    from datetime import datetime

    # Summarise purchases
    category_counts: Counter = Counter()
    item_list: list[str] = []
    for rec in history:
        category_counts[rec.category] += 1
        try:
            dt = datetime.fromisoformat(rec.purchased_at.replace("Z", "+00:00"))
            date_str = dt.strftime("%b %d")
        except Exception:
            date_str = rec.purchased_at[:10]
        item_list.append(f"  - {rec.name} ({rec.category}) — {date_str}")

    category_summary = "\n".join(
        f"  {cat}: {count} item{'s' if count > 1 else ''}"
        for cat, count in category_counts.most_common()
    )
    items_text = "\n".join(item_list[-50:])  # last 50 records

    prompt = f"""You are a family nutritionist and health advisor. Analyse the shopping history below and provide practical, personalised dietary advice for {family_name}.

Shopping history (recent purchases):
{items_text}

Category breakdown:
{category_summary}

Provide your response in structured markdown with these sections:

## 🥗 Diet Balance Analysis
Assess how balanced the shopping is across food groups (fruits/vegetables, proteins, dairy, grains, etc.). Be specific about what is well-covered and what is lacking.

## ⚠️ Nutritional Gaps
List specific nutrient or food group gaps identified from the purchase patterns.

## ✅ Healthy Habits
Highlight any positive patterns observed in their shopping.

## 💡 Recommendations
Give 5–7 specific, actionable recommendations to improve diet balance. For each, suggest actual food items to add to the next shopping list.

## 🛒 Suggested Items for Next Shop
A bullet list of 8–12 specific items to buy next time to balance the diet, grouped by category.

Be warm, encouraging, and practical. Avoid being preachy. Generate the advice now:"""

    if not _get_groq_key():
        return """## 🥗 Diet Balance Analysis
> *Health advice requires a Groq API key. Add `GROQ_API_KEY` to `backend/.env` — free at [console.groq.com](https://console.groq.com)*

Your purchase history is being tracked. Once the API key is configured, you'll receive personalised dietary advice based on your shopping patterns."""

    return await _call_groq(prompt, max_tokens=2000)


async def generate_store_recommendations(items: list[dict], family_name: str) -> str:
    if not items:
        return "## 🛒 No Items\n\nAdd items to your shopping list first to get store recommendations."

    from collections import defaultdict
    by_category: dict = defaultdict(list)
    for item in items:
        by_category[item["category"]].append(item["name"])

    items_text = "\n".join(
        f"  • {item['name']} ({item['category']})" for item in items
    )
    categories_text = "\n".join(
        f"  {cat}: {', '.join(names)}" for cat, names in by_category.items()
    )

    prompt = f"""You are a smart budget shopping advisor for {family_name}. Analyse the shopping list below and recommend the best stores to buy each group of items from, focusing on price advantage, quality, and convenience.

Shopping list ({len(items)} items):
{items_text}

By category:
{categories_text}

Provide your response in structured GitHub-Flavored Markdown with these sections:

## 🏪 Store Recommendations by Item Group
For each store you recommend, list which items to buy there and why it offers the best value. Use a table:
| Store | Best For | Items to Buy | Why |
|-------|----------|--------------|-----|
Consider stores like: Walmart, Costco/Sam's Club, Aldi, Lidl, Trader Joe's, Whole Foods, Target, local farmers markets, ethnic grocery stores, and online (Amazon Fresh / Instacart). Only recommend stores relevant to the item types.

## 💰 Top Savings Tips
5–7 specific tips tailored to this exact list — bulk buying opportunities, store-brand swaps, seasonal produce picks, loyalty programme benefits, etc.

## 🗺️ Suggested Shopping Route
A practical one-trip or two-trip plan to cover all items with minimum cost and travel. E.g.: "Stop 1: Aldi (produce + dairy), Stop 2: Costco (pantry staples in bulk)".

## 📊 Estimated Savings Breakdown
A rough estimate of savings vs buying everything at a single mid-range supermarket (expressed as a percentage range, e.g., "20–35% cheaper").

Be concise, practical, and specific to the actual items listed. Generate the recommendations now:"""

    if not _get_groq_key():
        return """## 🏪 Store Recommendations

> *Store recommendations require a Groq API key. Add `GROQ_API_KEY` to `backend/.env` — free at [console.groq.com](https://console.groq.com)*

Your shopping list is ready. Once the API key is configured, you'll get AI-powered store recommendations with price advantage tips."""

    return await _call_groq(prompt, max_tokens=2000)


def _get_groq_key() -> str:
    return getattr(settings, "groq_api_key", "") or ""


def _fallback_report(report_type: str, anchor_date: date) -> str:
    return f"""# 📊 {report_type.capitalize()} Report — {anchor_date.strftime("%B %d, %Y")}

> *Report generation requires a Groq API key. Add GROQ_API_KEY to your .env file.*
> *Get a free key at [console.groq.com](https://console.groq.com)*

Add your Groq API key to enable AI-powered schedule reports.
"""


async def generate_reminders(
    member_name: str,
    today: date,
    deadlines: list[dict],
) -> str:
    if not deadlines:
        return "## ✅ No Upcoming Deadlines\n\nNo open deadlines found. Add assignments, exams, or essays to get personalised reminders."

    deadline_lines = []
    for d in deadlines:
        from datetime import datetime
        due = datetime.fromisoformat(d["due_date"]).date()
        days_left = (due - today).days
        urgency = "🔴 URGENT" if days_left <= 3 else "🟡 Soon" if days_left <= 7 else "🟢 Upcoming"
        subject_part = f" [{d['subject']}]" if d["subject"] else ""
        desc_part = f" — {d['description']}" if d["description"] else ""
        deadline_lines.append(
            f"  • {urgency} {d['title']}{subject_part} ({d['type']}) — due {d['due_date']} ({days_left} days){desc_part}"
        )

    lines_text = "\n".join(deadline_lines)

    prompt = f"""You are a smart student reminder assistant. Generate a clear, actionable reminder plan for {member_name}.

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

    if not settings.groq_api_key:
        return f"""## 📋 Deadline Overview

> *Reminder generation requires a Groq API key. Add `GROQ_API_KEY` to `backend/.env` — free at [console.groq.com](https://console.groq.com)*

You have {len(deadlines)} upcoming deadline(s):

{chr(10).join(f"- **{d['title']}** ({d['type']}) — due {d['due_date']}" for d in deadlines)}
"""

    return await _call_groq(prompt, max_tokens=2500)
