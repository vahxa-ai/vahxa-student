from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import Student
from app.schemas.schemas import StudentUpsert, StudentUpdate, StudentOut

router = APIRouter(prefix="/student", tags=["student"])


async def find_student(db: AsyncSession) -> Optional[Student]:
    result = await db.execute(select(Student).order_by(Student.id).limit(1))
    return result.scalar_one_or_none()


async def get_student_or_404(db: AsyncSession) -> Student:
    student = await find_student(db)
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not set up")
    return student


@router.get("", response_model=StudentOut)
async def get_student(db: AsyncSession = Depends(get_db)):
    return await get_student_or_404(db)


@router.put("", response_model=StudentOut)
async def upsert_student(payload: StudentUpsert, db: AsyncSession = Depends(get_db)):
    student = await find_student(db)
    if student:
        for k, v in payload.model_dump().items():
            setattr(student, k, v)
    else:
        student = Student(**payload.model_dump())
        db.add(student)
    await db.flush()
    await db.refresh(student)
    return student


@router.patch("", response_model=StudentOut)
async def update_student(payload: StudentUpdate, db: AsyncSession = Depends(get_db)):
    student = await get_student_or_404(db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(student, k, v)
    await db.flush()
    await db.refresh(student)
    return student
