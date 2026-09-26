from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import Activity, FamilyMember, GoogleCalendarToken
from app.schemas.schemas import CalendarEventOut
from app.services import calendar_service
from app.core.config import settings

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/oauth/start")
async def oauth_start(family_id: int = Query(...)):
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google Calendar not configured")
    auth_url, state = calendar_service.get_auth_url()
    # Encode family_id in state (simple approach)
    return {"auth_url": auth_url, "state": f"{state}:{family_id}"}


@router.get("/oauth/callback")
async def oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        parts = state.rsplit(":", 1)
        family_id = int(parts[1]) if len(parts) == 2 else 1
    except (ValueError, IndexError):
        family_id = 1

    tokens = calendar_service.exchange_code(code)
    expiry = datetime.fromisoformat(tokens["token_expiry"]) if tokens.get("token_expiry") else None

    # Upsert token for family
    result = await db.execute(
        select(GoogleCalendarToken).where(GoogleCalendarToken.family_id == family_id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.access_token = tokens["access_token"]
        existing.refresh_token = tokens.get("refresh_token") or existing.refresh_token
        existing.token_expiry = expiry
    else:
        token = GoogleCalendarToken(
            family_id=family_id,
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token"),
            token_expiry=expiry,
        )
        db.add(token)

    await db.flush()
    return RedirectResponse(url=f"{settings.frontend_url}/calendar?connected=true")


@router.post("/sync/{family_id}/member/{member_id}")
async def sync_member_activities(
    family_id: int,
    member_id: int,
    db: AsyncSession = Depends(get_db),
):
    token_result = await db.execute(
        select(GoogleCalendarToken).where(GoogleCalendarToken.family_id == family_id)
    )
    token = token_result.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=400, detail="Google Calendar not connected. Please authenticate first.")

    member = await db.get(FamilyMember, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    acts_result = await db.execute(
        select(Activity).where(Activity.member_id == member_id, Activity.synced_to_calendar == False)
    )
    activities = acts_result.scalars().all()

    synced_count = 0
    for act in activities:
        if not act.start_date:
            continue
        try:
            event_id, new_tokens = calendar_service.sync_activity_to_calendar(
                access_token=token.access_token,
                refresh_token=token.refresh_token,
                token_expiry=token.token_expiry,
                activity_title=f"[{member.name}] {act.title}",
                activity_date=act.start_date,
                start_time=act.start_time,
                duration_minutes=act.duration_minutes,
                description=act.description,
                location=act.location,
                calendar_id=token.calendar_id,
            )
            act.google_event_id = event_id
            act.synced_to_calendar = True
            token.access_token = new_tokens["access_token"]
            if new_tokens.get("refresh_token"):
                token.refresh_token = new_tokens["refresh_token"]
            synced_count += 1
        except Exception as e:
            # Log but don't abort — sync remaining activities
            print(f"Failed to sync activity {act.id}: {e}")

    await db.flush()
    return {"synced": synced_count, "total": len(activities)}


@router.get("/events/{family_id}", response_model=list[CalendarEventOut])
async def get_upcoming_events(
    family_id: int,
    days_ahead: int = Query(default=7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
):
    token_result = await db.execute(
        select(GoogleCalendarToken).where(GoogleCalendarToken.family_id == family_id)
    )
    token = token_result.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")

    events = calendar_service.get_upcoming_events(
        access_token=token.access_token,
        refresh_token=token.refresh_token,
        token_expiry=token.token_expiry,
        calendar_id=token.calendar_id,
        days_ahead=days_ahead,
    )

    return [
        CalendarEventOut(
            id=e["id"],
            summary=e.get("summary", ""),
            start=e["start"].get("dateTime", e["start"].get("date", "")),
            end=e["end"].get("dateTime", e["end"].get("date", "")),
            description=e.get("description"),
            location=e.get("location"),
        )
        for e in events
    ]


@router.get("/status/{family_id}")
async def calendar_status(family_id: int, db: AsyncSession = Depends(get_db)):
    token_result = await db.execute(
        select(GoogleCalendarToken).where(GoogleCalendarToken.family_id == family_id)
    )
    token = token_result.scalar_one_or_none()
    return {"connected": token is not None}
