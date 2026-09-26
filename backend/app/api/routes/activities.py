from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import Activity, FamilyMember
from app.schemas.schemas import ActivityCreate, ActivityUpdate, ActivityOut

router = APIRouter(prefix="/members/{member_id}/activities", tags=["activities"])


async def _get_member(member_id: int, db: AsyncSession) -> FamilyMember:
    member = await db.get(FamilyMember, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.post("", response_model=ActivityOut)
async def create_activity(
    member_id: int,
    payload: ActivityCreate,
    db: AsyncSession = Depends(get_db),
):
    await _get_member(member_id, db)
    activity = Activity(**payload.model_dump(), member_id=member_id)
    db.add(activity)
    await db.flush()
    await db.refresh(activity)
    return activity


@router.get("", response_model=list[ActivityOut])
async def list_activities(member_id: int, db: AsyncSession = Depends(get_db)):
    await _get_member(member_id, db)
    result = await db.execute(select(Activity).where(Activity.member_id == member_id))
    return result.scalars().all()


@router.patch("/{activity_id}", response_model=ActivityOut)
async def update_activity(
    member_id: int,
    activity_id: int,
    payload: ActivityUpdate,
    db: AsyncSession = Depends(get_db),
):
    activity = await db.get(Activity, activity_id)
    if not activity or activity.member_id != member_id:
        raise HTTPException(status_code=404, detail="Activity not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(activity, k, v)
    await db.flush()
    await db.refresh(activity)
    return activity


@router.delete("/{activity_id}", status_code=204)
async def delete_activity(member_id: int, activity_id: int, db: AsyncSession = Depends(get_db)):
    activity = await db.get(Activity, activity_id)
    if not activity or activity.member_id != member_id:
        raise HTTPException(status_code=404, detail="Activity not found")
    await db.delete(activity)
