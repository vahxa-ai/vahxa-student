import axios from "axios";
import type {
  Family,
  FamilyMember,
  Activity,
  Subject,
  StudyPlan,
  GeneratedSchedule,
  UnifiedPlan,
  Report,
  CalendarEvent,
  Deadline,
  PantryItem,
  MealPlan,
  MealPlanItem,
  MealType,
} from "../types";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8000/api",
});

// --- Families ---
export const familyApi = {
  list: () => api.get<Family[]>("/families").then((r) => r.data),
  create: (data: { name: string; timezone?: string }) =>
    api.post<Family>("/families", data).then((r) => r.data),
  get: (id: number) => api.get<Family>(`/families/${id}`).then((r) => r.data),
  delete: (id: number) => api.delete(`/families/${id}`),
};

// --- Members ---
export const memberApi = {
  list: (familyId: number) =>
    api.get<FamilyMember[]>(`/families/${familyId}/members`).then((r) => r.data),
  create: (
    familyId: number,
    data: Partial<FamilyMember> & { name: string }
  ) =>
    api.post<FamilyMember>(`/families/${familyId}/members`, data).then((r) => r.data),
  update: (familyId: number, memberId: number, data: Partial<FamilyMember>) =>
    api
      .patch<FamilyMember>(`/families/${familyId}/members/${memberId}`, data)
      .then((r) => r.data),
  delete: (familyId: number, memberId: number) =>
    api.delete(`/families/${familyId}/members/${memberId}`),
};

// --- Activities ---
export const activityApi = {
  list: (memberId: number) =>
    api.get<Activity[]>(`/members/${memberId}/activities`).then((r) => r.data),
  create: (memberId: number, data: Partial<Activity> & { title: string }) =>
    api.post<Activity>(`/members/${memberId}/activities`, data).then((r) => r.data),
  update: (memberId: number, activityId: number, data: Partial<Activity>) =>
    api
      .patch<Activity>(`/members/${memberId}/activities/${activityId}`, data)
      .then((r) => r.data),
  delete: (memberId: number, activityId: number) =>
    api.delete(`/members/${memberId}/activities/${activityId}`),
};

// --- Subjects ---
export const subjectApi = {
  list: (memberId: number) =>
    api.get<Subject[]>(`/members/${memberId}/subjects`).then((r) => r.data),
  create: (memberId: number, data: Partial<Subject> & { name: string }) =>
    api.post<Subject>(`/members/${memberId}/subjects`, data).then((r) => r.data),
  update: (memberId: number, subjectId: number, data: Partial<Subject>) =>
    api.patch<Subject>(`/members/${memberId}/subjects/${subjectId}`, data).then((r) => r.data),
  delete: (memberId: number, subjectId: number) =>
    api.delete(`/members/${memberId}/subjects/${subjectId}`),
};

// --- Deadlines ---
export const deadlineApi = {
  list: (memberId: number) =>
    api.get<Deadline[]>(`/members/${memberId}/deadlines`).then((r) => r.data),
  create: (memberId: number, data: Partial<Deadline> & { title: string; due_date: string }) =>
    api.post<Deadline>(`/members/${memberId}/deadlines`, data).then((r) => r.data),
  update: (memberId: number, deadlineId: number, data: Partial<Deadline>) =>
    api.patch<Deadline>(`/members/${memberId}/deadlines/${deadlineId}`, data).then((r) => r.data),
  delete: (memberId: number, deadlineId: number) =>
    api.delete(`/members/${memberId}/deadlines/${deadlineId}`),
  generateReminders: (memberId: number) =>
    api.post<{ content: string }>(`/members/${memberId}/deadlines/reminders`).then((r) => r.data),
};

// --- Study Plans ---
export const studyPlanApi = {
  generate: (data: {
    member_id: number;
    week_start: string;
    relax_time_per_day_minutes?: number;
    additional_notes?: string;
  }) => api.post<StudyPlan>("/study-plans/generate", data).then((r) => r.data),
  listForMember: (memberId: number) =>
    api.get<StudyPlan[]>(`/study-plans/member/${memberId}`).then((r) => r.data),
};

