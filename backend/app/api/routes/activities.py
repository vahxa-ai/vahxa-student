from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_approved_student
from app.db.database import get_db
from app.models.models import Activity, Student
from app.schemas.schemas import ActivityCreate, ActivityUpdate, ActivityOut

router = APIRouter(prefix="/activities", tags=["activities"])


async def _own_activity(activity_id: int, student: Student, db: AsyncSession) -> Activity:
    activity = await db.get(Activity, activity_id)
    if not activity or activity.student_id != student.id:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity


@router.post("", response_model=ActivityOut)
async def create_activity(payload: ActivityCreate, student: Student = Depends(get_approved_student),
                          db: AsyncSession = Depends(get_db)):
    activity = Activity(**payload.model_dump(), student_id=student.id)
    db.add(activity)
    await db.flush()
    await db.refresh(activity)
    return activity


@router.get("", response_model=list[ActivityOut])
async def list_activities(student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Activity).where(Activity.student_id == student.id))
    return result.scalars().all()


@router.patch("/{activity_id}", response_model=ActivityOut)
async def update_activity(
    activity_id: int,
    payload: ActivityUpdate,
    student: Student = Depends(get_approved_student),
    db: AsyncSession = Depends(get_db),
):
    activity = await _own_activity(activity_id, student, db)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(activity, k, v)
    await db.flush()
    await db.refresh(activity)
    return activity


@router.delete("/{activity_id}", status_code=204)
async def delete_activity(activity_id: int, student: Student = Depends(get_approved_student),
                          db: AsyncSession = Depends(get_db)):
    await db.delete(await _own_activity(activity_id, student, db))
