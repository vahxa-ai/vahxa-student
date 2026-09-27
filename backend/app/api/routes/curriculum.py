import asyncio
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.models import Subject, CurriculumUnit, Student, SampleTest
from app.schemas.schemas import CurriculumOut, CurriculumUnitOut, UnitDetails, PracticeQuestion
from app.services import ai_service, curriculum_library
from app.api.deps import get_approved_student
from app.api.routes.subjects import own_subject

router = APIRouter(prefix="/subjects/{subject_id}/curriculum", tags=["curriculum"])


async def _list_units(subject_id: int, db: AsyncSession) -> list[CurriculumUnit]:
    result = await db.execute(
        select(CurriculumUnit).where(CurriculumUnit.subject_id == subject_id).order_by(CurriculumUnit.position)
    )
    return list(result.scalars().all())


def _unit_out(unit: CurriculumUnit, from_library: bool = False) -> CurriculumUnitOut:
    return CurriculumUnitOut(
        id=unit.id,
        position=unit.position,
        title=unit.title,
        overview=unit.overview,
        details=UnitDetails(**json.loads(unit.details_json)) if unit.details_json else None,
        details_generated_at=unit.details_generated_at,
        practice=[PracticeQuestion(**q) for q in json.loads(unit.practice_json)] if unit.practice_json else None,
        practice_generated_at=unit.practice_generated_at,
        quiz_size=len(json.loads(unit.quiz_json)) if unit.quiz_json else None,   # never expose the answers here
        quiz_generated_at=unit.quiz_generated_at,
        from_library=from_library,
    )


def _curriculum_out(subject: Subject, units: list[CurriculumUnit], from_library: bool = False) -> CurriculumOut:
    return CurriculumOut(
        subject_id=subject.id,
        framework=subject.curriculum_framework,
        source=subject.curriculum_source,
        generated_at=subject.curriculum_generated_at,
        shared=subject.curriculum_library_key is not None,
        from_library=from_library,
        units=[_unit_out(u) for u in units],
    )


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(value).replace(tzinfo=None) if value else None
    except ValueError:
        return None


def _ai_http_error(e: Exception) -> HTTPException:
    if isinstance(e, ai_service.AIUnavailableError):
        return HTTPException(status_code=503, detail=str(e))
    if isinstance(e, (ValueError, KeyError, TypeError)):
        return HTTPException(status_code=502, detail="The AI returned an unexpected format. Please try again.")
    if isinstance(e, (RuntimeError, OSError)):
        return HTTPException(status_code=502, detail=f"AI request failed: {e}")
    raise e


async def _run_ai(coro):
    """Map AI failures to clean HTTP errors instead of an unhandled 500."""
    try:
        return await coro
    except (ai_service.AIUnavailableError, ValueError, KeyError, TypeError, RuntimeError, OSError) as e:
        raise _ai_http_error(e)


_QUIZ_GENERATION_CONCURRENCY = 4


