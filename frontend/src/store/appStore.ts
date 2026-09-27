import { create } from "zustand";
import type { Student } from "../types";

interface AppState {
  student: Student | null;
  /** True once the profile fetch has finished (student may still be null). */
  loaded: boolean;
  setStudent: (student: Student | null) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  student: null,
  loaded: false,
  setStudent: (student) => set({ student, loaded: true }),
}));
