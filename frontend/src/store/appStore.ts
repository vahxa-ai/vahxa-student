import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Family, FamilyMember } from "../types";

interface AppState {
  activeFamilyId: number | null;
  families: Family[];
  members: FamilyMember[];
  setActiveFamilyId: (id: number | null) => void;
  setFamilies: (families: Family[]) => void;
  setMembers: (members: FamilyMember[]) => void;
  activeFamily: () => Family | null;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeFamilyId: null,
      families: [],
      members: [],
      setActiveFamilyId: (id) => set({ activeFamilyId: id }),
      setFamilies: (families) => set({ families }),
      setMembers: (members) => set({ members }),
      activeFamily: () => {
        const { activeFamilyId, families } = get();
        return families.find((f) => f.id === activeFamilyId) ?? null;
      },
    }),
    { name: "family-aid-store" }
  )
);