// --- Schedules ---
export const scheduleApi = {
  generate: (data: {
    family_id: number;
    schedule_date: string;
    schedule_end_date?: string;
    start_time?: string;
    end_time?: string;
    location?: string;
    member_id?: number;
    additional_notes?: string;
    custom_prompt?: string;
  }) => api.post<GeneratedSchedule>("/schedules/generate", data).then((r) => r.data),
  generateUnified: (data: {
    family_id: number;
    start_date: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    location?: string;
    member_id?: number;
    relax_time_per_day_minutes?: number;
    include_study_sessions?: boolean;
    custom_prompt?: string;
    additional_notes?: string;
  }) => api.post<UnifiedPlan>("/schedules/unified", data).then((r) => r.data),
  generateReport: (data: {
    family_id: number;
    report_date: string;
    report_type: "daily" | "weekly";
    member_id?: number;
  }) => api.post<Report>("/schedules/report", data).then((r) => r.data),
  listForFamily: (familyId: number) =>
    api.get<GeneratedSchedule[]>(`/schedules/family/${familyId}`).then((r) => r.data),
  listForMember: (memberId: number) =>
    api.get<GeneratedSchedule[]>(`/schedules/member/${memberId}`).then((r) => r.data),
};

// --- Calendar ---
export const calendarApi = {
  status: (familyId: number) =>
    api.get<{ connected: boolean }>(`/calendar/status/${familyId}`).then((r) => r.data),
  startOAuth: (familyId: number) =>
    api
      .get<{ auth_url: string; state: string }>(`/calendar/oauth/start?family_id=${familyId}`)
      .then((r) => r.data),
  syncMember: (familyId: number, memberId: number) =>
    api
      .post<{ synced: number; total: number }>(`/calendar/sync/${familyId}/member/${memberId}`)
      .then((r) => r.data),
  getEvents: (familyId: number, daysAhead = 7) =>
    api
      .get<CalendarEvent[]>(`/calendar/events/${familyId}?days_ahead=${daysAhead}`)
      .then((r) => r.data),
};

// --- Pantry (inventory) ---
export const pantryApi = {
  list: (familyId: number) =>
    api.get<PantryItem[]>(`/families/${familyId}/pantry`).then((r) => r.data),
  create: (familyId: number, data: Partial<PantryItem> & { name: string }) =>
    api.post<PantryItem>(`/families/${familyId}/pantry`, data).then((r) => r.data),
  update: (familyId: number, itemId: number, data: Partial<PantryItem>) =>
    api.patch<PantryItem>(`/families/${familyId}/pantry/${itemId}`, data).then((r) => r.data),
  delete: (familyId: number, itemId: number) =>
    api.delete(`/families/${familyId}/pantry/${itemId}`),
};

// --- Weekly Meal Plan ---
export const mealPlanApi = {
  get: (familyId: number) =>
    api.get<MealPlan>(`/families/${familyId}/meal-plan`).then((r) => r.data),
  updateSlot: (familyId: number, mealType: MealType, data: { time: string }) =>
    api.patch<MealPlan>(`/families/${familyId}/meal-plan/slots/${mealType}`, data).then((r) => r.data),
  createItem: (
    familyId: number,
    data: {
      meal_type: MealType;
      day_of_week: number;
      name: string;
      pantry_item_id?: number | null;
      member_id?: number | null;
      time?: string | null;
      quantity?: string | null;
      notes?: string | null;
    }
  ) => api.post<MealPlanItem>(`/families/${familyId}/meal-plan/items`, data).then((r) => r.data),
  updateItem: (familyId: number, itemId: number, data: Partial<MealPlanItem>) =>
    api.patch<MealPlanItem>(`/families/${familyId}/meal-plan/items/${itemId}`, data).then((r) => r.data),
  deleteItem: (familyId: number, itemId: number) =>
    api.delete(`/families/${familyId}/meal-plan/items/${itemId}`),
};

// --- Health Advice ---
export const healthApi = {
  shoppingAdvice: (data: {
    history: { name: string; category: string; purchased_at: string }[];
    family_name?: string;
  }) => api.post<{ content: string }>("/health/shopping-advice", data).then((r) => r.data),
  storeRecommendations: (data: {
    items: { name: string; category: string }[];
    family_name?: string;
  }) => api.post<{ content: string }>("/health/store-recommendations", data).then((r) => r.data),
};

export default api;
