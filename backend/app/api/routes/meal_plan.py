from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import (
    Family,
    FamilyMember,
    MealSlot,
    MealPlanItem,
    PantryItem,
    MealType,
    MEAL_SLOT_DEFAULTS,
)
from app.schemas.schemas import (
    MealPlanOut,
    MealSlotUpdate,
    MealPlanItemCreate,
    MealPlanItemUpdate,
    MealPlanItemOut,
)

router = APIRouter(prefix="/families/{family_id}/meal-plan", tags=["meal-plan"])


async def _get_family(family_id: int, db: AsyncSession) -> Family:
    family = await db.get(Family, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    return family


async def _get_or_create_slots(family_id: int, db: AsyncSession) -> list[MealSlot]:
    result = await db.execute(select(MealSlot).where(MealSlot.family_id == family_id))
    slots = {s.meal_type: s for s in result.scalars().all()}
    created = False
    for order, (meal_type, default_time) in enumerate(MEAL_SLOT_DEFAULTS):
        if meal_type not in slots:
            slot = MealSlot(
                family_id=family_id,
                meal_type=meal_type,
                time=default_time,
                sort_order=order,
            )
            db.add(slot)
            slots[meal_type] = slot
            created = True
    if created:
        await db.flush()
    return sorted(slots.values(), key=lambda s: s.sort_order)


@router.get("", response_model=MealPlanOut)
async def get_meal_plan(family_id: int, db: AsyncSession = Depends(get_db)):
    await _get_family(family_id, db)
    slots = await _get_or_create_slots(family_id, db)
    result = await db.execute(
        select(MealPlanItem)
        .where(MealPlanItem.family_id == family_id)
        .order_by(MealPlanItem.day_of_week, MealPlanItem.sort_order, MealPlanItem.id)
    )
    return MealPlanOut(slots=slots, items=list(result.scalars().all()))


@router.patch("/slots/{meal_type}", response_model=MealPlanOut)
async def update_meal_slot(
    family_id: int,
    meal_type: MealType,
    payload: MealSlotUpdate,
    db: AsyncSession = Depends(get_db),
):
    await _get_family(family_id, db)
    slots = await _get_or_create_slots(family_id, db)
    slot = next((s for s in slots if s.meal_type == meal_type), None)
    if not slot:
        raise HTTPException(status_code=404, detail="Meal slot not found")
    slot.time = payload.time
    await db.flush()
    result = await db.execute(
        select(MealPlanItem)
        .where(MealPlanItem.family_id == family_id)
        .order_by(MealPlanItem.day_of_week, MealPlanItem.sort_order, MealPlanItem.id)
    )
    return MealPlanOut(slots=sorted(slots, key=lambda s: s.sort_order), items=list(result.scalars().all()))


@router.post("/items", response_model=MealPlanItemOut)
async def create_meal_item(
    family_id: int,
    payload: MealPlanItemCreate,
    db: AsyncSession = Depends(get_db),
):
    await _get_family(family_id, db)
    if payload.pantry_item_id is not None:
        pantry = await db.get(PantryItem, payload.pantry_item_id)
        if not pantry or pantry.family_id != family_id:
            raise HTTPException(status_code=404, detail="Pantry item not found")
    if payload.member_id is not None:
        member = await db.get(FamilyMember, payload.member_id)
        if not member or member.family_id != family_id:
            raise HTTPException(status_code=404, detail="Family member not found")
    item = MealPlanItem(**payload.model_dump(), family_id=family_id)
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=MealPlanItemOut)
async def update_meal_item(
    family_id: int,
    item_id: int,
    payload: MealPlanItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(MealPlanItem, item_id)
    if not item or item.family_id != family_id:
        raise HTTPException(status_code=404, detail="Meal item not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("pantry_item_id") is not None:
        pantry = await db.get(PantryItem, data["pantry_item_id"])
        if not pantry or pantry.family_id != family_id:
            raise HTTPException(status_code=404, detail="Pantry item not found")
    if data.get("member_id") is not None:
        member = await db.get(FamilyMember, data["member_id"])
        if not member or member.family_id != family_id:
            raise HTTPException(status_code=404, detail="Family member not found")
    for k, v in data.items():
        setattr(item, k, v)
    await db.flush()
    await db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=204)
async def delete_meal_item(family_id: int, item_id: int, db: AsyncSession = Depends(get_db)):
    item = await db.get(MealPlanItem, item_id)
    if not item or item.family_id != family_id:
        raise HTTPException(status_code=404, detail="Meal item not found")
    await db.delete(item)
