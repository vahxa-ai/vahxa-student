"""Parental consent: a parent opens the emailed link, signs in with the matching Google account, and consents."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.database import get_db
from app.models.models import User, Student, StudentStatus, ParentalConsent, ConsentStatus
from app.schemas.schemas import ConsentInfoOut, ConsentGrantRequest, ParentChildOut
from app.services import email as email_service
from app.services.accounts import hash_token, set_status

router = APIRouter(tags=["consent"])


async def _consent_by_token(token: str, db: AsyncSession) -> ParentalConsent:
    consent = (await db.execute(
        select(ParentalConsent).where(ParentalConsent.token_hash == hash_token(token))
    )).scalar_one_or_none()
    if not consent:
        raise HTTPException(status_code=404, detail="This consent link is not valid.")
    return consent


def _expired(consent: ParentalConsent) -> bool:
    return consent.status == ConsentStatus.pending and datetime.utcnow() > consent.expires_at


async def _student_and_user(consent: ParentalConsent, db: AsyncSession) -> tuple[Student, User]:
    student = await db.get(Student, consent.student_id)
    return student, await db.get(User, student.user_id)


@router.get("/consent/{token}", response_model=ConsentInfoOut)
async def consent_info(token: str, db: AsyncSession = Depends(get_db)):
    consent = await _consent_by_token(token, db)
    student, student_user = await _student_and_user(consent, db)
    return ConsentInfoOut(
        status=consent.status,
        expired=_expired(consent),
        student_name=student.name,
        student_email=student_user.email if student_user else "",
        parent_email=consent.parent_email,
        consent_version=consent.consent_version or settings.consent_version,
    )


async def _pending_for_parent(token: str, user: User, db: AsyncSession) -> tuple[ParentalConsent, Student, User]:
    consent = await _consent_by_token(token, db)
    if consent.status != ConsentStatus.pending:
        raise HTTPException(status_code=409, detail=f"This request has already been {consent.status.value}.")
    if _expired(consent):
        raise HTTPException(status_code=410, detail="This consent link has expired. Ask your child to send a new one.")
    if user.email != consent.parent_email:
        raise HTTPException(
            status_code=403,
            detail=f"Please sign in with the Google account for {consent.parent_email} to respond.",
        )
    student, student_user = await _student_and_user(consent, db)
    if student_user and student_user.id == user.id:
        raise HTTPException(status_code=403, detail="Students can't give consent for themselves.")
    return consent, student, student_user


@router.post("/consent/{token}/grant", response_model=ConsentInfoOut)
async def grant_consent(token: str, payload: ConsentGrantRequest, request: Request,
                        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not payload.agree:
        raise HTTPException(status_code=400, detail="Please tick the consent box to continue.")
    consent, student, student_user = await _pending_for_parent(token, user, db)

    now = datetime.utcnow()
    consent.status = ConsentStatus.granted
    consent.parent_user_id = user.id
    consent.parent_full_name = payload.parent_full_name.strip()
    consent.relationship = payload.relationship.strip()
    consent.consent_version = settings.consent_version
    consent.granted_at = now
    consent.granted_ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
                          or (request.client.host if request.client else None))
    consent.granted_user_agent = (request.headers.get("user-agent") or "")[:500]
    if student.status == StudentStatus.awaiting_consent:
        set_status(student, StudentStatus.awaiting_approval)
    await db.flush()

    await email_service.notify_admins_pending(student.name, student_user.email if student_user else "")
    return await consent_info(token, db)


@router.post("/consent/{token}/decline", response_model=ConsentInfoOut)
async def decline_consent(token: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    consent, _, _ = await _pending_for_parent(token, user, db)
    consent.status = ConsentStatus.revoked
    consent.parent_user_id = user.id
    consent.revoked_at = datetime.utcnow()
    await db.flush()
    return await consent_info(token, db)


# ─── Parent dashboard ─────────────────────────────────────────────────────────

@router.get("/parent/children", response_model=list[ParentChildOut])
async def my_children(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ParentalConsent, Student, User)
        .join(Student, Student.id == ParentalConsent.student_id)
        .join(User, User.id == Student.user_id)
        .where(ParentalConsent.parent_user_id == user.id,
               ParentalConsent.status.in_([ConsentStatus.granted, ConsentStatus.revoked]))
        .order_by(ParentalConsent.requested_at.desc())
    )
    return [
        ParentChildOut(
            consent_id=c.id, student_name=s.name, student_email=u.email, consent_status=c.status,
            student_status=s.status, granted_at=c.granted_at, revoked_at=c.revoked_at,
        )
        for c, s, u in result.all()
    ]


@router.post("/parent/consents/{consent_id}/revoke", response_model=ParentChildOut)
async def revoke_consent(consent_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    consent = await db.get(ParentalConsent, consent_id)
    if not consent or consent.parent_user_id != user.id:
        raise HTTPException(status_code=404, detail="Consent not found.")
    if consent.status != ConsentStatus.granted:
        raise HTTPException(status_code=409, detail="This consent is not active.")
    student, student_user = await _student_and_user(consent, db)

    consent.status = ConsentStatus.revoked
    consent.revoked_at = datetime.utcnow()
    if student.status != StudentStatus.rejected:
        set_status(student, StudentStatus.awaiting_consent, "Parent withdrew consent")
    await db.flush()

    if student_user:
        await email_service.notify_student_status(student_user.email, student.name, "consent_revoked")
    return ParentChildOut(
        consent_id=consent.id, student_name=student.name, student_email=student_user.email if student_user else "",
        consent_status=consent.status, student_status=student.status,
        granted_at=consent.granted_at, revoked_at=consent.revoked_at,
    )
