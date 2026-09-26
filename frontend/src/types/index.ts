export type MemberRole = "parent" | "student" | "guardian";
export type ActivityType = "school" | "sports" | "family" | "medical" | "hobby" | "other";
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

export interface Family {
  id: number;
  name: string;
  timezone: string;
  created_at: string;
}

export interface FamilyMember {
  id: number;
  family_id: number;
  name: string;
  role: MemberRole;
  age: number | null;
  school: string | null;
  grade: string | null;
  color: string;
  avatar_initials: string;
  default_prompt: string | null;
}

export interface Activity {
  id: number;
  member_id: number;
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
  synced_to_calendar: boolean;
}

export type SubjectDifficulty = "easy" | "medium" | "hard";
export type HomeworkFrequency = "daily" | "alternate" | "weekly" | "as_needed";

export interface Subject {
  id: number;
  member_id: number;
  name: string;
  teacher: string | null;
  difficulty: SubjectDifficulty;
  homework_frequency: HomeworkFrequency;
  homework_duration_minutes: number;
  class_days: string | null;
  exam_date: string | null;
  notes: string | null;
}

export type DeadlineType = "exam" | "assignment" | "essay" | "internship" | "project" | "other";

export interface Deadline {
  id: number;
  member_id: number;
  subject_id: number | null;
  title: string;
  deadline_type: DeadlineType;
  due_date: string;         // "YYYY-MM-DD"
  description: string | null;
  completed: boolean;
  created_at: string;
}

export interface StudyPlan {
  id: number;
  member_id: number;
  week_start: string;
  content: string;
  created_at: string;
}

export interface GeneratedSchedule {
  id: number;
  family_id: number;
  member_id: number | null;
  schedule_date: string;
  schedule_end_date: string | null;
  schedule_start_time: string | null;
  schedule_end_time: string | null;
  location: string | null;
  is_family_wide: boolean;
  content: string;
  custom_prompt: string | null;
  created_at: string;
}

export interface UnifiedPlan {
  content: string;
  start_date: string;
  end_date: string | null;
  family_id: number;
}

export interface Report {
  report_type: string;
  report_date: string;
  family_id: number;
  member_id: number | null;
  content: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}

// --- Pantry + Weekly Meal Plan ---

export type MealType =
  | "breakfast"
  | "morning_snack"
  | "lunch"
  | "afternoon_snack"
  | "evening_snack"
  | "dinner"
  | "bedtime_drink";

export interface PantryItem {
  id: number;
  family_id: number;
  name: string;
  category: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
  created_at: string;
}

export interface MealSlot {
  id: number;
  family_id: number;
  meal_type: MealType;
  time: string;        // "HH:MM:SS"
  sort_order: number;
}

export interface MealPlanItem {
  id: number;
  family_id: number;
  meal_type: MealType;
  day_of_week: number;         // 0 = Monday ... 6 = Sunday
  name: string;
  pantry_item_id: number | null;
  member_id: number | null;    // null = whole family
  time: string | null;         // per-item override "HH:MM:SS"
  quantity: string | null;     // portion text, e.g. "1 bowl"
  notes: string | null;
  sort_order: number;
}

export interface MealPlan {
  slots: MealSlot[];
  items: MealPlanItem[];
}
