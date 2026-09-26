"""
Google Calendar integration — OAuth 2.0 flow + event sync.
"""
from datetime import datetime, date, time, timedelta
from typing import Optional
import json

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from app.core.config import settings

SCOPES = ["https://www.googleapis.com/auth/calendar"]


def get_oauth_flow() -> Flow:
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uris": [settings.google_redirect_uri],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    flow = Flow.from_client_config(client_config, scopes=SCOPES)
    flow.redirect_uri = settings.google_redirect_uri
    return flow


def get_auth_url() -> tuple[str, str]:
    flow = get_oauth_flow()
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return auth_url, state


def exchange_code(code: str) -> dict:
    flow = get_oauth_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_expiry": creds.expiry.isoformat() if creds.expiry else None,
    }


def _build_service(access_token: str, refresh_token: Optional[str], token_expiry: Optional[datetime]):
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=SCOPES,
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    return build("calendar", "v3", credentials=creds), creds


def sync_activity_to_calendar(
    access_token: str,
    refresh_token: Optional[str],
    token_expiry: Optional[datetime],
    activity_title: str,
    activity_date: date,
    start_time: Optional[time],
    duration_minutes: int,
    description: Optional[str],
    location: Optional[str],
    color_id: str = "1",
    calendar_id: str = "primary",
) -> tuple[str, dict]:
    """Push a single activity to Google Calendar. Returns (google_event_id, new_tokens)."""
    service, creds = _build_service(access_token, refresh_token, token_expiry)

    if start_time:
        start_dt = datetime.combine(activity_date, start_time)
        end_dt = start_dt + timedelta(minutes=duration_minutes)
        event_body = {
            "summary": activity_title,
            "description": description or "",
            "location": location or "",
            "colorId": color_id,
            "start": {"dateTime": start_dt.isoformat(), "timeZone": "UTC"},
            "end": {"dateTime": end_dt.isoformat(), "timeZone": "UTC"},
        }
    else:
        event_body = {
            "summary": activity_title,
            "description": description or "",
            "location": location or "",
            "colorId": color_id,
            "start": {"date": activity_date.isoformat()},
            "end": {"date": activity_date.isoformat()},
        }

    event = service.events().insert(calendarId=calendar_id, body=event_body).execute()
    new_tokens = {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_expiry": creds.expiry.isoformat() if creds.expiry else None,
    }
    return event["id"], new_tokens


def get_upcoming_events(
    access_token: str,
    refresh_token: Optional[str],
    token_expiry: Optional[datetime],
    calendar_id: str = "primary",
    days_ahead: int = 7,
) -> list[dict]:
    service, _ = _build_service(access_token, refresh_token, token_expiry)
    now = datetime.utcnow().isoformat() + "Z"
    end = (datetime.utcnow() + timedelta(days=days_ahead)).isoformat() + "Z"

    result = (
        service.events()
        .list(
            calendarId=calendar_id,
            timeMin=now,
            timeMax=end,
            singleEvents=True,
            orderBy="startTime",
            maxResults=50,
        )
        .execute()
    )
    return result.get("items", [])
