"""
Shared Google Cloud credentials for Vertex AI and Firestore.
Uses the configured service-account key file, else Application Default Credentials.
"""
import asyncio
from pathlib import Path
from typing import Optional

import google.auth
from google.auth.exceptions import DefaultCredentialsError
from google.auth.transport.requests import Request as GoogleAuthRequest

from app.core.config import settings

_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_credentials = None
_project_id: Optional[str] = None


def load() -> bool:
    """Load credentials once. Returns False if no credentials or project are available."""
    global _credentials, _project_id
    if _credentials is None:
        try:
            if settings.google_credentials_file:
                key_path = Path(settings.google_credentials_file)
                if not key_path.is_absolute():
                    key_path = _BACKEND_DIR / key_path
                _credentials, adc_project = google.auth.load_credentials_from_file(str(key_path), scopes=_SCOPES)
            else:
                _credentials, adc_project = google.auth.default(scopes=_SCOPES)
        except DefaultCredentialsError:
            return False
        _project_id = settings.vertex_project_id or adc_project
    return bool(_project_id)


def credentials():
    return _credentials if load() else None


def project_id() -> Optional[str]:
    return _project_id if load() else None


async def access_token() -> str:
    if not _credentials.valid:
        # google-auth refresh is blocking; keep it off the event loop
        await asyncio.to_thread(_credentials.refresh, GoogleAuthRequest())
    return _credentials.token
