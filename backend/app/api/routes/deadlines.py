from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import Deadline, FamilyMember, Subject
from app.schemas.schemas import DeadlineCreate, DeadlineUpdate, DeadlineOut
from app.services import ai_service

router = APIRouter(prefix="/members/{member_id}/deadlines", tags=["deadlines"])


async def _get_member(member_id: int, db: AsyncSession) -> FamilyMember:
    m = await db.get(FamilyMember, member_id)
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    return m


@router.get("", response_model=list[DeadlineOut])
async def list_deadlines(member_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Deadline)
        .where(Deadline.member_id == member_id)
        .order_by(Deadline.due_date.asc())
    )
    return result.scalars().all()


@router.post("", response_model=DeadlineOut)
async def create_deadline(
    member_id: int,
    payload: DeadlineCreate,
    db: AsyncSession = Depends(get_db),
):
    await _get_member(member_id, db)
    dl = Deadline(member_id=member_id, **payload.model_dump())
    db.add(dl)
    await db.flush()
    await db.refresh(dl)
    return dl


@router.patch("/{deadline_id}", response_model=DeadlineOut)
async def update_deadline(
    member_id: int,
    deadline_id: int,
    payload: DeadlineUpdate,
    db: AsyncSession = Depends(get_db),
):
    dl = await db.get(Deadline, deadline_id)
    if not dl or dl.member_id != member_id:
        raise HTTPException(status_code=404, detail="Deadline not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(dl, k, v)
    await db.flush()
    await db.refresh(dl)
    return dl


@router.delete("/{deadline_id}", status_code=204)
async def delete_deadline(
    member_id: int,
    deadline_id: int,
    db: AsyncSession = Depends(get_db),
):
    dl = await db.get(Deadline, deadline_id)
    if not dl or dl.member_id != member_id:
        raise HTTPException(status_code=404, detail="Deadline not found")
    await db.delete(dl)


@router.post("/reminders", response_model=dict)
async def generate_reminders(
    member_id: int,
    db: AsyncSession = Depends(get_db),
):
    member = await _get_member(member_id, db)

    dl_result = await db.execute(
        select(Deadline)
        .where(Deadline.member_id == member_id, Deadline.completed == False)
        .order_by(Deadline.due_date.asc())
    )
    deadlines = list(dl_result.scalars().all())

    # Fetch subject names for context
    subject_names: dict[int, str] = {}
    for dl in deadlines:
        if dl.subject_id and dl.subject_id not in subject_names:
            sub = await db.get(Subject, dl.subject_id)
            if sub:
                subject_names[dl.subject_id] = sub.name

    content = await ai_service.generate_reminders(
        member_name=member.name,
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
