from datetime import datetime, date, time
from typing import Optional
from sqlalchemy import String, Integer, Boolean, Float, DateTime, Date, Time, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.database import Base


class MemberRole(str, enum.Enum):
    parent = "parent"
    student = "student"
    guardian = "guardian"


class ActivityType(str, enum.Enum):
    school = "school"
    sports = "sports"
    family = "family"
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


class MealType(str, enum.Enum):
    breakfast = "breakfast"
    morning_snack = "morning_snack"
    lunch = "lunch"
    afternoon_snack = "afternoon_snack"
    evening_snack = "evening_snack"
    dinner = "dinner"
    bedtime_drink = "bedtime_drink"


# Default slot time + ordering for a family's meal schedule
MEAL_SLOT_DEFAULTS: list[tuple["MealType", time]] = [
    (MealType.breakfast, time(7, 30)),
    (MealType.morning_snack, time(10, 0)),
    (MealType.lunch, time(12, 30)),
    (MealType.afternoon_snack, time(15, 30)),
    (MealType.evening_snack, time(17, 30)),
    (MealType.dinner, time(19, 30)),
    (MealType.bedtime_drink, time(21, 30)),
]


class Family(Base):
    __tablename__ = "families"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="America/New_York")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    members: Mapped[list["FamilyMember"]] = relationship("FamilyMember", back_populates="family", cascade="all, delete-orphan")
    calendar_tokens: Mapped[list["GoogleCalendarToken"]] = relationship("GoogleCalendarToken", back_populates="family", cascade="all, delete-orphan")
    pantry_items: Mapped[list["PantryItem"]] = relationship("PantryItem", back_populates="family", cascade="all, delete-orphan")
    meal_slots: Mapped[list["MealSlot"]] = relationship("MealSlot", back_populates="family", cascade="all, delete-orphan")
    meal_plan_items: Mapped[list["MealPlanItem"]] = relationship("MealPlanItem", back_populates="family", cascade="all, delete-orphan")


class FamilyMember(Base):
    __tablename__ = "family_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[MemberRole] = mapped_column(SAEnum(MemberRole), default=MemberRole.parent)
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    school: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    grade: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    color: Mapped[str] = mapped_column(String(7), default="#4F46E5")  # calendar color
    avatar_initials: Mapped[str] = mapped_column(String(3), default="")

    # Default prompt used when generating plans (routine + study + sports sections)
    default_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    family: Mapped["Family"] = relationship("Family", back_populates="members")
    activities: Mapped[list["Activity"]] = relationship("Activity", back_populates="member", cascade="all, delete-orphan")
    generated_schedules: Mapped[list["GeneratedSchedule"]] = relationship("GeneratedSchedule", back_populates="member", cascade="all, delete-orphan")
    subjects: Mapped[list["Subject"]] = relationship("Subject", back_populates="member", cascade="all, delete-orphan")
    study_plans: Mapped[list["StudyPlan"]] = relationship("StudyPlan", back_populates="member", cascade="all, delete-orphan")
    deadlines: Mapped[list["Deadline"]] = relationship("Deadline", back_populates="member", cascade="all, delete-orphan")


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("family_members.id"), nullable=False)
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

    # Google Calendar sync
    google_event_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    synced_to_calendar: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    member: Mapped["FamilyMember"] = relationship("FamilyMember", back_populates="activities")


