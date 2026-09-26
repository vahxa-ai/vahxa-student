from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import FamilyMember, Subject, Activity, StudyPlan
from app.schemas.schemas import StudyPlanRequest, StudyPlanOut
from app.services import ai_service

router = APIRouter(prefix="/study-plans", tags=["study-plans"])


@router.post("/generate", response_model=StudyPlanOut)
async def generate_study_plan(
    payload: StudyPlanRequest,
    db: AsyncSession = Depends(get_db),
):
    member = await db.get(FamilyMember, payload.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.role.value not in ("student",):
        raise HTTPException(status_code=400, detail="Study plans are only for students")

    subjects_result = await db.execute(
        select(Subject).where(Subject.member_id == payload.member_id)
    )
    subjects = list(subjects_result.scalars().all())

    activities_result = await db.execute(
        select(Activity).where(Activity.member_id == payload.member_id)
    )
    activities = list(activities_result.scalars().all())

    content = await ai_service.generate_study_plan(
        member=member,
        subjects=subjects,
        activities=activities,
        week_start=payload.week_start,
        relax_minutes=payload.relax_time_per_day_minutes,
        additional_notes=payload.additional_notes,
    )

    plan = StudyPlan(
        member_id=payload.member_id,
        week_start=payload.week_start,
        content=content,
    )
    db.add(plan)
    await db.flush()
    await db.refresh(plan)
    return plan


@router.get("/member/{member_id}", response_model=list[StudyPlanOut])
async def list_study_plans(member_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StudyPlan)
        .where(StudyPlan.member_id == member_id)
        .order_by(StudyPlan.week_start.desc())
        .limit(20)
    )
    return result.scalars().all()
