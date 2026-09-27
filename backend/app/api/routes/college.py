"""College prep: college goals, a shared admissions guide per country, a personalized roadmap with a checklist,
a college list with AI summaries, and an activities & achievements log."""
import json
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_approved_student, get_admin
from app.api.routes.curriculum import _ai_http_error
from app.db.database import get_db
from app.models.models import (
    Student, User, CollegeProfile, AdmissionsGuide, CollegeRoadmap, CollegeEntry, Achievement,
)
from app.schemas.schemas import (
    CollegeProfileIn, CollegeProfileOut, AdmissionsGuideOut, GuideChapter, RoadmapOut, RoadmapStage,
    RoadmapMilestone, MilestoneUpdate, CollegeEntryIn, CollegeEntryUpdate, CollegeEntryOut, CollegeSummary,
    AchievementIn, AchievementOut,
)
from app.services import college_ai, ai_service
from app.services.curriculum_library import _norm_country

router = APIRouter(prefix="/college", tags=["college"])

MAX_COLLEGES = 40
MAX_ACHIEVEMENTS = 100


async def _run_ai(coro):
    try:
        return await coro
    except (ai_service.AIUnavailableError, ValueError, KeyError, TypeError, RuntimeError, OSError) as e:
        raise _ai_http_error(e)


async def _profile(student: Student, db: AsyncSession) -> Optional[CollegeProfile]:
    return (await db.execute(select(CollegeProfile).where(CollegeProfile.student_id == student.id))).scalar_one_or_none()


def _country(student: Student) -> tuple[str, str]:
    key = _norm_country(student.country)
    if not key:
        raise HTTPException(status_code=409, detail="Add your country in My Profile first.")
    return key, (student.country or "").strip()


# ─── College goals ────────────────────────────────────────────────────────────

