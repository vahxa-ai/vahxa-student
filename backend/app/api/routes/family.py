from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import Family, FamilyMember
from app.schemas.schemas import FamilyCreate, FamilyOut, FamilyMemberCreate, FamilyMemberUpdate, FamilyMemberOut

router = APIRouter(prefix="/families", tags=["families"])


@router.post("", response_model=FamilyOut)
async def create_family(payload: FamilyCreate, db: AsyncSession = Depends(get_db)):
    family = Family(**payload.model_dump())
    db.add(family)
    await db.flush()
    await db.refresh(family)
    return family


@router.get("", response_model=list[FamilyOut])
async def list_families(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Family))
    return result.scalars().all()


@router.get("/{family_id}", response_model=FamilyOut)
async def get_family(family_id: int, db: AsyncSession = Depends(get_db)):
    family = await db.get(Family, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    return family


@router.delete("/{family_id}", status_code=204)
async def delete_family(family_id: int, db: AsyncSession = Depends(get_db)):
    family = await db.get(Family, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    await db.delete(family)


# --- Members ---

@router.post("/{family_id}/members", response_model=FamilyMemberOut)
async def add_member(family_id: int, payload: FamilyMemberCreate, db: AsyncSession = Depends(get_db)):
    family = await db.get(Family, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    initials = "".join(w[0].upper() for w in payload.name.split()[:2])
    member = FamilyMember(**payload.model_dump(), family_id=family_id, avatar_initials=initials)
    db.add(member)
    await db.flush()
    await db.refresh(member)
    return member


@router.get("/{family_id}/members", response_model=list[FamilyMemberOut])
async def list_members(family_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FamilyMember).where(FamilyMember.family_id == family_id))
    return result.scalars().all()


@router.patch("/{family_id}/members/{member_id}", response_model=FamilyMemberOut)
async def update_member(
    family_id: int,
    member_id: int,
    payload: FamilyMemberUpdate,
    db: AsyncSession = Depends(get_db),
):
    member = await db.get(FamilyMember, member_id)
    if not member or member.family_id != family_id:
        raise HTTPException(status_code=404, detail="Member not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(member, k, v)
    if payload.name:
        member.avatar_initials = "".join(w[0].upper() for w in payload.name.split()[:2])
    await db.flush()
    await db.refresh(member)
    return member


@router.delete("/{family_id}/members/{member_id}", status_code=204)
async def delete_member(family_id: int, member_id: int, db: AsyncSession = Depends(get_db)):
    member = await db.get(FamilyMember, member_id)
    if not member or member.family_id != family_id:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(member)
