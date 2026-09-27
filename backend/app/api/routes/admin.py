"""Admin: review sign-ups and approve, reject, suspend or reinstate students."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin
from app.db.database import get_db
from app.models.models import User, Student, StudentStatus, ConsentStatus
from app.schemas.schemas import AdminStudentOut, AdminConsentOut, AdminActionRequest
from app.services import email as email_service
from app.services.accounts import latest_consent, set_status

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_admin)])


async def _student_out(student: Student, user: Optional[User], db: AsyncSession) -> AdminStudentOut:
    consent = await latest_consent(student.id, db)
    return AdminStudentOut(
        id=student.id, name=student.name, email=user.email if user else None, age=student.age,
        grade=student.grade, school=student.school,
        location=", ".join(p for p in [student.county, student.state, student.country] if p),
        status=student.status, status_note=student.status_note, status_changed_at=student.status_changed_at,
        created_at=student.created_at, parent_name=student.parent_name, parent_email=student.parent_email,
        consent=AdminConsentOut.model_validate(consent, from_attributes=True) if consent else None,
    )


@router.get("/students", response_model=list[AdminStudentOut])
async def list_students(status: Optional[StudentStatus] = None, db: AsyncSession = Depends(get_db)):
    query = select(Student, User).outerjoin(User, User.id == Student.user_id).order_by(Student.created_at.desc())
    if status:
        query = query.where(Student.status == status)
    return [await _student_out(s, u, db) for s, u in (await db.execute(query)).all()]


# allowed transitions: action → (from statuses, to status)
_ACTIONS = {
    "approve":   ({StudentStatus.awaiting_approval}, StudentStatus.approved),
    "reject":    ({StudentStatus.awaiting_consent, StudentStatus.awaiting_approval}, StudentStatus.rejected),
    "suspend":   ({StudentStatus.approved}, StudentStatus.suspended),
    "reinstate": ({StudentStatus.suspended, StudentStatus.rejected}, None),   # back to approved / awaiting_*
}


@router.post("/students/{student_id}/{action}", response_model=AdminStudentOut)
async def change_status(student_id: int, action: str, payload: AdminActionRequest = AdminActionRequest(),
                        db: AsyncSession = Depends(get_db)):
    if action not in _ACTIONS:
        raise HTTPException(status_code=404, detail="Unknown action.")
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    allowed, target = _ACTIONS[action]
    if student.status not in allowed:
        raise HTTPException(status_code=409, detail=f"Can't {action} a student who is {student.status.value if student.status else 'not signed up'}.")

    consent = await latest_consent(student.id, db)
    has_consent = bool(consent and consent.status == ConsentStatus.granted)
    if action == "approve" and not has_consent:
        raise HTTPException(status_code=409, detail="A parent must consent before this student can be approved.")
    if action == "reinstate":
        # Never skip the consent/approval gates
        target = (StudentStatus.approved if has_consent and student.approved_at
                  else StudentStatus.awaiting_approval if has_consent
                  else StudentStatus.awaiting_consent)

    set_status(student, target, payload.note)
    await db.flush()

    user = await db.get(User, student.user_id) if student.user_id else None
    if user and target in (StudentStatus.approved, StudentStatus.rejected, StudentStatus.suspended):
        await email_service.notify_student_status(user.email, student.name, target.value, payload.note)
    return await _student_out(student, user, db)
