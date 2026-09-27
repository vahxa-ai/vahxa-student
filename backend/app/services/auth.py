"""
Sign in with Google + session cookies.

The browser gets a Google ID token from Google Identity Services and posts it to /api/auth/google.
We verify it against our OAuth client ID, then issue our own short signed session cookie (httpOnly),
so Google tokens never need to be stored or refreshed by the frontend.
"""
import asyncio
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token
from jose import JWTError, jwt

from app.core.config import settings

log = logging.getLogger(__name__)

SESSION_COOKIE = "vahxa_session"
_ALGORITHM = "HS256"
_GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

if settings.session_secret:
    _secret = settings.session_secret
else:
    # Dev convenience only: sessions stop working whenever the process restarts.
    _secret = secrets.token_urlsafe(48)
    log.warning("SESSION_SECRET is not set — using a temporary random secret (development only).")


class AuthError(Exception):
    pass


async def verify_google_credential(credential: str) -> dict:
    """Verify a Google ID token from Sign in with Google. Returns its claims (sub, email, name, picture)."""
    if not settings.google_oauth_client_id:
        raise AuthError("Google sign-in is not configured on the server.")
    try:
        # Fetching Google's public certs is blocking; keep it off the event loop
        claims = await asyncio.to_thread(
            id_token.verify_oauth2_token, credential, GoogleAuthRequest(), settings.google_oauth_client_id
        )
    except ValueError as e:
        raise AuthError(f"Invalid Google sign-in: {e}")
    if claims.get("iss") not in _GOOGLE_ISSUERS:
        raise AuthError("Invalid Google sign-in issuer.")
    if not claims.get("email") or not claims.get("email_verified"):
        raise AuthError("Your Google account email must be verified.")
    return claims


def create_session_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"uid": user_id, "iat": now, "exp": now + timedelta(days=settings.session_days)},
        _secret, algorithm=_ALGORITHM,
    )


def read_session_token(token: Optional[str]) -> Optional[int]:
    if not token:
        return None
    try:
        return int(jwt.decode(token, _secret, algorithms=[_ALGORITHM])["uid"])
    except (JWTError, KeyError, ValueError, TypeError):
        return None


def is_admin_email(email: str) -> bool:
    return email.lower() in settings.admin_email_set