class GeneratedSchedule(Base):
    __tablename__ = "generated_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    member_id: Mapped[Optional[int]] = mapped_column(ForeignKey("family_members.id"), nullable=True)
    family_id: Mapped[int] = mapped_column(Integer, nullable=False)
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False)
    schedule_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    schedule_start_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    schedule_end_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    is_family_wide: Mapped[bool] = mapped_column(Boolean, default=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # AI-generated markdown
    custom_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prompt_used: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    member: Mapped[Optional["FamilyMember"]] = relationship("FamilyMember", back_populates="generated_schedules")


class GoogleCalendarToken(Base):
    __tablename__ = "google_calendar_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), nullable=False)
    member_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    calendar_id: Mapped[str] = mapped_column(String(300), default="primary")

    family: Mapped["Family"] = relationship("Family", back_populates="calendar_tokens")


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("family_members.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)       # e.g. "Algebra", "Biology"
    teacher: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    difficulty: Mapped[SubjectDifficulty] = mapped_column(SAEnum(SubjectDifficulty), default=SubjectDifficulty.medium)
    homework_frequency: Mapped[HomeworkFrequency] = mapped_column(SAEnum(HomeworkFrequency), default=HomeworkFrequency.daily)
    homework_duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    class_days: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)   # "Mon,Wed,Fri"
    exam_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    member: Mapped["FamilyMember"] = relationship("FamilyMember", back_populates="subjects")
    deadlines: Mapped[list["Deadline"]] = relationship("Deadline", back_populates="subject", cascade="all, delete-orphan")


class StudyPlan(Base):
    __tablename__ = "study_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("family_members.id"), nullable=False)
    week_start: Mapped[date] = mapped_column(Date, nullable=False)   # Monday of the target week
    content: Mapped[str] = mapped_column(Text, nullable=False)       # AI markdown
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    member: Mapped["FamilyMember"] = relationship("FamilyMember", back_populates="study_plans")


class Deadline(Base):
    __tablename__ = "deadlines"

    id:          Mapped[int]           = mapped_column(Integer, primary_key=True, index=True)
    member_id:   Mapped[int]           = mapped_column(ForeignKey("family_members.id"), nullable=False)
    subject_id:  Mapped[Optional[int]] = mapped_column(ForeignKey("subjects.id"), nullable=True)
    title:       Mapped[str]           = mapped_column(String(200), nullable=False)
    deadline_type: Mapped[DeadlineType] = mapped_column(SAEnum(DeadlineType), default=DeadlineType.other)
    due_date:    Mapped[date]          = mapped_column(Date, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed:   Mapped[bool]          = mapped_column(Boolean, default=False)
    created_at:  Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)

    member:  Mapped["FamilyMember"] = relationship("FamilyMember", back_populates="deadlines")
    subject: Mapped[Optional["Subject"]] = relationship("Subject", back_populates="deadlines")


class PantryItem(Base):
    """A food/drink item the family currently has on hand (inventory)."""
    __tablename__ = "pantry_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    quantity: Mapped[float] = mapped_column(Float, default=1)
    unit: Mapped[str] = mapped_column(String(20), default="")   # e.g. "pcs", "kg", "L"
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    family: Mapped["Family"] = relationship("Family", back_populates="pantry_items")


class MealSlot(Base):
    """Per-family time for one of the seven daily meal slots."""
    __tablename__ = "meal_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), nullable=False)
    meal_type: Mapped[MealType] = mapped_column(SAEnum(MealType), nullable=False)
    time: Mapped[time] = mapped_column(Time, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    family: Mapped["Family"] = relationship("Family", back_populates="meal_slots")


class MealPlanItem(Base):
    """One food item planned for a meal slot on a weekday of the family's weekly template."""
    __tablename__ = "meal_plan_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), nullable=False)
    meal_type: Mapped[MealType] = mapped_column(SAEnum(MealType), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)   # 0 = Monday ... 6 = Sunday
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    pantry_item_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("pantry_items.id", ondelete="SET NULL"), nullable=True
    )
    member_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("family_members.id", ondelete="SET NULL"), nullable=True
    )  # None = whole family
    time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)   # per-item override of slot time
    quantity: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)  # portion text, e.g. "1 bowl"
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    family: Mapped["Family"] = relationship("Family", back_populates="meal_plan_items")
    pantry_item: Mapped[Optional["PantryItem"]] = relationship("PantryItem")
    member: Mapped[Optional["FamilyMember"]] = relationship("FamilyMember")
