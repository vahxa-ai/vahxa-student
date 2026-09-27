import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.models import Subject, CurriculumUnit
from app.schemas.schemas import CurriculumOut, CurriculumUnitOut, UnitDetails
from app.services import ai_service
from app.api.routes.student import get_student_or_404

router = APIRouter(prefix="/subjects/{subject_id}/curriculum", tags=["curriculum"])


async def _get_subject(subject_id: int, db: AsyncSession) -> Subject:
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


async def _list_units(subject_id: int, db: AsyncSession) -> list[CurriculumUnit]:
    result = await db.execute(
        select(CurriculumUnit).where(CurriculumUnit.subject_id == subject_id).order_by(CurriculumUnit.position)
    )
    return list(result.scalars().all())


def _unit_out(unit: CurriculumUnit) -> CurriculumUnitOut:
    return CurriculumUnitOut(
        id=unit.id,
        position=unit.position,
        title=unit.title,
        overview=unit.overview,
        details=UnitDetails(**json.loads(unit.details_json)) if unit.details_json else None,
        details_generated_at=unit.details_generated_at,
    )


def _curriculum_out(subject: Subject, units: list[CurriculumUnit]) -> CurriculumOut:
    return CurriculumOut(
        subject_id=subject.id,
        framework=subject.curriculum_framework,
        source=subject.curriculum_source,
        generated_at=subject.curriculum_generated_at,
        units=[_unit_out(u) for u in units],
    )


async def _run_ai(coro):
    """Map AI failures to clean HTTP errors instead of an unhandled 500."""
    try:
        return await coro
    except ai_service.AIUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except (ValueError, KeyError, TypeError):
        raise HTTPException(status_code=502, detail="The AI returned an unexpected format. Please try again.")
    except (RuntimeError, OSError) as e:
        raise HTTPException(status_code=502, detail=f"AI request failed: {e}")


@router.get("", response_model=CurriculumOut)
async def get_curriculum(subject_id: int, db: AsyncSession = Depends(get_db)):
    subject = await _get_subject(subject_id, db)
    return _curriculum_out(subject, await _list_units(subject_id, db))


@router.post("/generate", response_model=CurriculumOut)
async def generate_curriculum(subject_id: int, db: AsyncSession = Depends(get_db)):
    """(Re)build the unit list. Replaces any existing units and their cached notes."""
    subject = await _get_subject(subject_id, db)
    student = await get_student_or_404(db)
    outline = await _run_ai(ai_service.generate_curriculum_outline(student, subject))

    await db.execute(delete(CurriculumUnit).where(CurriculumUnit.subject_id == subject_id))
    for i, u in enumerate(outline["units"]):
        db.add(CurriculumUnit(subject_id=subject_id, position=i, title=u["title"], overview=u["overview"] or None))
    subject.curriculum_framework = outline["framework"]
    subject.curriculum_source = outline["source"]
    subject.curriculum_generated_at = datetime.utcnow()
    await db.flush()
    return _curriculum_out(subject, await _list_units(subject_id, db))


@router.post("/units/{unit_id}/details", response_model=CurriculumUnitOut)
async def generate_unit_details(subject_id: int, unit_id: int, db: AsyncSession = Depends(get_db)):
    """Generate (or regenerate) the summary, key concepts and formulas for one unit."""
    subject = await _get_subject(subject_id, db)
    unit = await db.get(CurriculumUnit, unit_id)
    if not unit or unit.subject_id != subject_id:
        raise HTTPException(status_code=404, detail="Unit not found")
    student = await get_student_or_404(db)
    titles = [u.title for u in await _list_units(subject_id, db)]

    details = await _run_ai(ai_service.generate_unit_details(student, subject, unit, titles))
    unit.details_json = json.dumps(details)
    unit.details_generated_at = datetime.utcnow()
    await db.flush()
    return _unit_out(unit)
