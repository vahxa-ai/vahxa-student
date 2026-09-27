"""The signed-in student's own profile (after approval). Sign-up happens via /onboarding."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_approved_student
from app.db.database import get_db
from app.models.models import Student
from app.schemas.schemas import StudentUpsert, StudentUpdate, StudentOut

router = APIRouter(prefix="/student", tags=["student"])

# Profile fields a student may edit themselves (status and parent contact are managed elsewhere)
_PROFILE_FIELDS = {"name", "age", "school", "grade", "county", "state", "country", "timezone", "default_prompt"}


@router.get("", response_model=StudentOut)
async def get_student(student: Student = Depends(get_approved_student)):
    return student


@router.put("", response_model=StudentOut)
async def save_student(payload: StudentUpsert, student: Student = Depends(get_approved_student),
                       db: AsyncSession = Depends(get_db)):
    for k, v in payload.model_dump().items():
        if k in _PROFILE_FIELDS:
            setattr(student, k, v)
    await db.flush()
    await db.refresh(student)
    return student


@router.patch("", response_model=StudentOut)
async def update_student(payload: StudentUpdate, student: Student = Depends(get_approved_student),
                         db: AsyncSession = Depends(get_db)):
    for k, v in payload.model_dump(exclude_unset=True).items():
        if k in _PROFILE_FIELDS:
            setattr(student, k, v)
    await db.flush()
    await db.refresh(student)
    return student
