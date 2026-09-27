from datetime import datetime, date, time
from typing import Optional
from sqlalchemy import String, Integer, Boolean, DateTime, Date, Time, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.database import Base


class StudentStatus(str, enum.Enum):
    awaiting_consent = "awaiting_consent"      # profile done, waiting for a parent to consent
    awaiting_approval = "awaiting_approval"    # parent consented, waiting for an admin
    approved = "approved"
    rejected = "rejected"
    suspended = "suspended"


class ConsentStatus(str, enum.Enum):
    pending = "pending"
    granted = "granted"
    revoked = "revoked"
    superseded = "superseded"                  # replaced by a newer request (e.g. parent email changed)


class ActivityType(str, enum.Enum):
    school = "school"
    sports = "sports"
    medical = "medical"
    hobby = "hobby"
    other = "other"


class SubjectDifficulty(str, enum.Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class HomeworkFrequency(str, enum.Enum):
    daily = "daily"
    alternate = "alternate"    # every other day
    weekly = "weekly"
    as_needed = "as_needed"


class DeadlineType(str, enum.Enum):
    exam        = "exam"
    assignment  = "assignment"
    essay       = "essay"
    internship  = "internship"
    project     = "project"
    other       = "other"


class RecurrenceType(str, enum.Enum):
    none = "none"
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"


class User(Base):
    """A Google account that has signed in (student, parent, or admin)."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    google_sub: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True)  # None = pre-provisioned
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)                # stored lowercase
    name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    picture: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class Student(Base):
    """A student's profile. Every activity, subject and deadline belongs to one student."""
    __tablename__ = "student"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Nullable only so the additive startup migration can add it to existing tables; always set in code.
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, unique=True, index=True)
    status: Mapped[Optional[StudentStatus]] = mapped_column(SAEnum(StudentStatus), nullable=True)
    parent_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    parent_email: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status_changed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)   # e.g. admin's reason
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    school: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    grade: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # Location — used to pick the curriculum standards (e.g. state standards, national board)
    county: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="America/New_York")

    # Default prompt used when generating plans (routine + study + sports sections)
    default_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ParentalConsent(Base):
    """A request for (and record of) a parent's consent for one student.
    The parent must sign in with the Google account matching parent_email to grant it."""
    __tablename__ = "parental_consents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student.id"), nullable=False, index=True)
    parent_email: Mapped[str] = mapped_column(String(320), nullable=False)       # lowercase
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    status: Mapped[ConsentStatus] = mapped_column(SAEnum(ConsentStatus), default=ConsentStatus.pending)
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # Filled in when granted — the audit record
    parent_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    parent_full_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    relationship: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    consent_version: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    granted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    granted_ip: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    granted_user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[Optional[int]] = mapped_column(ForeignKey("student.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    activity_type: Mapped[ActivityType] = mapped_column(SAEnum(ActivityType), default=ActivityType.other)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)

    # Timing
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    start_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    recurrence: Mapped[RecurrenceType] = mapped_column(SAEnum(RecurrenceType), default=RecurrenceType.none)
    recurrence_days: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # "Mon,Wed,Fri"

    # Special / non-regular flag (doctor, library, functions, etc.)
    is_special: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[Optional[int]] = mapped_column(ForeignKey("student.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)       # e.g. "Algebra", "Biology"
    teacher: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    difficulty: Mapped[SubjectDifficulty] = mapped_column(SAEnum(SubjectDifficulty), default=SubjectDifficulty.medium)
    homework_frequency: Mapped[HomeworkFrequency] = mapped_column(SAEnum(HomeworkFrequency), default=HomeworkFrequency.daily)
    homework_duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    class_days: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)   # "Mon,Wed,Fri"
    exam_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Curriculum — optional pasted syllabus; the rest is filled in by AI generation
    syllabus_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    curriculum_framework: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    curriculum_source: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)   # "syllabus" | "standards"
    curriculum_generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # Shared-library category key; None = private (syllabus-based or incomplete profile)
    curriculum_library_key: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    deadlines: Mapped[list["Deadline"]] = relationship("Deadline", back_populates="subject", cascade="all, delete-orphan")
    units: Mapped[list["CurriculumUnit"]] = relationship(
        "CurriculumUnit", back_populates="subject", cascade="all, delete-orphan", order_by="CurriculumUnit.position"
    )


class CurriculumUnit(Base):
    """One unit/chapter of a subject's curriculum. Details are generated on demand and cached."""
    __tablename__ = "curriculum_units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    overview: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    details_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)   # {summary, key_concepts, formulas}
    details_generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    practice_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)   # [{question, answer, explanation, difficulty}]
    practice_generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    subject: Mapped["Subject"] = relationship("Subject", back_populates="units")


class Deadline(Base):
    __tablename__ = "deadlines"

    id:          Mapped[int]           = mapped_column(Integer, primary_key=True, index=True)
    student_id:  Mapped[Optional[int]] = mapped_column(ForeignKey("student.id"), nullable=True, index=True)
    subject_id:  Mapped[Optional[int]] = mapped_column(ForeignKey("subjects.id"), nullable=True)
    title:       Mapped[str]           = mapped_column(String(200), nullable=False)
    deadline_type: Mapped[DeadlineType] = mapped_column(SAEnum(DeadlineType), default=DeadlineType.other)
    due_date:    Mapped[date]          = mapped_column(Date, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed:   Mapped[bool]          = mapped_column(Boolean, default=False)
    created_at:  Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)

    subject: Mapped[Optional["Subject"]] = relationship("Subject", back_populates="deadlines")
