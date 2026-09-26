from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import PantryItem, MealPlanItem, Family
from app.schemas.schemas import PantryItemCreate, PantryItemUpdate, PantryItemOut

router = APIRouter(prefix="/families/{family_id}/pantry", tags=["pantry"])


async def _get_family(family_id: int, db: AsyncSession) -> Family:
    family = await db.get(Family, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    return family


@router.post("", response_model=PantryItemOut)
async def create_pantry_item(
    family_id: int,
    payload: PantryItemCreate,
    db: AsyncSession = Depends(get_db),
):
    await _get_family(family_id, db)
    item = PantryItem(**payload.model_dump(), family_id=family_id)
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


@router.get("", response_model=list[PantryItemOut])
async def list_pantry_items(family_id: int, db: AsyncSession = Depends(get_db)):
    await _get_family(family_id, db)
    result = await db.execute(
        select(PantryItem)
        .where(PantryItem.family_id == family_id)
        .order_by(PantryItem.name.asc())
    )
    return result.scalars().all()


@router.patch("/{item_id}", response_model=PantryItemOut)
async def update_pantry_item(
    family_id: int,
    item_id: int,
    payload: PantryItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(PantryItem, item_id)
    if not item or item.family_id != family_id:
        raise HTTPException(status_code=404, detail="Pantry item not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    await db.flush()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
async def delete_pantry_item(family_id: int, item_id: int, db: AsyncSession = Depends(get_db)):
    item = await db.get(PantryItem, item_id)
    if not item or item.family_id != family_id:
        raise HTTPException(status_code=404, detail="Pantry item not found")
    # Keep any meal-plan entries that referenced this item as plain manual entries.
    result = await db.execute(
        select(MealPlanItem).where(MealPlanItem.pantry_item_id == item_id)
    )
    for meal_item in result.scalars().all():
        meal_item.pantry_item_id = None
    await db.delete(item)
