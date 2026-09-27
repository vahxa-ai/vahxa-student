from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.api.deps import get_approved_student
from app.db.database import get_db
from app.models.models import Subject, Student, QuizAttempt
from app.schemas.schemas import SubjectCreate, SubjectUpdate, SubjectOut

router = APIRouter(prefix="/subjects", tags=["subjects"])


async def own_subject(subject_id: int, student: Student, db: AsyncSession) -> Subject:
    """A subject belonging to this student, else 404 (never reveal other students' subjects)."""
    subject = await db.get(Subject, subject_id)
    if not subject or subject.student_id != student.id:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@router.post("", response_model=SubjectOut)
async def create_subject(payload: SubjectCreate, student: Student = Depends(get_approved_student),
                         db: AsyncSession = Depends(get_db)):
    subject = Subject(**payload.model_dump(), student_id=student.id)
    db.add(subject)
    await db.flush()
    await db.refresh(subject)
    return subject


@router.get("", response_model=list[SubjectOut])
async def list_subjects(student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject).where(Subject.student_id == student.id))
    return result.scalars().all()


@router.get("/{subject_id}", response_model=SubjectOut)
async def get_subject(subject_id: int, student: Student = Depends(get_approved_student),
                      db: AsyncSession = Depends(get_db)):
    return await own_subject(subject_id, student, db)


@router.patch("/{subject_id}", response_model=SubjectOut)
async def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    student: Student = Depends(get_approved_student),
    db: AsyncSession = Depends(get_db),
):
    subject = await own_subject(subject_id, student, db)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(subject, k, v)
    await db.flush()
    await db.refresh(subject)
    return subject


@router.delete("/{subject_id}", status_code=204)
async def delete_subject(subject_id: int, student: Student = Depends(get_approved_student),
                         db: AsyncSession = Depends(get_db)):
    subject = await own_subject(subject_id, student, db)
    # Quiz history goes with the subject (explicit so it also holds where the DB doesn't enforce FK cascades)
    await db.execute(delete(QuizAttempt).where(QuizAttempt.subject_id == subject.id))
    await db.delete(subject)
