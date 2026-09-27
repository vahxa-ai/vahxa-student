"""
Shared curriculum library (Firestore).

Standards-based curricula are shared between all students in the same category —
subject + grade + state + country — so Gemma is only called on a cache miss or when a
student explicitly regenerates (which replaces the shared copy). Syllabus-based curricula
are school-specific and never shared. No personal data is stored in the library.

All public functions are best-effort: library failures are logged and treated as a miss.
"""
import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from app.core.config import settings
from app.models.models import Student, Subject
from app.services import gcp

log = logging.getLogger(__name__)

# ─── Category key ─────────────────────────────────────────────────────────────

_ROMAN = {"i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5"}

_COUNTRY_ALIASES = {
    "us": "united states", "usa": "united states", "u s": "united states", "u s a": "united states",
    "united states of america": "united states", "america": "united states",
    "uk": "united kingdom", "u k": "united kingdom", "great britain": "united kingdom", "britain": "united kingdom",
    "uae": "united arab emirates",
}

_US_STATES = {
    "al": "alabama", "ak": "alaska", "az": "arizona", "ar": "arkansas", "ca": "california", "co": "colorado",
    "ct": "connecticut", "de": "delaware", "dc": "district of columbia", "fl": "florida", "ga": "georgia",
    "hi": "hawaii", "id": "idaho", "il": "illinois", "in": "indiana", "ia": "iowa", "ks": "kansas",
    "ky": "kentucky", "la": "louisiana", "me": "maine", "md": "maryland", "ma": "massachusetts",
    "mi": "michigan", "mn": "minnesota", "ms": "mississippi", "mo": "missouri", "mt": "montana",
    "ne": "nebraska", "nv": "nevada", "nh": "new hampshire", "nj": "new jersey", "nm": "new mexico",
    "ny": "new york", "nc": "north carolina", "nd": "north dakota", "oh": "ohio", "ok": "oklahoma",
    "or": "oregon", "pa": "pennsylvania", "ri": "rhode island", "sc": "south carolina", "sd": "south dakota",
    "tn": "tennessee", "tx": "texas", "ut": "utah", "vt": "vermont", "va": "virginia", "wa": "washington",
    "wv": "west virginia", "wi": "wisconsin", "wy": "wyoming",
}


def _norm(text: Optional[str]) -> str:
    text = (text or "").lower().replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _norm_subject(name: str) -> str:
    return " ".join(_ROMAN.get(tok, tok) for tok in _norm(name).split())


def _norm_grade(grade: Optional[str]) -> str:
    g = _norm(grade)
    if g in ("k", "kg", "kindergarten"):
        return "k"
    m = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\b", g)
    return m.group(1) if m else g


def _norm_country(country: Optional[str]) -> str:
    c = _norm(country)
    return _COUNTRY_ALIASES.get(c, c)


def _norm_state(state: Optional[str], country: str) -> str:
    s = _norm(state)
    return _US_STATES.get(s, s) if country == "united states" else s


def category(student: Student, subject: Subject) -> Optional[dict]:
    """Normalized sharing category, or None if this curriculum should not be shared."""
    if (subject.syllabus_text or "").strip():
        return None  # school-specific
    country = _norm_country(student.country)
    cat = {
        "subject": _norm_subject(subject.name),
        "grade": _norm_grade(student.grade),
        "state": _norm_state(student.state, country),
        "country": country,
    }
    if not (cat["subject"] and cat["grade"] and cat["country"]):
        return None
    return cat


def category_key(cat: dict) -> str:
    raw = "|".join([cat["subject"], cat["grade"], cat["state"], cat["country"]])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:40]


# ─── Firestore backend ────────────────────────────────────────────────────────

