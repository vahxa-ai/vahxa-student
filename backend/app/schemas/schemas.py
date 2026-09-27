from datetime import datetime, date, time
from typing import Optional
from pydantic import BaseModel
from app.models.models import ActivityType, RecurrenceType, SubjectDifficulty, HomeworkFrequency, DeadlineType


# --- Student profile ---

class StudentUpsert(BaseModel):
    name: str
    age: Optional[int] = None
    school: Optional[str] = None
    grade: Optional[str] = None
    county: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    timezone: str = "America/New_York"
    default_prompt: Optional[str] = None


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    school: Optional[str] = None
    grade: Optional[str] = None
    county: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    default_prompt: Optional[str] = None


class StudentOut(BaseModel):
    id: int
    name: str
    age: Optional[int]
    school: Optional[str]
    grade: Optional[str]
    county: Optional[str]
    state: Optional[str]
    country: Optional[str]
    timezone: str
    default_prompt: Optional[str]
    created_at: datetime

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
    syllabus_text: Optional[str] = None


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    teacher: Optional[str] = None
    difficulty: Optional[SubjectDifficulty] = None
    homework_frequency: Optional[HomeworkFrequency] = None
    homework_duration_minutes: Optional[int] = None
    class_days: Optional[str] = None
    exam_date: Optional[date] = None
    notes: Optional[str] = None
    syllabus_text: Optional[str] = None


class SubjectOut(BaseModel):
    id: int
    name: str
    teacher: Optional[str]
    difficulty: SubjectDifficulty
    homework_frequency: HomeworkFrequency
    homework_duration_minutes: int
    class_days: Optional[str]
    exam_date: Optional[date]
    notes: Optional[str]
    syllabus_text: Optional[str]
    curriculum_framework: Optional[str]
    curriculum_source: Optional[str]
    curriculum_generated_at: Optional[datetime]

    class Config:
        from_attributes = True


# --- Curriculum ---

class KeyConcept(BaseModel):
    name: str
    explanation: str


class Formula(BaseModel):
    name: str
    expression: str
    explanation: str = ""


class UnitDetails(BaseModel):
    summary: str
    key_concepts: list[KeyConcept] = []
    formulas: list[Formula] = []


class CurriculumUnitOut(BaseModel):
    id: int
    position: int
    title: str
    overview: Optional[str]
    details: Optional[UnitDetails]
    details_generated_at: Optional[datetime]


class CurriculumOut(BaseModel):
    subject_id: int
    framework: Optional[str]
    source: Optional[str]            # "syllabus" | "standards"
    generated_at: Optional[datetime]
    units: list[CurriculumUnitOut]


# --- Planner ---

class PlanRequest(BaseModel):
    start_date: date
    end_date: Optional[date] = None          # None = single day
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    location: Optional[str] = None
    relax_time_per_day_minutes: int = 60
    include_study_sessions: bool = True
    custom_prompt: Optional[str] = None
    additional_notes: Optional[str] = None


class PlanOut(BaseModel):
    content: str
    start_date: date
    end_date: Optional[date]


# --- Deadlines ---

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
    subject_id:    Optional[int]
    title:         str
    deadline_type: DeadlineType
    due_date:      date
    description:   Optional[str]
    completed:     bool
    created_at:    datetime

    class Config:
        from_attributes = True
