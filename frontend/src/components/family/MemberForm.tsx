import React, { useState } from "react";
import type { FamilyMember, MemberRole } from "../../types";

const COLORS = [
  "#4F46E5", "#7C3AED", "#DB2777", "#DC2626",
  "#D97706", "#059669", "#0284C7", "#0891B2",
];

interface Props {
  initial?: Partial<FamilyMember>;
  onSubmit: (data: Partial<FamilyMember> & { name: string }) => Promise<void>;
  onCancel: () => void;
}

export const MemberForm: React.FC<Props> = ({ initial = {}, onSubmit, onCancel }) => {
  const [form, setForm] = useState({
    name: initial.name ?? "",
    role: (initial.role ?? "parent") as MemberRole,
    age: initial.age?.toString() ?? "",
    school: initial.school ?? "",
    grade: initial.grade ?? "",
    color: initial.color ?? COLORS[0],
  });
  const [loading, setLoading] = useState(false);

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        ...form,
        age: form.age ? parseInt(form.age) : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g., Sarah"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
          >
            <option value="parent">Parent</option>
            <option value="student">Student</option>
            <option value="guardian">Guardian</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
          <input
            type="number"
            min={1}
            max={120}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.age}
            onChange={(e) => set("age", e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      {form.role === "student" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.school}
              onChange={(e) => set("school", e.target.value)}
              placeholder="School name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.grade}
              onChange={(e) => set("grade", e.target.value)}
              placeholder="e.g., 8th Grade"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Calendar Color</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set("color", c)}
              className={`w-7 h-7 rounded-full transition-transform ${
                form.color === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Saving..." : "Save Member"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
