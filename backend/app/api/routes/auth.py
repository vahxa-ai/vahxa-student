from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.database import get_db
from app.models.models import User
from app.schemas.schemas import GoogleSignInRequest, MeOut, AuthConfigOut
from app.services import auth as auth_service
from app.services.accounts import build_me

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        auth_service.SESSION_COOKIE,
        auth_service.create_session_token(user_id),
        max_age=settings.session_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


@router.get("/config", response_model=AuthConfigOut)
async def auth_config():
    return AuthConfigOut(google_client_id=settings.google_oauth_client_id, consent_version=settings.consent_version)


@router.post("/google", response_model=MeOut)
async def sign_in_with_google(payload: GoogleSignInRequest, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        claims = await auth_service.verify_google_credential(payload.credential)
    except auth_service.AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))

    sub, email = claims["sub"], claims["email"].lower()
    user = (await db.execute(select(User).where(User.google_sub == sub))).scalar_one_or_none()
    if not user:
        # Pre-provisioned by email (e.g. migrated data) and never signed in → claim it
        user = (await db.execute(
            select(User).where(User.email == email, User.google_sub.is_(None))
        )).scalar_one_or_none()
        if user:
            user.google_sub = sub
        else:
            if (await db.execute(select(User).where(User.email == email))).scalar_one_or_none():
                raise HTTPException(status_code=409, detail="This email is already linked to a different Google account.")
            user = User(google_sub=sub, email=email)
            db.add(user)
    user.email = email
    user.name = claims.get("name") or user.name
    user.picture = claims.get("picture") or user.picture
    user.last_login_at = datetime.utcnow()
    await db.flush()

    _set_session_cookie(response, user.id)
    return await build_me(user, db)


@router.get("/me", response_model=MeOut)
async def me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await build_me(user, db)


@router.post("/logout", status_code=204)
async def logout(response: Response):
    response.delete_cookie(auth_service.SESSION_COOKIE, path="/", secure=settings.cookie_secure, samesite="lax")
