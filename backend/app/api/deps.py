"""Request dependencies: who is signed in, and what they may access."""
from typing import Optional

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.models import User, Student, StudentStatus
from app.services.auth import SESSION_COOKIE, read_session_token, is_admin_email


async def get_optional_user(request: Request, db: AsyncSession = Depends(get_db)) -> Optional[User]:
    user_id = read_session_token(request.cookies.get(SESSION_COOKIE))
    return await db.get(User, user_id) if user_id else None


async def get_current_user(user: Optional[User] = Depends(get_optional_user)) -> User:
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in.")
    return user


async def get_admin(user: User = Depends(get_current_user)) -> User:
    if not is_admin_email(user.email):
        raise HTTPException(status_code=403, detail="Admins only.")
    return user


async def student_for_user(user: User, db: AsyncSession) -> Optional[Student]:
    result = await db.execute(select(Student).where(Student.user_id == user.id))
    return result.scalar_one_or_none()


async def get_approved_student(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> Student:
    """The signed-in user's student profile — only once a parent has consented and an admin approved."""
    student = await student_for_user(user, db)
    if not student:
        raise HTTPException(status_code=403, detail="Please complete sign-up first.")
    if student.status != StudentStatus.approved:
        raise HTTPException(status_code=403, detail="Your account is not active yet.")
    return student
