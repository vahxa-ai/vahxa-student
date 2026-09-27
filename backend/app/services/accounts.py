"""Shared account logic: the /me payload, consent requests, and student status changes."""
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, update, or_, exists
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import User, Student, StudentStatus, ParentalConsent, ConsentStatus
from app.schemas.schemas import MeOut, UserOut, StudentOut, ConsentSummary
from app.services.auth import is_admin_email


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def latest_consent(student_id: int, db: AsyncSession) -> Optional[ParentalConsent]:
    result = await db.execute(
        select(ParentalConsent)
        .where(ParentalConsent.student_id == student_id)
        .order_by(ParentalConsent.requested_at.desc(), ParentalConsent.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def build_me(user: User, db: AsyncSession) -> MeOut:
    student = (await db.execute(select(Student).where(Student.user_id == user.id))).scalar_one_or_none()
    consent = await latest_consent(student.id, db) if student else None
    is_parent = (await db.execute(
        select(exists().where(or_(ParentalConsent.parent_user_id == user.id,
                                  ParentalConsent.parent_email == user.email)))
    )).scalar()
    return MeOut(
        user=UserOut(id=user.id, email=user.email, name=user.name, picture=user.picture,
                     is_admin=is_admin_email(user.email)),
        student=StudentOut.model_validate(student) if student else None,
        consent=ConsentSummary.model_validate(consent, from_attributes=True) if consent else None,
        is_parent=bool(is_parent),
    )


async def create_consent_request(student: Student, db: AsyncSession) -> str:
    """Supersede any pending request and create a new one for student.parent_email. Returns the raw token
    (only ever emailed — we store its hash)."""
    await db.execute(
        update(ParentalConsent)
        .where(ParentalConsent.student_id == student.id, ParentalConsent.status == ConsentStatus.pending)
        .values(status=ConsentStatus.superseded)
    )
    token = secrets.token_urlsafe(32)
    now = datetime.utcnow()
    db.add(ParentalConsent(
        student_id=student.id,
        parent_email=student.parent_email,
        token_hash=hash_token(token),
        status=ConsentStatus.pending,
        requested_at=now,
        expires_at=now + timedelta(days=settings.consent_link_days),
        last_sent_at=now,
    ))
    await db.flush()
    return token


def set_status(student: Student, status: StudentStatus, note: Optional[str] = None) -> None:
    student.status = status
    student.status_changed_at = datetime.utcnow()
    student.status_note = note
    if status == StudentStatus.approved:
        student.approved_at = student.approved_at or datetime.utcnow()