async def ensure_quiz_banks(
    student: Student, subject: Subject, units: list[CurriculumUnit], db: AsyncSession, force: bool = False
) -> None:
    """Make sure each unit has a multiple-choice bank: local copy → shared library → Gemma (in parallel).
    force=True regenerates with Gemma and replaces the shared copy."""
    missing = [u for u in units if force or not u.quiz_json]
    if not missing:
        return

    key = subject.curriculum_library_key
    if key and not force:
        entry = await curriculum_library.lookup(key)
        shared_units = entry["units"] if entry else []
        still_missing = []
        for unit in missing:
            shared = shared_units[unit.position] if unit.position < len(shared_units) else None
            if shared and shared.get("title") == unit.title and shared.get("quiz"):
                unit.quiz_json = json.dumps(shared["quiz"])
                unit.quiz_generated_at = _parse_iso(shared.get("quiz_generated_at")) or datetime.utcnow()
            else:
                still_missing.append(unit)
        missing = still_missing

    if missing:
        gate = asyncio.Semaphore(_QUIZ_GENERATION_CONCURRENCY)

        async def generate(unit: CurriculumUnit):
            details = json.loads(unit.details_json) if unit.details_json else None
            async with gate:
                return await ai_service.generate_unit_quiz(student, subject, unit, details)

        results = await asyncio.gather(*(generate(u) for u in missing), return_exceptions=True)
        failures = [r for r in results if isinstance(r, Exception)]
        now = datetime.utcnow()
        for unit, bank in zip(missing, results):
            if isinstance(bank, Exception):
                continue
            unit.quiz_json = json.dumps(bank)
            unit.quiz_generated_at = now
            if key:
                await curriculum_library.publish_unit_quiz(key, unit.position, unit.title, bank)
        if failures:
            # The error response rolls the request's transaction back — commit first so the banks that
            # did succeed aren't lost (a retry then only regenerates the failed ones).
            await db.commit()
            raise _ai_http_error(failures[0])
    await db.flush()


async def _replace_units(subject: Subject, units: list[dict], db: AsyncSession) -> None:
    # Sample papers belong to the old units (attempts keep their own snapshot of the paper)
    await db.execute(delete(SampleTest).where(
        SampleTest.unit_id.in_(select(CurriculumUnit.id).where(CurriculumUnit.subject_id == subject.id))))
    await db.execute(delete(CurriculumUnit).where(CurriculumUnit.subject_id == subject.id))
    for i, u in enumerate(units):
        details, practice = u.get("details"), u.get("practice")
        db.add(CurriculumUnit(
            subject_id=subject.id,
            position=i,
            title=u["title"],
            overview=u.get("overview") or None,
            details_json=json.dumps(details) if details else None,
            details_generated_at=_parse_iso(u.get("details_generated_at")) if details else None,
            practice_json=json.dumps(practice) if practice else None,
            practice_generated_at=_parse_iso(u.get("practice_generated_at")) if practice else None,
            quiz_json=json.dumps(u["quiz"]) if u.get("quiz") else None,
            quiz_generated_at=_parse_iso(u.get("quiz_generated_at")) if u.get("quiz") else None,
        ))


@router.get("", response_model=CurriculumOut)
async def get_curriculum(subject_id: int, student: Student = Depends(get_approved_student),
                         db: AsyncSession = Depends(get_db)):
    subject = await own_subject(subject_id, student, db)
    return _curriculum_out(subject, await _list_units(subject_id, db))


@router.post("/generate", response_model=CurriculumOut)
async def generate_curriculum(subject_id: int, force: bool = False, student: Student = Depends(get_approved_student),
                              db: AsyncSession = Depends(get_db)):
    """Load the unit list. Uses the shared library for this student's category when possible;
    force=true (Regenerate) always calls the AI and replaces the shared copy."""
    subject = await own_subject(subject_id, student, db)
    cat = curriculum_library.category(student, subject)
    key = curriculum_library.category_key(cat) if cat else None

    if key and not force:
        entry = await curriculum_library.lookup(key)
        if entry:
            await _replace_units(subject, entry["units"], db)
            subject.curriculum_framework = entry.get("framework")
            subject.curriculum_source = "standards"
            subject.curriculum_generated_at = datetime.utcnow()
            subject.curriculum_library_key = key
            await db.flush()
            return _curriculum_out(subject, await _list_units(subject_id, db), from_library=True)

    outline = await _run_ai(ai_service.generate_curriculum_outline(student, subject))
    await _replace_units(subject, outline["units"], db)
    subject.curriculum_framework = outline["framework"]
    subject.curriculum_source = outline["source"]
    subject.curriculum_generated_at = datetime.utcnow()
    subject.curriculum_library_key = key
    await db.flush()

    if key:
        display = {"subject": subject.name, "grade": student.grade, "state": student.state, "country": student.country}
        await curriculum_library.publish(key, cat, display, outline["framework"], outline["units"])
    return _curriculum_out(subject, await _list_units(subject_id, db))


