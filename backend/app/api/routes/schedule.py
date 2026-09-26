from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import Family, FamilyMember, Activity, GeneratedSchedule, Subject, StudyPlan
from app.schemas.schemas import (
    ScheduleGenerateRequest, ScheduleOut,
    ReportRequest, ReportOut,
    UnifiedPlanRequest, UnifiedPlanOut,
)
from app.services import ai_service

router = APIRouter(prefix="/schedules", tags=["schedules"])


async def _load_family_data(family_id: int, db: AsyncSession):
    family = await db.get(Family, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    members_result = await db.execute(
        select(FamilyMember).where(FamilyMember.family_id == family_id)
    )
    members = list(members_result.scalars().all())
    all_activities: dict[int, list[Activity]] = {}
    for m in members:
        acts_result = await db.execute(select(Activity).where(Activity.member_id == m.id))
        all_activities[m.id] = list(acts_result.scalars().all())
    return family, members, all_activities


@router.post("/generate", response_model=ScheduleOut)
async def generate_schedule(
    payload: ScheduleGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    family, members, all_activities = await _load_family_data(payload.family_id, db)

    focus_member = None
    if payload.member_id:
        focus_member = await db.get(FamilyMember, payload.member_id)
        if not focus_member:
            raise HTTPException(status_code=404, detail="Member not found")

    content = await ai_service.generate_schedule(
        family_name=family.name,
        target_date=payload.schedule_date,
        end_date=payload.schedule_end_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        location=payload.location,
        members=members,
        all_activities=all_activities,
        focus_member=focus_member,
        additional_notes=payload.additional_notes,
        custom_prompt=payload.custom_prompt,
    )

    schedule = GeneratedSchedule(
        family_id=payload.family_id,
        member_id=payload.member_id,
        schedule_date=payload.schedule_date,
        schedule_end_date=payload.schedule_end_date,
        schedule_start_time=payload.start_time,
        schedule_end_time=payload.end_time,
        location=payload.location,
        is_family_wide=payload.member_id is None,
        content=content,
        custom_prompt=payload.custom_prompt,
        prompt_used=payload.additional_notes,
    )
    db.add(schedule)
    await db.flush()
    await db.refresh(schedule)
    return schedule


@router.post("/report", response_model=ReportOut)
async def generate_report(
    payload: ReportRequest,
    db: AsyncSession = Depends(get_db),
):
    if payload.report_type not in ("daily", "weekly"):
        raise HTTPException(status_code=400, detail="report_type must be 'daily' or 'weekly'")

    family, members, all_activities = await _load_family_data(payload.family_id, db)

    focus_member = None
    if payload.member_id:
        focus_member = await db.get(FamilyMember, payload.member_id)
        if not focus_member:
            raise HTTPException(status_code=404, detail="Member not found")

    content = await ai_service.generate_report(
        family_name=family.name,
        report_type=payload.report_type,
        anchor_date=payload.report_date,
        members=members,
        all_activities=all_activities,
        focus_member=focus_member,
    )

    return ReportOut(
        report_type=payload.report_type,
        report_date=payload.report_date,
        family_id=payload.family_id,
        member_id=payload.member_id,
        content=content,
    )


@router.post("/unified", response_model=UnifiedPlanOut)
async def generate_unified_plan(
    payload: UnifiedPlanRequest,
    db: AsyncSession = Depends(get_db),
):
    family, members, all_activities = await _load_family_data(payload.family_id, db)

    focus_member = None
    if payload.member_id:
        focus_member = await db.get(FamilyMember, payload.member_id)
        if not focus_member:
            raise HTTPException(status_code=404, detail="Member not found")

    # Load subjects for every member (needed for study sessions)
    all_subjects: dict[int, list[Subject]] = {}
    for m in members:
        subs_result = await db.execute(select(Subject).where(Subject.member_id == m.id))
        all_subjects[m.id] = list(subs_result.scalars().all())

    # Load the most recent saved study plan per student that covers the date range
    all_study_plans: dict[int, StudyPlan | None] = {}
    for m in members:
        if m.role.value == "student":
            sp_result = await db.execute(
                select(StudyPlan)
                .where(StudyPlan.member_id == m.id)
                .order_by(StudyPlan.week_start.desc())
                .limit(4)
            )
            plans = list(sp_result.scalars().all())
            # Pick the plan whose week_start is closest to (and not after) start_date
            matching = [
                p for p in plans
                if p.week_start <= payload.start_date
            ]
            all_study_plans[m.id] = matching[0] if matching else (plans[0] if plans else None)

    content = await ai_service.generate_unified_plan(
        family_name=family.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        location=payload.location,
        members=members,
        all_activities=all_activities,
        all_subjects=all_subjects,
        focus_member=focus_member,
        relax_minutes=payload.relax_time_per_day_minutes,
        include_study=payload.include_study_sessions,
        all_study_plans=all_study_plans,
        custom_prompt=payload.custom_prompt,
        additional_notes=payload.additional_notes,
    )

    return UnifiedPlanOut(
        content=content,
        start_date=payload.start_date,
        end_date=payload.end_date,
        family_id=payload.family_id,
    )


@router.get("/family/{family_id}", response_model=list[ScheduleOut])
async def list_family_schedules(family_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GeneratedSchedule)
        .where(GeneratedSchedule.family_id == family_id)
        .order_by(GeneratedSchedule.schedule_date.desc())
        .limit(30)
    )
    return result.scalars().all()


@router.get("/member/{member_id}", response_model=list[ScheduleOut])
async def list_member_schedules(member_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GeneratedSchedule)
        .where(GeneratedSchedule.member_id == member_id)
        .order_by(GeneratedSchedule.schedule_date.desc())
        .limit(30)
    )
    return result.scalars().all()
