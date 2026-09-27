from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import Activity
from app.schemas.schemas import ActivityCreate, ActivityUpdate, ActivityOut

router = APIRouter(prefix="/activities", tags=["activities"])


@router.post("", response_model=ActivityOut)
async def create_activity(payload: ActivityCreate, db: AsyncSession = Depends(get_db)):
    activity = Activity(**payload.model_dump())
    db.add(activity)
    await db.flush()
    await db.refresh(activity)
    return activity


@router.get("", response_model=list[ActivityOut])
async def list_activities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Activity))
    return result.scalars().all()


@router.patch("/{activity_id}", response_model=ActivityOut)
async def update_activity(
    activity_id: int,
    payload: ActivityUpdate,
    db: AsyncSession = Depends(get_db),
):
    activity = await db.get(Activity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(activity, k, v)
    await db.flush()
    await db.refresh(activity)
    return activity


@router.delete("/{activity_id}", status_code=204)
async def delete_activity(activity_id: int, db: AsyncSession = Depends(get_db)):
    activity = await db.get(Activity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    await db.delete(activity)
