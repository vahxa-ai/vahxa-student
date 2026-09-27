import React, { useState } from "react";
import type { Student } from "../../types";
import type { StudentProfileInput } from "../../services/api";

interface Props {
  initial?: Partial<Student> | null;
  submitLabel: string;
  onSubmit: (data: StudentProfileInput) => Promise<void>;
  onCancel?: () => void;
}

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

export const ProfileForm: React.FC<Props> = ({ initial, submitLabel, onSubmit, onCancel }) => {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    age: initial?.age?.toString() ?? "",
    school: initial?.school ?? "",
    grade: initial?.grade ?? "",
    county: initial?.county ?? "",
    state: initial?.state ?? "",
    country: initial?.country ?? "",
  });
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        age: form.age ? parseInt(form.age) : null,
        school: form.school.trim() || null,
        grade: form.grade.trim() || null,
        county: form.county.trim() || null,
        state: form.state.trim() || null,
        country: form.country.trim() || null,
        timezone: initial?.timezone,
        default_prompt: initial?.default_prompt ?? null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            required autoFocus
            className={inputCls}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g., Sarah"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
          <input
            type="number" min={1} max={120}
            className={inputCls}
            value={form.age}
            onChange={(e) => set("age", e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
          <input
            className={inputCls}
            value={form.school}
            onChange={(e) => set("school", e.target.value)}
            placeholder="School name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
          <input
            className={inputCls}
            value={form.grade}
            onChange={(e) => set("grade", e.target.value)}
            placeholder="e.g., 8th Grade"
          />
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">County / District</label>
            <input
              className={inputCls}
              value={form.county}
              onChange={(e) => set("county", e.target.value)}
              placeholder="e.g., Travis County"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State / Province</label>
            <input
              className={inputCls}
              value={form.state}
              onChange={(e) => set("state", e.target.value)}
              placeholder="e.g., Texas"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <input
              className={inputCls}
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              placeholder="e.g., USA"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Used to match your subjects to the right curriculum standards.</p>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};
