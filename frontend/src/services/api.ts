import axios from "axios";
import type {
  Student,
  Activity,
  Subject,
  Plan,
  Deadline,
  Curriculum,
  CurriculumUnit,
} from "../types";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8000/api",
});

export type StudentProfileInput = Partial<Omit<Student, "id" | "created_at">> & { name: string };

// --- Student profile ---
export const studentApi = {
  /** Returns null when the profile has not been set up yet. */
  get: () =>
    api
      .get<Student>("/student")
      .then((r) => r.data)
      .catch((err) => {
        if (err.response?.status === 404) return null;
        throw err;
      }),
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
