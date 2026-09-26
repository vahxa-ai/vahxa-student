from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.services import ai_service

router = APIRouter(prefix="/health", tags=["health"])


class PurchaseRecord(BaseModel):
    name: str
    category: str
    purchased_at: str   # ISO date string


class ShoppingAdviceRequest(BaseModel):
    history: list[PurchaseRecord]
    family_name: Optional[str] = "the family"


class ShoppingAdviceOut(BaseModel):
    content: str


class ShoppingItem(BaseModel):
    name: str
    category: str


class StoreRecommendationRequest(BaseModel):
    items: list[ShoppingItem]
    family_name: Optional[str] = "the family"


@router.post("/shopping-advice", response_model=ShoppingAdviceOut)
async def shopping_advice(payload: ShoppingAdviceRequest):
    content = await ai_service.generate_shopping_health_advice(
        history=payload.history,
        family_name=payload.family_name or "the family",
    )
    return ShoppingAdviceOut(content=content)


@router.post("/store-recommendations", response_model=ShoppingAdviceOut)
async def store_recommendations(payload: StoreRecommendationRequest):
    content = await ai_service.generate_store_recommendations(
        items=[{"name": i.name, "category": i.category} for i in payload.items],
        family_name=payload.family_name or "the family",
    )
    return ShoppingAdviceOut(content=content)
