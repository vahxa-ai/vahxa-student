from datetime import datetime, date, time
from typing import Optional
from sqlalchemy import String, Integer, Boolean, DateTime, Date, Time, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.database import Base


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


class Student(Base):
    """The single student this app instance plans for (one row)."""
    __tablename__ = "student"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    school: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    grade: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="America/New_York")

    # Default prompt used when generating plans (routine + study + sports sections)
    default_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
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
    name: Mapped[str] = mapped_column(String(100), nullable=False)       # e.g. "Algebra", "Biology"
    teacher: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    difficulty: Mapped[SubjectDifficulty] = mapped_column(SAEnum(SubjectDifficulty), default=SubjectDifficulty.medium)
    homework_frequency: Mapped[HomeworkFrequency] = mapped_column(SAEnum(HomeworkFrequency), default=HomeworkFrequency.daily)
    homework_duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    class_days: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)   # "Mon,Wed,Fri"
    exam_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    deadlines: Mapped[list["Deadline"]] = relationship("Deadline", back_populates="subject", cascade="all, delete-orphan")


class Deadline(Base):
    __tablename__ = "deadlines"

    id:          Mapped[int]           = mapped_column(Integer, primary_key=True, index=True)
    subject_id:  Mapped[Optional[int]] = mapped_column(ForeignKey("subjects.id"), nullable=True)
    title:       Mapped[str]           = mapped_column(String(200), nullable=False)
    deadline_type: Mapped[DeadlineType] = mapped_column(SAEnum(DeadlineType), default=DeadlineType.other)
    due_date:    Mapped[date]          = mapped_column(Date, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed:   Mapped[bool]          = mapped_column(Boolean, default=False)
    created_at:  Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)

    subject: Mapped[Optional["Subject"]] = relationship("Subject", back_populates="deadlines")
