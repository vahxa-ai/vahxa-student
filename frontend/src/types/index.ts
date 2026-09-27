export type ActivityType = "school" | "sports" | "medical" | "hobby" | "other";
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

export type StudentStatus = "awaiting_consent" | "awaiting_approval" | "approved" | "rejected" | "suspended";
export type ConsentStatus = "pending" | "granted" | "revoked" | "superseded";

export interface Student {
  id: number;
  status: StudentStatus | null;
  status_note: string | null;
  parent_name: string | null;
  parent_email: string | null;
  name: string;
  age: number | null;
  school: string | null;
  grade: string | null;
  county: string | null;
  state: string | null;
  country: string | null;
  timezone: string;
  default_prompt: string | null;
  created_at: string;
}

export interface Activity {
  id: number;
  title: string;
  activity_type: ActivityType;
  description: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  duration_minutes: number;
  recurrence: RecurrenceType;
  recurrence_days: string | null;
  is_special: boolean;
}

export type SubjectDifficulty = "easy" | "medium" | "hard";
export type HomeworkFrequency = "daily" | "alternate" | "weekly" | "as_needed";

export interface Subject {
  id: number;
  name: string;
  teacher: string | null;
  difficulty: SubjectDifficulty;
  homework_frequency: HomeworkFrequency;
  homework_duration_minutes: number;
  class_days: string | null;
  exam_date: string | null;
  notes: string | null;
  syllabus_text: string | null;
  curriculum_framework: string | null;
  curriculum_source: "syllabus" | "standards" | null;
  curriculum_generated_at: string | null;
}

export interface KeyConcept {
  name: string;
  explanation: string;
}

export interface Formula {
  name: string;
  expression: string;
  explanation: string;
}

export interface UnitDetails {
  summary: string;
  key_concepts: KeyConcept[];
  formulas: Formula[];
}

export type PracticeDifficulty = "easy" | "medium" | "hard";

export interface PracticeQuestion {
  question: string;
  answer: string;          // short final answer
  explanation: string;     // step-by-step worked solution
  difficulty: PracticeDifficulty;
}

export interface CurriculumUnit {
  id: number;
  position: number;
  title: string;
  overview: string | null;
  details: UnitDetails | null;
  details_generated_at: string | null;
  practice: PracticeQuestion[] | null;
  practice_generated_at: string | null;
  quiz_size: number | null;          // questions in the unit's quiz bank
  quiz_generated_at: string | null;
  from_library: boolean;
}

export interface Curriculum {
  subject_id: number;
  framework: string | null;
  source: "syllabus" | "standards" | null;
  generated_at: string | null;
  shared: boolean;          // linked to the shared library for this student's category
  from_library: boolean;    // loaded from the shared library on this request (no AI call)
  units: CurriculumUnit[];
}

export type DeadlineType = "exam" | "assignment" | "essay" | "internship" | "project" | "other";

export interface Deadline {
  id: number;
  subject_id: number | null;
  title: string;
  deadline_type: DeadlineType;
  due_date: string;         // "YYYY-MM-DD"
  description: string | null;
  completed: boolean;
  created_at: string;
}

export interface Plan {
  content: string;
  start_date: string;
  end_date: string | null;
}

// --- Accounts ---

export interface User {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  is_admin: boolean;
}

export interface ConsentSummary {
  status: ConsentStatus;
  parent_email: string;
  requested_at: string;
  last_sent_at: string | null;
  expires_at: string;
  granted_at: string | null;
}

export interface Me {
  user: User;
  student: Student | null;
  consent: ConsentSummary | null;
  is_parent: boolean;
}

export interface ConsentInfo {
  status: ConsentStatus;
  expired: boolean;
  student_name: string;
  student_email: string;
  parent_email: string;
  consent_version: string;
}

export interface ParentChild {
  consent_id: number;
  student_name: string;
  student_email: string;
  consent_status: ConsentStatus;
  student_status: StudentStatus | null;
  granted_at: string | null;
  revoked_at: string | null;
}

export interface AdminConsent {
  status: ConsentStatus;
  parent_email: string;
  parent_full_name: string | null;
  relationship: string | null;
  consent_version: string | null;
  requested_at: string;
  granted_at: string | null;
  granted_ip: string | null;
  revoked_at: string | null;
}

export interface AdminStudent {
  id: number;
  name: string;
  email: string | null;
  age: number | null;
  grade: string | null;
  school: string | null;
  location: string;
  status: StudentStatus | null;
  status_note: string | null;
  status_changed_at: string | null;
  created_at: string;
  parent_name: string | null;
  parent_email: string | null;
  consent: AdminConsent | null;
}

// --- Quizzes & tests ---

export type AttemptKind = "quiz" | "test";

export interface AttemptQuestion {
  index: number;
  question: string;
  options: string[];
  difficulty: PracticeDifficulty;
  unit_title: string;
  // present once revealed (quiz: after answering; test: after submitting)
  your_answer: number | null;
  correct_answer: number | null;
  correct: boolean | null;
  explanation: string | null;
}

export interface Attempt {
  id: number;
  subject_id: number;
  kind: AttemptKind;
  unit_ids: number[];
  total: number;
  score: number | null;
  time_limit_minutes: number | null;
  started_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  timed_out: boolean;
  questions: AttemptQuestion[];
}

