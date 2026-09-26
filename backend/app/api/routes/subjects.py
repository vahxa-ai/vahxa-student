from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import Subject, FamilyMember
from app.schemas.schemas import SubjectCreate, SubjectUpdate, SubjectOut

router = APIRouter(prefix="/members/{member_id}/subjects", tags=["subjects"])


async def _get_member(member_id: int, db: AsyncSession) -> FamilyMember:
    member = await db.get(FamilyMember, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.post("", response_model=SubjectOut)
async def create_subject(
    member_id: int,
    payload: SubjectCreate,
    db: AsyncSession = Depends(get_db),
):
    await _get_member(member_id, db)
    subject = Subject(**payload.model_dump(), member_id=member_id)
    db.add(subject)
    await db.flush()
    await db.refresh(subject)
    return subject


@router.get("", response_model=list[SubjectOut])
async def list_subjects(member_id: int, db: AsyncSession = Depends(get_db)):
    await _get_member(member_id, db)
    result = await db.execute(select(Subject).where(Subject.member_id == member_id))
    return result.scalars().all()


@router.patch("/{subject_id}", response_model=SubjectOut)
async def update_subject(
    member_id: int,
    subject_id: int,
    payload: SubjectUpdate,
    db: AsyncSession = Depends(get_db),
):
    subject = await db.get(Subject, subject_id)
    if not subject or subject.member_id != member_id:
        raise HTTPException(status_code=404, detail="Subject not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(subject, k, v)
    await db.flush()
    await db.refresh(subject)
    return subject


@router.delete("/{subject_id}", status_code=204)
async def delete_subject(member_id: int, subject_id: int, db: AsyncSession = Depends(get_db)):
    subject = await db.get(Subject, subject_id)
    if not subject or subject.member_id != member_id:
        raise HTTPException(status_code=404, detail="Subject not found")
    await db.delete(subject)
