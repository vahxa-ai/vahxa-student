from datetime import datetime, date, time
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.models import MemberRole, ActivityType, RecurrenceType, SubjectDifficulty, HomeworkFrequency


# --- Family ---

class FamilyCreate(BaseModel):
    name: str
    timezone: str = "America/New_York"


class FamilyOut(BaseModel):
    id: int
    name: str
    timezone: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Family Member ---

class FamilyMemberCreate(BaseModel):
    name: str
    role: MemberRole = MemberRole.parent
    age: Optional[int] = None
    school: Optional[str] = None
    grade: Optional[str] = None
    color: str = "#4F46E5"
    default_prompt: Optional[str] = None


class FamilyMemberUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[MemberRole] = None
    age: Optional[int] = None
    school: Optional[str] = None
    grade: Optional[str] = None
    color: Optional[str] = None
    default_prompt: Optional[str] = None


class FamilyMemberOut(BaseModel):
    id: int
    family_id: int
    name: str
    role: MemberRole
    age: Optional[int]
    school: Optional[str]
    grade: Optional[str]
    color: str
    avatar_initials: str
    default_prompt: Optional[str]

    class Config:
        from_attributes = True


# --- Activity ---

class ActivityCreate(BaseModel):
    title: str
    activity_type: ActivityType = ActivityType.other
    description: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    start_time: Optional[time] = None
    duration_minutes: int = 60
    recurrence: RecurrenceType = RecurrenceType.none
    recurrence_days: Optional[str] = None
    is_special: bool = False


class ActivityUpdate(BaseModel):
    title: Optional[str] = None
    activity_type: Optional[ActivityType] = None
    description: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    start_time: Optional[time] = None
    duration_minutes: Optional[int] = None
    recurrence: Optional[RecurrenceType] = None
    recurrence_days: Optional[str] = None
    is_special: Optional[bool] = None


class ActivityOut(BaseModel):
    id: int
    member_id: int
    title: str
    activity_type: ActivityType
    description: Optional[str]
    location: Optional[str]
    start_date: Optional[date]
    end_date: Optional[date]
    start_time: Optional[time]
    duration_minutes: int
    recurrence: RecurrenceType
    recurrence_days: Optional[str]
    is_special: bool
    synced_to_calendar: bool

    class Config:
        from_attributes = True


# --- Subjects ---

class SubjectCreate(BaseModel):
    name: str
    teacher: Optional[str] = None
    difficulty: SubjectDifficulty = SubjectDifficulty.medium
    homework_frequency: HomeworkFrequency = HomeworkFrequency.daily
    homework_duration_minutes: int = 30
    class_days: Optional[str] = None      # "Mon,Wed,Fri"
    exam_date: Optional[date] = None
    notes: Optional[str] = None


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    teacher: Optional[str] = None
    difficulty: Optional[SubjectDifficulty] = None
    homework_frequency: Optional[HomeworkFrequency] = None
    homework_duration_minutes: Optional[int] = None
    class_days: Optional[str] = None
    exam_date: Optional[date] = None
    notes: Optional[str] = None


class SubjectOut(BaseModel):
    id: int
    member_id: int
    name: str
    teacher: Optional[str]
    difficulty: SubjectDifficulty
    homework_frequency: HomeworkFrequency
    homework_duration_minutes: int
    class_days: Optional[str]
    exam_date: Optional[date]
    notes: Optional[str]

    class Config:
        from_attributes = True


# --- Study Plan ---

class StudyPlanRequest(BaseModel):
    member_id: int
    week_start: date                       # Monday of the target week
    relax_time_per_day_minutes: int = 60   # protected free time each day
    additional_notes: Optional[str] = None


class StudyPlanOut(BaseModel):
    id: int
    member_id: int
    week_start: date
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Schedule Generation ---

class ScheduleGenerateRequest(BaseModel):
    family_id: int
    schedule_date: date
    schedule_end_date: Optional[date] = None   # None = same day only
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    location: Optional[str] = None
    member_id: Optional[int] = None            # None = family-wide schedule
    additional_notes: Optional[str] = None
    custom_prompt: Optional[str] = None        # User's daily routine / preferences for LLM


