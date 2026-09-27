export type ActivityType = "school" | "sports" | "medical" | "hobby" | "other";
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

export interface Student {
  id: number;
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
