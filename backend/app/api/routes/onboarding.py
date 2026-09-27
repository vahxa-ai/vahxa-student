"""Student sign-up: profile + parent contact → parental consent request."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, student_for_user
from app.db.database import get_db
from app.models.models import User, Student, StudentStatus, ConsentStatus
from app.schemas.schemas import OnboardingRequest, ParentContactUpdate, MeOut
from app.services import email as email_service
from app.services.accounts import build_me, create_consent_request, latest_consent, set_status
from app.services.auth import is_admin_email

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

_RESEND_COOLDOWN = timedelta(minutes=5)
_EDITABLE = (None, StudentStatus.awaiting_consent)


def _check_parent_email(parent_email: str, user: User) -> None:
    if parent_email == user.email:
        raise HTTPException(status_code=400, detail="Enter your parent's or guardian's email, not your own.")


async def _send_consent(student: Student, user: User, db: AsyncSession) -> None:
    token = await create_consent_request(student, db)
    await email_service.send_consent_request(student.parent_email, student.parent_name or "", student.name, token)


@router.post("", response_model=MeOut)
async def complete_signup(payload: OnboardingRequest, user: User = Depends(get_current_user),
                          db: AsyncSession = Depends(get_db)):
    if is_admin_email(user.email):
        raise HTTPException(status_code=400, detail="Admin accounts don't need a student profile.")
    _check_parent_email(payload.parent_email, user)

    student = await student_for_user(user, db)
    if student and student.status not in _EDITABLE:
        raise HTTPException(status_code=409, detail="Your sign-up has already been submitted.")
    if not student:
        student = Student(user_id=user.id, name=payload.name)
        db.add(student)

    data = payload.model_dump()
    for field in ("name", "age", "school", "grade", "county", "state", "country", "timezone",
                  "parent_name", "parent_email"):
        setattr(student, field, data[field])
    set_status(student, StudentStatus.awaiting_consent)
    await db.flush()

    await _send_consent(student, user, db)
    return await build_me(user, db)


@router.put("/parent", response_model=MeOut)
async def change_parent(payload: ParentContactUpdate, user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    """Fix the parent's contact details; sends a fresh consent request (the old link stops working)."""
    student = await student_for_user(user, db)
    if not student or student.status != StudentStatus.awaiting_consent:
        raise HTTPException(status_code=409, detail="Parent details can only be changed while waiting for consent.")
    _check_parent_email(payload.parent_email, user)
    student.parent_name, student.parent_email = payload.parent_name, payload.parent_email
    await db.flush()
    await _send_consent(student, user, db)
    return await build_me(user, db)


@router.post("/resend-consent", response_model=MeOut)
async def resend_consent(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    student = await student_for_user(user, db)
    if not student or student.status != StudentStatus.awaiting_consent:
        raise HTTPException(status_code=409, detail="There is no consent request waiting.")
    consent = await latest_consent(student.id, db)
    if consent and consent.status == ConsentStatus.pending and consent.last_sent_at \
            and datetime.utcnow() - consent.last_sent_at < _RESEND_COOLDOWN:
        raise HTTPException(status_code=429, detail="Please wait a few minutes before sending another email.")
    await _send_consent(student, user, db)
    return await build_me(user, db)