@router.get("/profile", response_model=CollegeProfileOut)
async def get_college_profile(student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    p = await _profile(student, db)
    return CollegeProfileOut.model_validate(p, from_attributes=True) if p else CollegeProfileOut()


@router.put("/profile", response_model=CollegeProfileOut)
async def save_college_profile(payload: CollegeProfileIn, student: Student = Depends(get_approved_student),
                               db: AsyncSession = Depends(get_db)):
    p = await _profile(student, db)
    if not p:
        p = CollegeProfile(student_id=student.id)
        db.add(p)
    for k, v in payload.model_dump().items():
        setattr(p, k, (v.strip() or None) if isinstance(v, str) else v)
    p.updated_at = datetime.utcnow()
    await db.flush()
    return CollegeProfileOut.model_validate(p, from_attributes=True)


# ─── Admissions guide (shared per country) ────────────────────────────────────

def _guide_out(g: AdmissionsGuide, country: str) -> AdmissionsGuideOut:
    content = json.loads(g.content_json)
    return AdmissionsGuideOut(country=country, title=content["title"], intro=content.get("intro", ""),
                              chapters=[GuideChapter(**c) for c in content["chapters"]], generated_at=g.generated_at)


@router.get("/guide", response_model=Optional[AdmissionsGuideOut])
async def get_guide(student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    key, display = _country(student)
    g = (await db.execute(select(AdmissionsGuide).where(AdmissionsGuide.country_key == key))).scalar_one_or_none()
    return _guide_out(g, display) if g else None


async def _write_guide(key: str, display: str, db: AsyncSession) -> AdmissionsGuide:
    content = await _run_ai(college_ai.generate_admissions_guide(display))
    g = (await db.execute(select(AdmissionsGuide).where(AdmissionsGuide.country_key == key))).scalar_one_or_none()
    if g:
        g.content_json, g.generated_at = json.dumps(content), datetime.utcnow()
    else:
        g = AdmissionsGuide(country_key=key, content_json=json.dumps(content), generated_at=datetime.utcnow())
        db.add(g)
    await db.flush()
    return g


@router.post("/guide", response_model=AdmissionsGuideOut)
async def generate_guide(student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    """Create the guide for the student's country if it doesn't exist yet (shared by everyone there)."""
    key, display = _country(student)
    g = (await db.execute(select(AdmissionsGuide).where(AdmissionsGuide.country_key == key))).scalar_one_or_none()
    return _guide_out(g or await _write_guide(key, display, db), display)


@router.get("/admin/guides", response_model=list[AdmissionsGuideOut])
async def admin_list_guides(admin: User = Depends(get_admin), db: AsyncSession = Depends(get_db)):
    guides = (await db.execute(select(AdmissionsGuide).order_by(AdmissionsGuide.country_key))).scalars().all()
    return [_guide_out(g, g.country_key.title()) for g in guides]


@router.post("/admin/guides/{country_key}/regenerate", response_model=AdmissionsGuideOut)
async def admin_regenerate_guide(country_key: str, admin: User = Depends(get_admin), db: AsyncSession = Depends(get_db)):
    """Admins: rewrite a country's shared guide (e.g. after process changes)."""
    g = (await db.execute(select(AdmissionsGuide).where(AdmissionsGuide.country_key == country_key))).scalar_one_or_none()
    if not g:
        raise HTTPException(status_code=404, detail="No guide for that country")
    display = country_key.title()
    return _guide_out(await _write_guide(country_key, display, db), display)


# ─── Roadmap ──────────────────────────────────────────────────────────────────

def _norm_title(t: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()


def _roadmap_out(r: CollegeRoadmap) -> RoadmapOut:
    content, done = json.loads(r.content_json), json.loads(r.completed_json or "{}")
    stages, total, completed = [], 0, 0
    for st in content["stages"]:
        ms = []
        for m in st["milestones"]:
            at = done.get(m["id"])
            ms.append(RoadmapMilestone(**m, completed_at=datetime.fromisoformat(at) if at else None))
            total += 1
            completed += 1 if at else 0
        stages.append(RoadmapStage(id=st["id"], label=st["label"], focus=st["focus"], goals=st["goals"], milestones=ms))
    return RoadmapOut(overview=content.get("overview", ""), stages=stages, generated_at=r.generated_at,
                      completed=completed, total=total)


async def _roadmap(student: Student, db: AsyncSession) -> Optional[CollegeRoadmap]:
    return (await db.execute(select(CollegeRoadmap).where(CollegeRoadmap.student_id == student.id))).scalar_one_or_none()


@router.get("/roadmap", response_model=Optional[RoadmapOut])
async def get_roadmap(student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    r = await _roadmap(student, db)
    return _roadmap_out(r) if r else None


@router.post("/roadmap", response_model=RoadmapOut)
async def generate_roadmap(student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    """(Re)build the roadmap from the student's current grade, goals, colleges and activities.
    Checklist progress carries over for milestones with the same title."""
    _country(student)
    profile = await _profile(student, db)
    colleges = [f"{c.name} ({c.category})" for c in (await db.execute(
        select(CollegeEntry).where(CollegeEntry.student_id == student.id))).scalars().all()]
    achievements = [
        f"{a.title} — {a.category}" + (f", {a.role}" if a.role else "") + (f", grades {a.grades}" if a.grades else "")
        for a in (await db.execute(select(Achievement).where(Achievement.student_id == student.id))).scalars().all()
    ]
    content = await _run_ai(college_ai.generate_roadmap(student, profile, colleges, achievements))

    r = await _roadmap(student, db)
    done: dict = {}
    if r:
        old_done = json.loads(r.completed_json or "{}")
        old_titles = {_norm_title(m["title"]): old_done[m["id"]]
                      for st in json.loads(r.content_json)["stages"] for m in st["milestones"] if m["id"] in old_done}
        done = {m["id"]: old_titles[_norm_title(m["title"])]
                for st in content["stages"] for m in st["milestones"] if _norm_title(m["title"]) in old_titles}
        r.content_json, r.completed_json, r.generated_at = json.dumps(content), json.dumps(done), datetime.utcnow()
    else:
        r = CollegeRoadmap(student_id=student.id, content_json=json.dumps(content), completed_json="{}",
                           generated_at=datetime.utcnow())
        db.add(r)
    await db.flush()
    return _roadmap_out(r)


@router.patch("/roadmap/milestones/{milestone_id}", response_model=RoadmapOut)
async def update_milestone(milestone_id: str, payload: MilestoneUpdate,
                           student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    r = await _roadmap(student, db)
    ids = {m["id"] for st in json.loads(r.content_json)["stages"] for m in st["milestones"]} if r else set()
    if milestone_id not in ids:
        raise HTTPException(status_code=404, detail="Milestone not found")
    done = json.loads(r.completed_json or "{}")
    if payload.completed:
        done.setdefault(milestone_id, datetime.utcnow().isoformat())
    else:
        done.pop(milestone_id, None)
    r.completed_json = json.dumps(done)
    await db.flush()
    return _roadmap_out(r)


# ─── College list ─────────────────────────────────────────────────────────────

def _entry_out(e: CollegeEntry) -> CollegeEntryOut:
    return CollegeEntryOut(id=e.id, name=e.name, category=e.category, notes=e.notes,
                           summary=CollegeSummary(**json.loads(e.summary_json)) if e.summary_json else None,
                           summary_generated_at=e.summary_generated_at, created_at=e.created_at)


async def _own_entry(entry_id: int, student: Student, db: AsyncSession) -> CollegeEntry:
    e = await db.get(CollegeEntry, entry_id)
    if not e or e.student_id != student.id:
        raise HTTPException(status_code=404, detail="College not found")
    return e


@router.get("/colleges", response_model=list[CollegeEntryOut])
async def list_colleges(student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(CollegeEntry).where(CollegeEntry.student_id == student.id)
                             .order_by(CollegeEntry.created_at))).scalars().all()
    return [_entry_out(e) for e in rows]


@router.post("/colleges", response_model=CollegeEntryOut)
async def add_college(payload: CollegeEntryIn, student: Student = Depends(get_approved_student),
                      db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(CollegeEntry).where(CollegeEntry.student_id == student.id))).scalars().all()
    if len(existing) >= MAX_COLLEGES:
        raise HTTPException(status_code=409, detail=f"You can list up to {MAX_COLLEGES} colleges.")
    if any(e.name.strip().lower() == payload.name.strip().lower() for e in existing):
        raise HTTPException(status_code=409, detail="That college is already on your list.")
    e = CollegeEntry(student_id=student.id, name=payload.name.strip(), category=payload.category,
                     notes=(payload.notes or "").strip() or None)
    db.add(e)
    await db.flush()
    return _entry_out(e)


@router.patch("/colleges/{entry_id}", response_model=CollegeEntryOut)
async def update_college(entry_id: int, payload: CollegeEntryUpdate, student: Student = Depends(get_approved_student),
                         db: AsyncSession = Depends(get_db)):
    e = await _own_entry(entry_id, student, db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(e, k, (v.strip() or None) if isinstance(v, str) and k == "notes" else v)
    await db.flush()
    return _entry_out(e)


@router.delete("/colleges/{entry_id}", status_code=204)
async def delete_college(entry_id: int, student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    await db.delete(await _own_entry(entry_id, student, db))


@router.post("/colleges/{entry_id}/summary", response_model=CollegeEntryOut)
async def summarize_college(entry_id: int, student: Student = Depends(get_approved_student),
                            db: AsyncSession = Depends(get_db)):
    e = await _own_entry(entry_id, student, db)
    summary = await _run_ai(college_ai.generate_college_summary(student, await _profile(student, db), e.name))
    e.summary_json, e.summary_generated_at = json.dumps(summary), datetime.utcnow()
    await db.flush()
    return _entry_out(e)


# ─── Activities & achievements ────────────────────────────────────────────────

async def _own_achievement(item_id: int, student: Student, db: AsyncSession) -> Achievement:
    a = await db.get(Achievement, item_id)
    if not a or a.student_id != student.id:
        raise HTTPException(status_code=404, detail="Activity not found")
    return a


@router.get("/achievements", response_model=list[AchievementOut])
async def list_achievements(student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    return (await db.execute(select(Achievement).where(Achievement.student_id == student.id)
                             .order_by(Achievement.created_at))).scalars().all()


@router.post("/achievements", response_model=AchievementOut)
async def add_achievement(payload: AchievementIn, student: Student = Depends(get_approved_student),
                          db: AsyncSession = Depends(get_db)):
    count = len((await db.execute(select(Achievement.id).where(Achievement.student_id == student.id))).all())
    if count >= MAX_ACHIEVEMENTS:
        raise HTTPException(status_code=409, detail=f"You can record up to {MAX_ACHIEVEMENTS} activities.")
    a = Achievement(student_id=student.id, **payload.model_dump())
    db.add(a)
    await db.flush()
    await db.refresh(a)
    return a


@router.patch("/achievements/{item_id}", response_model=AchievementOut)
async def update_achievement(item_id: int, payload: AchievementIn, student: Student = Depends(get_approved_student),
                             db: AsyncSession = Depends(get_db)):
    a = await _own_achievement(item_id, student, db)
    for k, v in payload.model_dump().items():
        setattr(a, k, v)
    await db.flush()
    await db.refresh(a)
    return a


@router.delete("/achievements/{item_id}", status_code=204)
async def delete_achievement(item_id: int, student: Student = Depends(get_approved_student),
                             db: AsyncSession = Depends(get_db)):
    await db.delete(await _own_achievement(item_id, student, db))
