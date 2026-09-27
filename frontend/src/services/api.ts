import axios from "axios";
import type {
  Student,
  Activity,
  Subject,
  Plan,
  Deadline,
  Curriculum,
  CurriculumUnit,
  Me,
  ConsentInfo,
  ParentChild,
  AdminStudent,
  StudentStatus,
  Attempt,
  AttemptQuestion,
  AttemptSummary,
} from "../types";

// Same-origin "/api" (the dev server proxies it to the backend), so the session cookie always applies.
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
  withCredentials: true,
  // Required by the backend's CSRF guard on state-changing requests
  headers: { "X-Requested-With": "XMLHttpRequest" },
});

/** Called when any request comes back 401 (session expired / signed out elsewhere). */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };
api.interceptors.response.use(undefined, (err) => {
  if (err?.response?.status === 401 && !String(err.config?.url).startsWith("/auth/")) onUnauthorized?.();
  return Promise.reject(err);
});

// --- Accounts ---
export const authApi = {
  config: () => api.get<{ google_client_id: string; consent_version: string }>("/auth/config").then((r) => r.data),
  /** Returns null when not signed in. */
  me: () =>
    api.get<Me>("/auth/me").then((r) => r.data).catch((err) => {
      if (err.response?.status === 401) return null;
      throw err;
    }),
  signInWithGoogle: (credential: string) => api.post<Me>("/auth/google", { credential }).then((r) => r.data),
  logout: () => api.post("/auth/logout"),
};

export interface SignupInput {
  name: string; age?: number | null; school?: string | null; grade?: string | null;
  county?: string | null; state?: string | null; country?: string | null;
  parent_name: string; parent_email: string;
}

export const onboardingApi = {
  submit: (data: SignupInput) => api.post<Me>("/onboarding", data).then((r) => r.data),
  changeParent: (data: { parent_name: string; parent_email: string }) =>
    api.put<Me>("/onboarding/parent", data).then((r) => r.data),
  resendConsent: () => api.post<Me>("/onboarding/resend-consent").then((r) => r.data),
};

export const consentApi = {
  info: (token: string) => api.get<ConsentInfo>(`/consent/${encodeURIComponent(token)}`).then((r) => r.data),
  grant: (token: string, data: { parent_full_name: string; relationship: string; agree: boolean }) =>
    api.post<ConsentInfo>(`/consent/${encodeURIComponent(token)}/grant`, data).then((r) => r.data),
  decline: (token: string) =>
    api.post<ConsentInfo>(`/consent/${encodeURIComponent(token)}/decline`).then((r) => r.data),
};

export const parentApi = {
  children: () => api.get<ParentChild[]>("/parent/children").then((r) => r.data),
  revoke: (consentId: number) =>
    api.post<ParentChild>(`/parent/consents/${consentId}/revoke`).then((r) => r.data),
};

export type AdminAction = "approve" | "reject" | "suspend" | "reinstate";
export const adminApi = {
  students: (status?: StudentStatus) =>
    api.get<AdminStudent[]>("/admin/students", { params: status ? { status } : {} }).then((r) => r.data),
  act: (studentId: number, action: AdminAction, note?: string) =>
    api.post<AdminStudent>(`/admin/students/${studentId}/${action}`, { note: note || null }).then((r) => r.data),
};

export type StudentProfileInput = Partial<Omit<Student, "id" | "created_at">> & { name: string };

// --- Student profile (approved students) ---
export const studentApi = {
  save: (data: StudentProfileInput) => api.put<Student>("/student", data).then((r) => r.data),
  update: (data: Partial<Student>) => api.patch<Student>("/student", data).then((r) => r.data),
};

// --- Activities ---
export const activityApi = {
  list: () => api.get<Activity[]>("/activities").then((r) => r.data),
  create: (data: Partial<Activity> & { title: string }) =>
    api.post<Activity>("/activities", data).then((r) => r.data),
  update: (activityId: number, data: Partial<Activity>) =>
    api.patch<Activity>(`/activities/${activityId}`, data).then((r) => r.data),
  delete: (activityId: number) => api.delete(`/activities/${activityId}`),
};

