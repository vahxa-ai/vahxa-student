from datetime import datetime, date, time
from typing import Optional, Union
from pydantic import BaseModel, Field
import re

from pydantic import field_validator

from app.models.models import (
    ActivityType, RecurrenceType, SubjectDifficulty, HomeworkFrequency, DeadlineType,
    StudentStatus, ConsentStatus,
)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean_email(value: str) -> str:
    value = (value or "").strip().lower()
    if not _EMAIL_RE.match(value) or len(value) > 320:
        raise ValueError("Enter a valid email address")
    return value


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
    status: Optional[StudentStatus] = None
    status_note: Optional[str] = None
    parent_name: Optional[str] = None
    parent_email: Optional[str] = None
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


class PracticeQuestion(BaseModel):
    question: str
    answer: str                      # short final answer
    explanation: str = ""            # step-by-step worked solution
    difficulty: str = "medium"       # easy | medium | hard


class CurriculumUnitOut(BaseModel):
    id: int
    position: int
    title: str
    overview: Optional[str]
    details: Optional[UnitDetails]
    details_generated_at: Optional[datetime]
    practice: Optional[list[PracticeQuestion]] = None
    practice_generated_at: Optional[datetime] = None
    quiz_size: Optional[int] = None                  # questions in the unit's quiz bank (answers never sent here)
    quiz_generated_at: Optional[datetime] = None
    from_library: bool = False       # served from the shared library on this request


class CurriculumOut(BaseModel):
    subject_id: int
    framework: Optional[str]
    source: Optional[str]            # "syllabus" | "standards"
    generated_at: Optional[datetime]
    shared: bool = False             # linked to the shared library for this student's category
    from_library: bool = False       # loaded from the shared library on this request (no AI call)
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


# --- Accounts ---

class GoogleSignInRequest(BaseModel):
    credential: str


class UserOut(BaseModel):
    id: int
    email: str
    name: Optional[str]
    picture: Optional[str]
    is_admin: bool = False


class ConsentSummary(BaseModel):
    status: ConsentStatus
    parent_email: str
    requested_at: datetime
    last_sent_at: Optional[datetime]
    expires_at: datetime
    granted_at: Optional[datetime]


class MeOut(BaseModel):
    user: UserOut
    student: Optional[StudentOut] = None
    consent: Optional[ConsentSummary] = None        # latest consent request for this student
    is_parent: bool = False                          # has granted/pending consents as a parent


class AuthConfigOut(BaseModel):
    google_client_id: str
    consent_version: str


class OnboardingRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    age: Optional[int] = Field(default=None, ge=3, le=25)
    school: Optional[str] = Field(default=None, max_length=200)
    grade: Optional[str] = Field(default=None, max_length=20)
    county: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    country: Optional[str] = Field(default=None, max_length=100)
    timezone: str = "America/New_York"
    parent_name: str = Field(min_length=1, max_length=200)
    parent_email: str

    @field_validator("parent_email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _clean_email(v)


class ParentContactUpdate(BaseModel):
    parent_name: str = Field(min_length=1, max_length=200)
    parent_email: str

    @field_validator("parent_email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _clean_email(v)


# --- Parental consent ---

class ConsentInfoOut(BaseModel):
    """What a parent sees when opening a consent link."""
    status: ConsentStatus
    expired: bool
    student_name: str
    student_email: str
    parent_email: str               # the Google account that must sign in to consent
    consent_version: str


class ConsentGrantRequest(BaseModel):
    parent_full_name: str = Field(min_length=2, max_length=200)
    relationship: str = Field(min_length=2, max_length=50)
    agree: bool


class ParentChildOut(BaseModel):
    consent_id: int
    student_name: str
    student_email: str
    consent_status: ConsentStatus
    student_status: Optional[StudentStatus]
    granted_at: Optional[datetime]
    revoked_at: Optional[datetime]


# --- Admin ---

class AdminConsentOut(BaseModel):
    status: ConsentStatus
    parent_email: str
    parent_full_name: Optional[str]
    relationship: Optional[str]
    consent_version: Optional[str]
    requested_at: datetime
    granted_at: Optional[datetime]
    granted_ip: Optional[str]
    revoked_at: Optional[datetime]


class AdminStudentOut(BaseModel):
    id: int
    name: str
    email: Optional[str]
    age: Optional[int]
    grade: Optional[str]
    school: Optional[str]
    location: str
    status: Optional[StudentStatus]
    status_note: Optional[str]
    status_changed_at: Optional[datetime]
    created_at: datetime
    parent_name: Optional[str]
    parent_email: Optional[str]
    consent: Optional[AdminConsentOut]


class AdminActionRequest(BaseModel):
    note: Optional[str] = Field(default=None, max_length=1000)


# --- Quizzes & tests ---

class QuizStartRequest(BaseModel):
    kind: str = Field(pattern="^(quiz|test)$")
    unit_id: Optional[int] = None                    # quiz: the unit
    unit_ids: Optional[list[int]] = None             # test: units to include (None = all units)
    count: int = Field(default=10, ge=5, le=50)
    time_limit_minutes: Optional[int] = Field(default=None, ge=1, le=180)


class AttemptQuestionOut(BaseModel):
    index: int
    question: str
    options: list[str]
    difficulty: str
    unit_title: str
    # Only present once revealed (quiz: after answering; test: after submitting)
    your_answer: Optional[int] = None
    correct_answer: Optional[int] = None
    correct: Optional[bool] = None
    explanation: Optional[str] = None


class AttemptOut(BaseModel):
    id: int
    subject_id: int
    kind: str
    unit_ids: list[int]
    total: int
    score: Optional[int]
    time_limit_minutes: Optional[int]
    started_at: datetime
    expires_at: Optional[datetime]
    submitted_at: Optional[datetime]
    timed_out: bool
    questions: list[AttemptQuestionOut]


class AnswerRequest(BaseModel):
    index: int = Field(ge=0)
    choice: int = Field(ge=0, le=3)


class SubmitRequest(BaseModel):
    answers: Optional[list[Optional[int]]] = None    # tests: one entry per question (null = unanswered)


class AttemptSummaryOut(BaseModel):
    id: int
    kind: str
    unit_ids: list[int]
    unit_titles: list[str]
    score: Optional[int]
    total: int
    percent: Optional[int]
    started_at: datetime
    submitted_at: Optional[datetime]
    timed_out: bool


# --- Sample tests (mock exam papers) ---

class SampleTestSectionSummary(BaseModel):
    title: str
    type: str
    questions: int
    marks: int


class SampleTestSummaryOut(BaseModel):
    id: int
    number: int
    title: str
    duration_minutes: int
    total_marks: int
    sections: list[SampleTestSectionSummary]
    attempts: int = 0
    best_percent: Optional[int] = None
    in_progress_attempt_id: Optional[int] = None


class SampleTestListOut(BaseModel):
    tests: list[SampleTestSummaryOut]
    can_generate: bool
    limit: int


class MarkingPoint(BaseModel):
    point: str
    marks: int


class STQuestionOut(BaseModel):
    id: str
    type: str                                       # mcq | short | long
    question: str
    marks: int
    options: Optional[list[str]] = None             # mcq only
    your_answer: Optional[Union[int, str]] = None
    # revealed after submitting
    correct_answer: Optional[int] = None            # mcq
    correct: Optional[bool] = None                  # mcq
    explanation: Optional[str] = None               # mcq
    model_answer: Optional[str] = None              # written
    marking_points: Optional[list[MarkingPoint]] = None
    awarded: Optional[int] = None                   # written: self-marked score


class STSectionOut(BaseModel):
    id: str
    title: str
    type: str
    instructions: str
    marks: int
    questions: list[STQuestionOut]


class SampleTestAttemptOut(BaseModel):
    id: int
    subject_id: int
    unit_title: str
    number: int
    title: str
    instructions: str
    duration_minutes: int
    total_marks: int
    time_limit_minutes: Optional[int]
    started_at: datetime
    expires_at: Optional[datetime]
    submitted_at: Optional[datetime]
    marked_at: Optional[datetime]
    timed_out: bool
    mcq_score: Optional[int]
    mcq_marks: int
    written_score: Optional[int]
    written_marks: int
    total_score: Optional[int]                      # once written answers are self-marked
    sections: list[STSectionOut]


class SampleTestStartRequest(BaseModel):
    timed: bool = False


class SampleTestSubmitRequest(BaseModel):
    answers: dict[str, Optional[Union[int, str]]] = {}


class SelfMarkRequest(BaseModel):
    marks: dict[str, int]


# --- College prep ---

class AthleticsPrefs(BaseModel):
    sport: Optional[str] = Field(default=None, max_length=100)
    team: Optional[str] = Field(default=None, pattern="^(mens|womens|coed)$")   # performance standards differ
    position_or_event: Optional[str] = Field(default=None, max_length=100)
    level: Optional[str] = Field(default=None, max_length=100)          # e.g. varsity starter, club, state-ranked
    stats: Optional[str] = Field(default=None, max_length=500)          # times, stats, honors
    wants_to_compete: bool = False


class CollegePreferences(BaseModel):
    regions: Optional[str] = Field(default=None, max_length=200)        # e.g. "Texas, Northeast", "anywhere"
    size: Optional[str] = Field(default=None, pattern="^(small|medium|large|any)$")
    setting: Optional[str] = Field(default=None, pattern="^(urban|suburban|rural|any)$")
    need_aid: Optional[str] = Field(default=None, pattern="^(yes|maybe|no)$")
    budget_note: Optional[str] = Field(default=None, max_length=300)
    priorities: list[str] = Field(default=[], max_length=5)             # academics | aid | athletics | location | size
    athletics: Optional[AthleticsPrefs] = None


class CollegeProfileIn(BaseModel):
    intended_majors: Optional[str] = Field(default=None, max_length=300)
    interests: Optional[str] = Field(default=None, max_length=2000)
    career_goals: Optional[str] = Field(default=None, max_length=2000)
    gpa: Optional[str] = Field(default=None, max_length=40)
    test_scores: Optional[str] = Field(default=None, max_length=300)
    notes: Optional[str] = Field(default=None, max_length=2000)
    preferences: Optional[CollegePreferences] = None


class CollegeProfileOut(CollegeProfileIn):
    updated_at: Optional[datetime] = None


class GuideChapter(BaseModel):
    id: str
    title: str
    summary: str
    body: str
    key_takeaways: list[str]


class AdmissionsGuideOut(BaseModel):
    country: str
    title: str
    intro: str
    chapters: list[GuideChapter]
    generated_at: datetime


class RoadmapMilestone(BaseModel):
    id: str
    title: str
    detail: str
    category: str
    completed_at: Optional[datetime] = None


class RoadmapStage(BaseModel):
    id: str
    label: str
    focus: str
    goals: list[str]
    milestones: list[RoadmapMilestone]


class RoadmapOut(BaseModel):
    overview: str
    stages: list[RoadmapStage]
    generated_at: datetime
    completed: int
    total: int


class MilestoneUpdate(BaseModel):
    completed: bool


class CollegeSummary(BaseModel):
    recognized: bool
    official_name: str = ""
    location: str = ""
    type: str = ""
    overview: str = ""
    what_they_look_for: list[str] = []
    typical_requirements: list[str] = []
    testing_policy: str = ""
    application_options: str = ""
    selectivity: str = ""
    fit_for_student: str = ""
    next_steps: list[str] = []


class CollegeEntryIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    category: str = Field(default="undecided", pattern="^(reach|target|likely|undecided)$")
    notes: Optional[str] = Field(default=None, max_length=2000)


class CollegeEntryUpdate(BaseModel):
    category: Optional[str] = Field(default=None, pattern="^(reach|target|likely|undecided)$")
    notes: Optional[str] = Field(default=None, max_length=2000)


class CollegeEntryOut(BaseModel):
    id: int
    name: str
    category: str
    notes: Optional[str]
    summary: Optional[CollegeSummary]
    summary_generated_at: Optional[datetime]
    created_at: datetime


class AchievementIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: str = Field(default="extracurricular",
                          pattern="^(extracurricular|leadership|award|volunteer|work|summer|research|arts|athletics|other)$")
    organization: Optional[str] = Field(default=None, max_length=200)
    role: Optional[str] = Field(default=None, max_length=200)
    grades: Optional[str] = Field(default=None, max_length=40)
    hours_per_week: Optional[float] = Field(default=None, ge=0, le=100)
    weeks_per_year: Optional[int] = Field(default=None, ge=0, le=52)
    description: Optional[str] = Field(default=None, max_length=2000)


class AchievementOut(AchievementIn):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RecommendedCollege(BaseModel):
    name: str
    location: str = ""
    fit_category: str = "target"             # reach | target | likely
    why: str = ""
    division: str = ""                       # athletics lens: e.g. "NCAA Division III"
    athletics_note: str = ""
    aid_note: str = ""
    academic_note: str = ""


class RecommendationGroup(BaseModel):
    key: str                                 # athletics | aid | academics
    title: str
    intro: str = ""
    colleges: list[RecommendedCollege]


class AthleticLevelFit(BaseModel):
    division: str
    fit: str                                 # strong | possible | stretch
    why: str


class RecommendationsOut(BaseModel):
    summary: str
    athletic_levels: list[AthleticLevelFit] = []
    groups: list[RecommendationGroup]
    next_steps: list[str] = []
    removed_by_check: int = 0                # recommendations dropped by the fact-check
    generated_at: datetime