export interface AttemptSummary {
  id: number;
  kind: AttemptKind;
  unit_ids: number[];
  unit_titles: string[];
  score: number | null;
  total: number;
  percent: number | null;
  started_at: string;
  submitted_at: string | null;
  timed_out: boolean;
}

// --- Sample tests (mock exam papers) ---

export type SectionType = "mcq" | "short" | "long";

export interface SampleTestSummary {
  id: number;
  number: number;
  title: string;
  duration_minutes: number;
  total_marks: number;
  sections: { title: string; type: SectionType; questions: number; marks: number }[];
  attempts: number;
  best_percent: number | null;
  in_progress_attempt_id: number | null;
}

export interface SampleTestList {
  tests: SampleTestSummary[];
  can_generate: boolean;
  limit: number;
}

export interface STQuestion {
  id: string;
  type: SectionType;
  question: string;
  marks: number;
  options: string[] | null;
  your_answer: number | string | null;
  // revealed after submitting
  correct_answer: number | null;
  correct: boolean | null;
  explanation: string | null;
  model_answer: string | null;
  marking_points: { point: string; marks: number }[] | null;
  awarded: number | null;
}

export interface STSection {
  id: string;
  title: string;
  type: SectionType;
  instructions: string;
  marks: number;
  questions: STQuestion[];
}

export interface SampleTestAttempt {
  id: number;
  subject_id: number;
  unit_title: string;
  number: number;
  title: string;
  instructions: string;
  duration_minutes: number;
  total_marks: number;
  time_limit_minutes: number | null;
  started_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  marked_at: string | null;
  timed_out: boolean;
  mcq_score: number | null;
  mcq_marks: number;
  written_score: number | null;
  written_marks: number;
  total_score: number | null;
  sections: STSection[];
}

// --- College prep ---

export interface AthleticsPrefs {
  sport: string | null;
  team: "mens" | "womens" | "coed" | null;
  position_or_event: string | null;
  level: string | null;
  stats: string | null;
  wants_to_compete: boolean;
}

export type CollegePriority = "academics" | "aid" | "athletics" | "location" | "size";

export interface CollegePreferences {
  regions: string | null;
  size: "small" | "medium" | "large" | "any" | null;
  setting: "urban" | "suburban" | "rural" | "any" | null;
  need_aid: "yes" | "maybe" | "no" | null;
  budget_note: string | null;
  priorities: CollegePriority[];
  athletics: AthleticsPrefs | null;
}

export interface CollegeProfile {
  preferences?: CollegePreferences | null;
  intended_majors: string | null;
  interests: string | null;
  career_goals: string | null;
  gpa: string | null;
  test_scores: string | null;
  notes: string | null;
  updated_at?: string | null;
}

export interface GuideChapter {
  id: string;
  title: string;
  summary: string;
  body: string;            // markdown
  key_takeaways: string[];
}

export interface AdmissionsGuide {
  country: string;
  title: string;
  intro: string;
  chapters: GuideChapter[];
  generated_at: string;
}

export type RoadmapCategory = "academics" | "testing" | "activities" | "applications" | "finances" | "summer" | "wellbeing";

export interface RoadmapMilestone {
  id: string;
  title: string;
  detail: string;
  category: RoadmapCategory;
  completed_at: string | null;
}

export interface RoadmapStage {
  id: string;
  label: string;
  focus: string;
  goals: string[];
  milestones: RoadmapMilestone[];
}

export interface Roadmap {
  overview: string;
  stages: RoadmapStage[];
  generated_at: string;
  completed: number;
  total: number;
}

export type CollegeCategory = "reach" | "target" | "likely" | "undecided";

export interface CollegeSummary {
  recognized: boolean;
  official_name: string;
  location: string;
  type: string;
  overview: string;
  what_they_look_for: string[];
  typical_requirements: string[];
  testing_policy: string;
  application_options: string;
  selectivity: string;
  fit_for_student: string;
  next_steps: string[];
}

export interface CollegeEntry {
  id: number;
  name: string;
  category: CollegeCategory;
  notes: string | null;
  summary: CollegeSummary | null;
  summary_generated_at: string | null;
  created_at: string;
}

export type AchievementCategory =
  | "extracurricular" | "leadership" | "award" | "volunteer" | "work" | "summer" | "research" | "arts" | "athletics" | "other";

export interface Achievement {
  id: number;
  title: string;
  category: AchievementCategory;
  organization: string | null;
  role: string | null;
  grades: string | null;
  hours_per_week: number | null;
  weeks_per_year: number | null;
  description: string | null;
  created_at: string;
}

export interface RecommendedCollege {
  name: string;
  location: string;
  fit_category: "reach" | "target" | "likely";
  why: string;
  division: string;
  athletics_note: string;
  aid_note: string;
  academic_note: string;
}

export interface RecommendationGroup {
  key: "athletics" | "aid" | "academics";
  title: string;
  intro: string;
  colleges: RecommendedCollege[];
}

export interface Recommendations {
  summary: string;
  athletic_levels: { division: string; fit: "strong" | "possible" | "stretch"; why: string }[];
  groups: RecommendationGroup[];
  next_steps: string[];
  removed_by_check: number;
  generated_at: string;
}