class ScheduleOut(BaseModel):
    id: int
    family_id: int
    member_id: Optional[int]
    schedule_date: date
    schedule_end_date: Optional[date]
    schedule_start_time: Optional[time]
    schedule_end_time: Optional[time]
    location: Optional[str]
    is_family_wide: bool
    content: str
    custom_prompt: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# --- Unified Planner ---

class UnifiedPlanRequest(BaseModel):
    family_id: int
    start_date: date
    end_date: Optional[date] = None          # None = single day
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    location: Optional[str] = None
    member_id: Optional[int] = None          # None = whole family
    relax_time_per_day_minutes: int = 60
    include_study_sessions: bool = True
    custom_prompt: Optional[str] = None
    additional_notes: Optional[str] = None


class UnifiedPlanOut(BaseModel):
    content: str
    start_date: date
    end_date: Optional[date]
    family_id: int


# --- Reports ---

class ReportType(str):
    daily = "daily"
    weekly = "weekly"


class ReportRequest(BaseModel):
    family_id: int
    report_date: date                          # anchor date (day for daily, week start for weekly)
    report_type: str = "daily"                 # "daily" | "weekly"
    member_id: Optional[int] = None


class ReportOut(BaseModel):
    report_type: str
    report_date: date
    family_id: int
    member_id: Optional[int]
    content: str                               # AI-generated markdown report


# --- Calendar Sync ---

class CalendarSyncRequest(BaseModel):
    family_id: int
    member_id: Optional[int] = None


class CalendarEventOut(BaseModel):
    id: str
    summary: str
    start: str
    end: str
    description: Optional[str] = None
    location: Optional[str] = None


# --- Deadlines ---

from app.models.models import DeadlineType

class DeadlineCreate(BaseModel):
    title:         str
    deadline_type: DeadlineType = DeadlineType.other
    due_date:      date
    subject_id:    Optional[int] = None
    description:   Optional[str] = None


class DeadlineUpdate(BaseModel):
    title:         Optional[str] = None
    deadline_type: Optional[DeadlineType] = None
    due_date:      Optional[date] = None
    subject_id:    Optional[int] = None
    description:   Optional[str] = None
    completed:     Optional[bool] = None


class DeadlineOut(BaseModel):
    id:            int
    member_id:     int
    subject_id:    Optional[int]
    title:         str
    deadline_type: DeadlineType
    due_date:      date
    description:   Optional[str]
    completed:     bool
    created_at:    datetime

    class Config:
        from_attributes = True


# --- Pantry (inventory) ---

from datetime import time as _time   # aliased: "time" is used as a field name below
from app.models.models import MealType


class PantryItemCreate(BaseModel):
    name: str
    category: Optional[str] = None
    quantity: float = 1
    unit: str = ""
    notes: Optional[str] = None


class PantryItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    notes: Optional[str] = None


class PantryItemOut(BaseModel):
    id: int
    family_id: int
    name: str
    category: Optional[str]
    quantity: float
    unit: str
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# --- Weekly Meal Plan ---

class MealSlotOut(BaseModel):
    id: int
    family_id: int
    meal_type: MealType
    time: _time
    sort_order: int

    class Config:
        from_attributes = True


class MealSlotUpdate(BaseModel):
    time: _time


class MealPlanItemCreate(BaseModel):
    meal_type: MealType
    day_of_week: int = Field(ge=0, le=6)
    name: str
    pantry_item_id: Optional[int] = None
    member_id: Optional[int] = None    # None = whole family
    time: Optional[_time] = None
    quantity: Optional[str] = None
    notes: Optional[str] = None
    sort_order: int = 0


class MealPlanItemUpdate(BaseModel):
    meal_type: Optional[MealType] = None
    day_of_week: Optional[int] = Field(default=None, ge=0, le=6)
    name: Optional[str] = None
    pantry_item_id: Optional[int] = None
    member_id: Optional[int] = None
    time: Optional[_time] = None
    quantity: Optional[str] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None


class MealPlanItemOut(BaseModel):
    id: int
    family_id: int
    meal_type: MealType
    day_of_week: int
    name: str
    pantry_item_id: Optional[int]
    member_id: Optional[int]
    time: Optional[_time]
    quantity: Optional[str]
    notes: Optional[str]
    sort_order: int

    class Config:
        from_attributes = True


class MealPlanOut(BaseModel):
    slots: List[MealSlotOut]
    items: List[MealPlanItemOut]