class FirestoreLibrary:
    def __init__(self) -> None:
        self._client = None

    def _collection(self):
        if self._client is None:
            from google.cloud import firestore
            self._client = firestore.AsyncClient(
                project=gcp.project_id(), credentials=gcp.credentials(), database=settings.firestore_database
            )
        return self._client.collection(settings.curriculum_library_collection)

    async def get(self, key: str) -> Optional[dict]:
        snap = await self._collection().document(key).get()
        return snap.to_dict() if snap.exists else None

    async def put(self, key: str, doc: dict) -> None:
        await self._collection().document(key).set(doc)

    async def set_unit_fields(self, key: str, position: int, title: str, fields: dict, at: str) -> bool:
        from google.cloud import firestore
        ref = self._collection().document(key)

        @firestore.async_transactional
        async def txn(transaction):
            snap = await ref.get(transaction=transaction)
            if not snap.exists:
                return False
            units = snap.to_dict().get("units", [])
            # Only write if the shared outline still has this unit (it may have been regenerated meanwhile)
            if position >= len(units) or units[position].get("title") != title:
                return False
            units[position].update(fields)
            transaction.update(ref, {"units": units, "updated_at": at})
            return True

        return await txn(self._client.transaction())

    async def append_unit_item(self, key: str, position: int, title: str, field: str, item: dict,
                               limit: int, at: str) -> Optional[int]:
        """Append to a list field of one unit; returns the new list length, or None if not appended."""
        from google.cloud import firestore
        ref = self._collection().document(key)

        @firestore.async_transactional
        async def txn(transaction):
            snap = await ref.get(transaction=transaction)
            if not snap.exists:
                return None
            units = snap.to_dict().get("units", [])
            if position >= len(units) or units[position].get("title") != title:
                return None
            items = list(units[position].get(field) or [])
            if len(items) >= limit:
                return None
            items.append(item)
            units[position][field] = items
            transaction.update(ref, {"units": units, "updated_at": at})
            return len(items)

        return await txn(self._client.transaction())


_backend: Optional[FirestoreLibrary] = FirestoreLibrary()


def _enabled() -> bool:
    return settings.curriculum_library_enabled and _backend is not None and gcp.load()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Public API (best-effort) ─────────────────────────────────────────────────

async def lookup(key: str) -> Optional[dict]:
    """Shared entry {framework, units: [{title, overview, details, details_generated_at}], ...} or None."""
    if not _enabled():
        return None
    try:
        doc = await _backend.get(key)
        return doc if doc and doc.get("units") else None
    except Exception as e:  # never let the library break curriculum loading
        log.warning("Curriculum library lookup failed: %s", e)
        return None


async def publish(key: str, cat: dict, display: dict, framework: Optional[str], units: list[dict]) -> None:
    """Create or replace the shared outline for a category (replaces any shared unit notes)."""
    if not _enabled():
        return
    now = _now()
    try:
        await _backend.put(key, {
            "category": cat,
            "display": display,
            "framework": framework,
            "units": [
                {"title": u["title"], "overview": u.get("overview"), "details": None, "details_generated_at": None,
                 "practice": None, "practice_generated_at": None, "quiz": None, "quiz_generated_at": None,
                 "sample_tests": []}
                for u in units
            ],
            "model": settings.vertex_model,
            "generated_at": now,
            "updated_at": now,
        })
    except Exception as e:
        log.warning("Curriculum library publish failed: %s", e)


async def _publish_unit_fields(key: str, position: int, title: str, name: str, value) -> None:
    if not _enabled():
        return
    now = _now()
    try:
        await _backend.set_unit_fields(key, position, title, {name: value, f"{name}_generated_at": now}, now)
    except Exception as e:
        log.warning("Curriculum library unit publish (%s) failed: %s", name, e)


async def publish_unit_details(key: str, position: int, title: str, details: dict) -> None:
    await _publish_unit_fields(key, position, title, "details", details)


async def publish_unit_practice(key: str, position: int, title: str, practice: list[dict]) -> None:
    await _publish_unit_fields(key, position, title, "practice", practice)


async def publish_unit_quiz(key: str, position: int, title: str, quiz: list[dict]) -> None:
    await _publish_unit_fields(key, position, title, "quiz", quiz)


async def publish_sample_test(key: str, position: int, title: str, paper: dict, limit: int) -> Optional[int]:
    """Append a sample test paper to the shared unit; returns its 1-based number in the library, if stored."""
    if not _enabled():
        return None
    try:
        return await _backend.append_unit_item(key, position, title, "sample_tests", paper, limit, _now())
    except Exception as e:
        log.warning("Curriculum library sample test publish failed: %s", e)
        return None