@router.post("/units/{unit_id}/details", response_model=CurriculumUnitOut)
async def generate_unit_details(
    subject_id: int, unit_id: int, force: bool = False,
    student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)
):
    """Summary, key concepts and formulas for one unit. Served from the local copy or the shared
    library when available; force=true (Refresh notes) always calls the AI and updates the shared copy."""
    subject = await own_subject(subject_id, student, db)
    unit = await db.get(CurriculumUnit, unit_id)
    if not unit or unit.subject_id != subject_id:
        raise HTTPException(status_code=404, detail="Unit not found")

    if unit.details_json and not force:
        return _unit_out(unit)

    key = subject.curriculum_library_key
    if key and not force:
        entry = await curriculum_library.lookup(key)
        units = entry["units"] if entry else []
        shared = units[unit.position] if unit.position < len(units) else None
        if shared and shared.get("title") == unit.title and shared.get("details"):
            unit.details_json = json.dumps(shared["details"])
            unit.details_generated_at = _parse_iso(shared.get("details_generated_at")) or datetime.utcnow()
            await db.flush()
            return _unit_out(unit, from_library=True)

    titles = [u.title for u in await _list_units(subject_id, db)]
    details = await _run_ai(ai_service.generate_unit_details(student, subject, unit, titles))
    unit.details_json = json.dumps(details)
    unit.details_generated_at = datetime.utcnow()
    await db.flush()

    if key:
        await curriculum_library.publish_unit_details(key, unit.position, unit.title, details)
    return _unit_out(unit)


async def _get_unit(subject_id: int, unit_id: int, db: AsyncSession) -> CurriculumUnit:
    unit = await db.get(CurriculumUnit, unit_id)
    if not unit or unit.subject_id != subject_id:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit


@router.post("/units/{unit_id}/practice", response_model=CurriculumUnitOut)
async def generate_unit_practice(
    subject_id: int, unit_id: int, force: bool = False,
    student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)
):
    """Exam-style practice questions with worked answers for one unit. Served from the local copy or the
    shared library when available; force=true (New questions) always calls the AI and updates the shared copy."""
    subject = await own_subject(subject_id, student, db)
    unit = await _get_unit(subject_id, unit_id, db)

    if unit.practice_json and not force:
        return _unit_out(unit)

    key = subject.curriculum_library_key
    if key and not force:
        entry = await curriculum_library.lookup(key)
        units = entry["units"] if entry else []
        shared = units[unit.position] if unit.position < len(units) else None
        if shared and shared.get("title") == unit.title and shared.get("practice"):
            unit.practice_json = json.dumps(shared["practice"])
            unit.practice_generated_at = _parse_iso(shared.get("practice_generated_at")) or datetime.utcnow()
            await db.flush()
            return _unit_out(unit, from_library=True)

    details = json.loads(unit.details_json) if unit.details_json else None
    practice = await _run_ai(ai_service.generate_unit_practice(student, subject, unit, details))
    unit.practice_json = json.dumps(practice)
    unit.practice_generated_at = datetime.utcnow()
    await db.flush()

    if key:
        await curriculum_library.publish_unit_practice(key, unit.position, unit.title, practice)
    return _unit_out(unit)


@router.post("/units/{unit_id}/quiz", response_model=CurriculumUnitOut)
async def prepare_unit_quiz(
    subject_id: int, unit_id: int, force: bool = False,
    student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)
):
    """Build (or with force=true, regenerate and replace the shared copy of) a unit's quiz question bank."""
    subject = await own_subject(subject_id, student, db)
    unit = await _get_unit(subject_id, unit_id, db)
    await ensure_quiz_banks(student, subject, [unit], db, force=force)
    return _unit_out(unit)