// --- Subjects ---
export const subjectApi = {
  list: () => api.get<Subject[]>("/subjects").then((r) => r.data),
  get: (subjectId: number) => api.get<Subject>(`/subjects/${subjectId}`).then((r) => r.data),
  create: (data: Partial<Subject> & { name: string }) =>
    api.post<Subject>("/subjects", data).then((r) => r.data),
  update: (subjectId: number, data: Partial<Subject>) =>
    api.patch<Subject>(`/subjects/${subjectId}`, data).then((r) => r.data),
  delete: (subjectId: number) => api.delete(`/subjects/${subjectId}`),
};

// --- Curriculum (per subject) ---
export const curriculumApi = {
  get: (subjectId: number) =>
    api.get<Curriculum>(`/subjects/${subjectId}/curriculum`).then((r) => r.data),
  /** force=true regenerates with AI and replaces the shared copy; otherwise the shared library is used when possible. */
  generate: (subjectId: number, force = false) =>
    api
      .post<Curriculum>(`/subjects/${subjectId}/curriculum/generate`, null, { params: { force } })
      .then((r) => r.data),
  generateUnitDetails: (subjectId: number, unitId: number, force = false) =>
    api
      .post<CurriculumUnit>(`/subjects/${subjectId}/curriculum/units/${unitId}/details`, null, { params: { force } })
      .then((r) => r.data),
  generateUnitPractice: (subjectId: number, unitId: number, force = false) =>
    api
      .post<CurriculumUnit>(`/subjects/${subjectId}/curriculum/units/${unitId}/practice`, null, { params: { force } })
      .then((r) => r.data),
};

// --- Quizzes & tests ---
export const quizApi = {
  /** Build (or with force, regenerate for everyone in the category) a unit's question bank. */
  prepareUnit: (subjectId: number, unitId: number, force = false) =>
    api
      .post<CurriculumUnit>(`/subjects/${subjectId}/curriculum/units/${unitId}/quiz`, null, { params: { force } })
      .then((r) => r.data),
  startQuiz: (subjectId: number, unitId: number) =>
    api.post<Attempt>(`/subjects/${subjectId}/attempts`, { kind: "quiz", unit_id: unitId }).then((r) => r.data),
  startTest: (subjectId: number, opts: { unit_ids: number[] | null; count: number; time_limit_minutes: number | null }) =>
    api.post<Attempt>(`/subjects/${subjectId}/attempts`, { kind: "test", ...opts }).then((r) => r.data),
  get: (attemptId: number) => api.get<Attempt>(`/attempts/${attemptId}`).then((r) => r.data),
  answer: (attemptId: number, index: number, choice: number) =>
    api.post<AttemptQuestion>(`/attempts/${attemptId}/answer`, { index, choice }).then((r) => r.data),
  submit: (attemptId: number, answers?: (number | null)[]) =>
    api.post<Attempt>(`/attempts/${attemptId}/submit`, answers ? { answers } : {}).then((r) => r.data),
  history: (subjectId: number) =>
    api.get<AttemptSummary[]>(`/subjects/${subjectId}/attempts`).then((r) => r.data),
};

/** Human-readable message from an API error (server `detail` when present). */
export const apiErrorMessage = (err: any, fallback = "Something went wrong. Please try again.") =>
  err?.response?.data?.detail ?? (err?.response ? fallback : "Can't reach the server. Is the backend running?");

// --- Deadlines ---
export const deadlineApi = {
  list: () => api.get<Deadline[]>("/deadlines").then((r) => r.data),
  create: (data: Partial<Deadline> & { title: string; due_date: string }) =>
    api.post<Deadline>("/deadlines", data).then((r) => r.data),
  update: (deadlineId: number, data: Partial<Deadline>) =>
    api.patch<Deadline>(`/deadlines/${deadlineId}`, data).then((r) => r.data),
  delete: (deadlineId: number) => api.delete(`/deadlines/${deadlineId}`),
  generateReminders: () =>
    api.post<{ content: string }>("/deadlines/reminders").then((r) => r.data),
};

// --- AI Schedule ---
export const scheduleApi = {
  generate: (data: {
    start_date: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    location?: string;
    relax_time_per_day_minutes?: number;
    include_study_sessions?: boolean;
    custom_prompt?: string;
    additional_notes?: string;
  }) => api.post<Plan>("/schedule/generate", data).then((r) => r.data),
};

export default api;
