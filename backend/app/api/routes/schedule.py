from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import Activity, Subject, Student
from app.schemas.schemas import PlanRequest, PlanOut
from app.services import ai_service
from app.api.deps import get_approved_student

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.post("/generate", response_model=PlanOut)
async def generate_plan(payload: PlanRequest, student: Student = Depends(get_approved_student),
                        db: AsyncSession = Depends(get_db)):
    activities = list((await db.execute(select(Activity).where(Activity.student_id == student.id))).scalars().all())
    subjects = list((await db.execute(select(Subject).where(Subject.student_id == student.id))).scalars().all())

    content = await ai_service.generate_plan(
        student=student,
        start_date=payload.start_date,
        end_date=payload.end_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        location=payload.location,
        activities=activities,
        subjects=subjects,
        relax_minutes=payload.relax_time_per_day_minutes,
        include_study=payload.include_study_sessions,
        custom_prompt=payload.custom_prompt,
        additional_notes=payload.additional_notes,
    )

    return PlanOut(
        content=content,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
