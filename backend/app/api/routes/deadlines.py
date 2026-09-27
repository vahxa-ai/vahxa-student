from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_approved_student
from app.api.routes.subjects import own_subject
from app.db.database import get_db
from app.models.models import Deadline, Subject, Student
from app.schemas.schemas import DeadlineCreate, DeadlineUpdate, DeadlineOut
from app.services import ai_service

router = APIRouter(prefix="/deadlines", tags=["deadlines"])


async def _own_deadline(deadline_id: int, student: Student, db: AsyncSession) -> Deadline:
    dl = await db.get(Deadline, deadline_id)
    if not dl or dl.student_id != student.id:
        raise HTTPException(status_code=404, detail="Deadline not found")
    return dl


async def _check_subject(subject_id: Optional[int], student: Student, db: AsyncSession) -> None:
    if subject_id is not None:
        await own_subject(subject_id, student, db)


@router.get("", response_model=list[DeadlineOut])
async def list_deadlines(student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Deadline).where(Deadline.student_id == student.id).order_by(Deadline.due_date.asc())
    )
    return result.scalars().all()


@router.post("", response_model=DeadlineOut)
async def create_deadline(payload: DeadlineCreate, student: Student = Depends(get_approved_student),
                          db: AsyncSession = Depends(get_db)):
    await _check_subject(payload.subject_id, student, db)
    dl = Deadline(**payload.model_dump(), student_id=student.id)
    db.add(dl)
    await db.flush()
    await db.refresh(dl)
    return dl


@router.patch("/{deadline_id}", response_model=DeadlineOut)
async def update_deadline(
    deadline_id: int,
    payload: DeadlineUpdate,
    student: Student = Depends(get_approved_student),
    db: AsyncSession = Depends(get_db),
):
    dl = await _own_deadline(deadline_id, student, db)
    await _check_subject(payload.subject_id, student, db)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(dl, k, v)
    await db.flush()
    await db.refresh(dl)
    return dl


@router.delete("/{deadline_id}", status_code=204)
async def delete_deadline(deadline_id: int, student: Student = Depends(get_approved_student),
                          db: AsyncSession = Depends(get_db)):
    await db.delete(await _own_deadline(deadline_id, student, db))


@router.post("/reminders", response_model=dict)
async def generate_reminders(student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    dl_result = await db.execute(
        select(Deadline)
        .where(Deadline.student_id == student.id, Deadline.completed == False)
        .order_by(Deadline.due_date.asc())
    )
    deadlines = list(dl_result.scalars().all())

    # Fetch subject names for context
    subject_names: dict[int, str] = {}
    for dl in deadlines:
        if dl.subject_id and dl.subject_id not in subject_names:
            sub = await db.get(Subject, dl.subject_id)
            if sub and sub.student_id == student.id:
                subject_names[dl.subject_id] = sub.name

    content = await ai_service.generate_reminders(
        student_name=student.name,
        today=date.today(),
        deadlines=[
            {
                "title":    dl.title,
                "type":     dl.deadline_type.value,
                "due_date": dl.due_date.isoformat(),
                "subject":  subject_names.get(dl.subject_id, "") if dl.subject_id else "",
                "description": dl.description or "",
            }
            for dl in deadlines
        ],
    )
    return {"content": content}
