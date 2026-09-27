import { create } from "zustand";
import type { Me, Student } from "../types";

interface AppState {
  /** Signed-in account (null = signed out). */
  me: Me | null;
  /** The signed-in student's profile — kept in sync with me.student. */
  student: Student | null;
  /** True once the session check has finished. */
  loaded: boolean;
  setMe: (me: Me | null) => void;
  setStudent: (student: Student | null) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  me: null,
  student: null,
  loaded: false,
  setMe: (me) => set({ me, student: me?.student ?? null, loaded: true }),
  setStudent: (student) => set((s) => ({ student, me: s.me && { ...s.me, student } })),
}));
