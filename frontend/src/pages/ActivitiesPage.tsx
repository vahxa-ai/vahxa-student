import React, { useEffect, useRef, useState } from "react";
import {
  Plus, X, Calendar, Clock, MapPin, Repeat, Star,
  ChevronDown, Loader2, Check, Pencil, Sun, BookOpen,
  Sunset, Moon,
} from "lucide-react";
import { useAppStore } from "../store/appStore";
import { activityApi, memberApi } from "../services/api";
import type { Activity, ActivityType, FamilyMember, RecurrenceType } from "../types";

const TYPE_COLORS: Record<ActivityType, string> = {
  school:  "bg-blue-100 text-blue-700",
  sports:  "bg-indigo-100 text-indigo-700",
  family:  "bg-pink-100 text-pink-700",
  medical: "bg-red-100 text-red-700",
  hobby:   "bg-yellow-100 text-yellow-700",
  other:   "bg-gray-100 text-gray-600",
};

// ─── Time Section types ────────────────────────────────────────────────────────

interface TimeActivity { id: string; text: string }

interface TimeSection {
  key: string;
  label: string;
  startTime: string; // "HH:MM" 24h
  endTime: string;
  activities: TimeActivity[];
}

const uid = () => Math.random().toString(36).slice(2, 9);

const defaultSections = (role: string): TimeSection[] => {
  const isStudent = role === "student";
  return [
    {
      key: "morning",
      label: "Morning",
      startTime: "06:00",
      endTime: "08:30",
      activities: [
        { id: uid(), text: "Wake up & freshen up" },
        { id: uid(), text: "Breakfast" },
        { id: uid(), text: isStudent ? "Pack school bag" : "Prepare for work" },
      ],
    },
    {
      key: "school",
      label: isStudent ? "School Time" : "Office / Work",
      startTime: "08:30",
      endTime: isStudent ? "15:30" : "17:30",
      activities: isStudent
        ? [{ id: uid(), text: "Attend classes" }, { id: uid(), text: "Lunch break (12:30 PM)" }]
        : [{ id: uid(), text: "Work / office hours" }, { id: uid(), text: "Lunch break (1:00 PM)" }],
    },
    {
      key: "afterschool",
      label: isStudent ? "After School" : "After Work",
      startTime: isStudent ? "15:30" : "17:30",
      endTime: "18:00",
      activities: isStudent
        ? [
            { id: uid(), text: "Snack & rest" },
            { id: uid(), text: "Homework (45 min blocks)" },
            { id: uid(), text: "Sports / outdoor play" },
          ]
        : [
            { id: uid(), text: "Commute home" },
            { id: uid(), text: "Exercise / walk" },
          ],
    },
    {
      key: "evening",
      label: "Evening",
      startTime: "18:00",
      endTime: isStudent ? "21:30" : "22:00",
      activities: [
        { id: uid(), text: "Family dinner" },
        { id: uid(), text: "Wind-down / reading" },
        { id: uid(), text: isStudent ? "Bedtime by 9:30 PM" : "Bedtime by 10:30 PM" },
      ],
    },
  ];
};

// Format "HH:MM" → "H:MM AM/PM"
const fmt12 = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
};

// Sections → prompt string the AI reads
const sectionsToPrompt = (sections: TimeSection[]): string =>
  sections
    .map((s) => {
      const lines = s.activities
        .filter((a) => a.text.trim())
        .map((a) => `- ${a.text.trim()}`)
        .join("\n");
      return `## ${s.label} (${fmt12(s.startTime)} – ${fmt12(s.endTime)})\n${lines || "- (none)"}`;
    })
    .join("\n\n");

// Parse saved prompt back to sections; returns null if format doesn't match
const promptToSections = (prompt: string): TimeSection[] | null => {
  const to24 = (t: string) => {
    const [timePart, ampm] = t.split(" ");
    const [h, m] = timePart.split(":").map(Number);
    const h24 = ampm === "PM" && h !== 12 ? h + 12 : ampm === "AM" && h === 12 ? 0 : h;
    return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  const timeRe = /^(.+?) \((\d{1,2}:\d{2} [AP]M) – (\d{1,2}:\d{2} [AP]M)\)/;
  const KEY_MAP: Record<string, string> = {
    morning: "morning", school: "school", office: "school",
    work: "school", "after school": "afterschool", "after work": "afterschool",
    evening: "evening",
  };
  const blocks = prompt.split(/^## /m).filter(Boolean);
  if (blocks.length < 2) return null;
  const sections: TimeSection[] = [];
  for (const block of blocks) {
    const m = block.match(timeRe);
    if (!m) return null;
    const [, label, s, e] = m;
    const activities = block
      .slice(m[0].length)
      .split("\n")
      .filter((l) => l.startsWith("- "))
      .map((l) => ({ id: uid(), text: l.slice(2).trim() }))
      .filter((a) => a.text && a.text !== "(none)");
    const lk = Object.entries(KEY_MAP).find(([k]) => label.toLowerCase().includes(k));
    sections.push({ key: lk?.[1] ?? label.toLowerCase().replace(/\s+/g, ""), label, startTime: to24(s), endTime: to24(e), activities });
  }
  return sections.length >= 2 ? sections : null;
};

// ─── Section config (icon + colours) ──────────────────────────────────────────

const SECTION_STYLE: Record<string, { Icon: React.ElementType; bg: string; border: string; headerBg: string; accent: string }> = {
  morning:    { Icon: Sun,     bg: "bg-amber-50",  border: "border-amber-200",  headerBg: "bg-amber-100",  accent: "text-amber-600"  },
  school:     { Icon: BookOpen,bg: "bg-blue-50",   border: "border-blue-200",   headerBg: "bg-blue-100",   accent: "text-blue-600"   },
  afterschool:{ Icon: Sunset,  bg: "bg-violet-50", border: "border-violet-200", headerBg: "bg-violet-100", accent: "text-violet-600" },
  evening:    { Icon: Moon,    bg: "bg-indigo-50", border: "border-indigo-200", headerBg: "bg-indigo-100", accent: "text-indigo-600" },
};
const fallbackStyle = { Icon: Clock, bg: "bg-gray-50", border: "border-gray-200", headerBg: "bg-gray-100", accent: "text-gray-600" };

// ─── Member Defaults Panel ─────────────────────────────────────────────────────

const MemberDefaultsPanel: React.FC<{
  members: FamilyMember[];
  activeFamilyId: number;
  onSaved: (updated: FamilyMember) => void;
}> = ({ members, activeFamilyId, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [memberSections, setMemberSections] = useState<Record<number, TimeSection[]>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const newActivityRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getSections = (member: FamilyMember): TimeSection[] => {
    if (memberSections[member.id]) return memberSections[member.id];
    if (member.default_prompt) {
      const parsed = promptToSections(member.default_prompt);
      if (parsed) return parsed;
    }
    return defaultSections(member.role);
  };

  const expandMember = (member: FamilyMember) => {
    const id = member.id;
    if (expandedId === id) { setExpandedId(null); return; }
    if (!memberSections[id]) {
      setMemberSections((prev) => ({ ...prev, [id]: getSections(member) }));
    }
    setExpandedId(id);
  };

  const updateSection = (memberId: number, sectionKey: string, patch: Partial<TimeSection>) => {
    setMemberSections((prev) => ({
      ...prev,
      [memberId]: (prev[memberId] ?? []).map((s) =>
        s.key === sectionKey ? { ...s, ...patch } : s
      ),
    }));
  };

  const addActivity = (memberId: number, sectionKey: string) => {
    const newAct: TimeActivity = { id: uid(), text: "" };
    setMemberSections((prev) => ({
      ...prev,
      [memberId]: (prev[memberId] ?? []).map((s) =>
        s.key === sectionKey ? { ...s, activities: [...s.activities, newAct] } : s
      ),
    }));
    setTimeout(() => newActivityRefs.current[newAct.id]?.focus(), 50);
  };

  const updateActivity = (memberId: number, sectionKey: string, actId: string, text: string) => {
    setMemberSections((prev) => ({
      ...prev,
      [memberId]: (prev[memberId] ?? []).map((s) =>
        s.key === sectionKey
          ? { ...s, activities: s.activities.map((a) => a.id === actId ? { ...a, text } : a) }
          : s
      ),
    }));
  };

  const removeActivity = (memberId: number, sectionKey: string, actId: string) => {
    setMemberSections((prev) => ({
      ...prev,
      [memberId]: (prev[memberId] ?? []).map((s) =>
        s.key === sectionKey
          ? { ...s, activities: s.activities.filter((a) => a.id !== actId) }
          : s
      ),
    }));
  };

  const handleSave = async (member: FamilyMember) => {
    const sections = memberSections[member.id] ?? getSections(member);
    const prompt = sectionsToPrompt(sections);
    setSaving(member.id);
    try {
      const updated = await memberApi.update(activeFamilyId, member.id, { default_prompt: prompt });
      onSaved(updated);
      setSaved(member.id);
      setTimeout(() => setSaved(null), 2000);
    } finally {
      setSaving(null);
    }
  };

  const handleReset = (member: FamilyMember) => {
    setMemberSections((prev) => ({ ...prev, [member.id]: defaultSections(member.role) }));
  };

  return (
    <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clock size={15} className="text-indigo-500" />
          Daily Schedule Templates
          <span className="text-xs font-normal text-gray-400 ml-1">
            — set timeframes &amp; activities per member used when generating plans
          </span>
        </span>
        <ChevronDown size={15} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          {members.map((member) => {
            const isExpanded = expandedId === member.id;
            const sections = memberSections[member.id] ?? [];

            return (
              <div key={member.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Member row */}
                <button
                  type="button"
                  onClick={() => expandMember(member)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0"
                      style={{ backgroundColor: member.color }}
                    >
                      {member.avatar_initials[0]}
                    </div>
                    <span className="text-sm font-medium text-gray-800">{member.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 capitalize">
                      {member.role}
                    </span>
                    {member.default_prompt && (
                      <span className="text-xs text-indigo-500 font-medium">• saved</span>
                    )}
                  </div>
                  <ChevronDown size={13} className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>

                {/* Sections editor */}
                {isExpanded && (
                  <div className="p-4">
                    <div className="grid sm:grid-cols-2 gap-3 mb-4">
                      {sections.map((section) => {
                        const style = SECTION_STYLE[section.key] ?? fallbackStyle;
                        const { Icon } = style;
                        return (
                          <div
                            key={section.key}
                            className={`rounded-xl border ${style.border} ${style.bg} overflow-hidden`}
                          >
                            {/* Section header */}
                            <div className={`${style.headerBg} px-3 py-2.5 flex items-center gap-2`}>
                              <Icon size={14} className={style.accent} />
                              <span className={`text-xs font-semibold ${style.accent} flex-1`}>
                                {section.label}
                              </span>
                              {/* Time range inputs */}
                              <div className="flex items-center gap-1">
                                <input
                                  type="time"
                                  value={section.startTime}
                                  onChange={(e) =>
                                    updateSection(member.id, section.key, { startTime: e.target.value })
                                  }
                                  className="text-xs border-0 bg-white/70 rounded px-1 py-0.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-300 w-20"
                                />
                                <span className="text-xs text-gray-400">–</span>
                                <input
                                  type="time"
                                  value={section.endTime}
                                  onChange={(e) =>
                                    updateSection(member.id, section.key, { endTime: e.target.value })
                                  }
                                  className="text-xs border-0 bg-white/70 rounded px-1 py-0.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-300 w-20"
                                />
                              </div>
                            </div>

                            {/* Activities list */}
                            <div className="px-3 py-2 space-y-1.5">
                              {section.activities.map((act) => (
                                <div key={act.id} className="flex items-center gap-1.5 group">
                                  <span className={`w-1 h-1 rounded-full flex-shrink-0 ${style.accent.replace("text-", "bg-")}`} />
                                  <input
                                    ref={(el) => { newActivityRefs.current[act.id] = el; }}
                                    value={act.text}
                                    onChange={(e) => updateActivity(member.id, section.key, act.id, e.target.value)}
                                    placeholder="Activity..."
                                    className="flex-1 text-xs text-gray-700 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-400 focus:outline-none py-0.5 min-w-0 placeholder-gray-300"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeActivity(member.id, section.key, act.id)}
                                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => addActivity(member.id, section.key)}
                                className={`flex items-center gap-1 text-xs ${style.accent} opacity-60 hover:opacity-100 transition-opacity mt-1`}
                              >
                                <Plus size={11} /> Add activity
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleReset(member)}
                        className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
                      >
                        Reset to defaults
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSave(member)}
                        disabled={saving === member.id}
                        className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-lg px-4 py-2 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {saving === member.id ? (
                          <><Loader2 size={12} className="animate-spin" /> Saving…</>
                        ) : saved === member.id ? (
                          <><Check size={12} /> Saved!</>
                        ) : (
                          "Save Schedule"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ActivitiesPage: React.FC = () => {
  const { members, activeFamilyId, setMembers } = useAppStore();
  const [activities, setActivities] = useState<(Activity & { member?: FamilyMember })[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<(Activity & { member?: FamilyMember }) | null>(null);
  const [form, setForm] = useState({
    member_id: "", title: "", activity_type: "school" as ActivityType,
    description: "", location: "", start_date: "", end_date: "",
    start_time: "", duration_minutes: "60",
    recurrence: "none" as RecurrenceType, recurrence_days: "",
    is_special: false,
  });

  const loadActivities = async () => {
    if (!members.length) return;
    const all = await Promise.all(
      members.map((m) => activityApi.list(m.id).then((acts) => acts.map((a) => ({ ...a, member: m }))))
    );
    setActivities(all.flat().sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? "")));
  };

  useEffect(() => { loadActivities(); }, [members]); // eslint-disable-line

  const BLANK = () => ({
    member_id: "", title: "", activity_type: "school" as ActivityType,
    description: "", location: "", start_date: "", end_date: "",
    start_time: "", duration_minutes: "60",
    recurrence: "none" as RecurrenceType, recurrence_days: "", is_special: false,
  });

  const openAdd = () => { setEditingActivity(null); setForm(BLANK()); setShowForm(true); };
  const openEdit = (act: Activity & { member?: FamilyMember }) => {
    setEditingActivity(act);
    setForm({
      member_id: String(act.member_id), title: act.title,
      activity_type: act.activity_type, description: act.description ?? "",
      location: act.location ?? "", start_date: act.start_date ?? "",
      end_date: act.end_date ?? "", start_time: act.start_time ?? "",
      duration_minutes: String(act.duration_minutes), recurrence: act.recurrence,
      recurrence_days: act.recurrence_days ?? "", is_special: act.is_special,
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingActivity(null); setForm(BLANK()); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: form.title, activity_type: form.activity_type,
      description: form.description || undefined, location: form.location || undefined,
      start_date: form.start_date || undefined, end_date: form.end_date || undefined,
      start_time: form.start_time || undefined,
      duration_minutes: parseInt(form.duration_minutes),
      recurrence: form.recurrence, recurrence_days: form.recurrence_days || undefined,
      is_special: form.is_special,
    };
    if (editingActivity) {
      const updated = await activityApi.update(editingActivity.member_id, editingActivity.id, payload);
      setActivities((prev) => prev.map((a) => a.id === editingActivity.id ? { ...updated, member: editingActivity.member } : a));
    } else {
      await activityApi.create(parseInt(form.member_id), payload);
      await loadActivities();
    }
    closeForm();
  };

  const handleDelete = async (act: Activity & { member?: FamilyMember }) => {
    if (!window.confirm(`Delete "${act.title}"?`)) return;
    await activityApi.delete(act.member_id, act.id);
    setActivities((prev) => prev.filter((a) => a.id !== act.id));
  };

  const setField = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));
  const fieldCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Activities</h1>
          <p className="text-gray-500 text-sm mt-1">School, sports, and family events for all members</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> Add Activity
        </button>
      </div>

      {/* Activity form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-8 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800">
                {editingActivity ? "Edit Activity" : "Add Activity"}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Member *</label>
                <select required disabled={!!editingActivity} className={fieldCls + " disabled:bg-gray-50 disabled:text-gray-500"} value={form.member_id} onChange={(e) => setField("member_id", e.target.value)}>
                  <option value="">Select member...</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input required className={fieldCls} value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="e.g., Soccer Practice" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select className={fieldCls} value={form.activity_type} onChange={(e) => setField("activity_type", e.target.value)}>
                    {["school","sports","family","medical","hobby","other"].map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" className={fieldCls} value={form.start_date} onChange={(e) => setField("start_date", e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" className={fieldCls} value={form.end_date} onChange={(e) => setField("end_date", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input type="time" className={fieldCls} value={form.start_time} onChange={(e) => setField("start_time", e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                  <input type="number" min={5} className={fieldCls} value={form.duration_minutes} onChange={(e) => setField("duration_minutes", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence</label>
                  <select className={fieldCls} value={form.recurrence} onChange={(e) => setField("recurrence", e.target.value)}>
                    {["none","daily","weekly","monthly"].map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Days (e.g. Mon,Wed)</label>
                  <input className={fieldCls} value={form.recurrence_days} onChange={(e) => setField("recurrence_days", e.target.value)} placeholder="Mon,Wed,Fri" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input className={fieldCls} value={form.location} onChange={(e) => setField("location", e.target.value)} placeholder="Optional" />
              </div>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, is_special: !p.is_special }))}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  form.is_special ? "bg-amber-50 border-amber-400 text-amber-700" : "bg-white border-gray-300 text-gray-600 hover:border-amber-300"
                }`}
              >
                <Star size={15} className={form.is_special ? "fill-amber-400 text-amber-400" : "text-gray-400"} />
                {form.is_special ? "Special / One-time Event (highlighted)" : "Mark as Special / One-time Event"}
                <span className="ml-auto text-xs text-gray-400">doctor, library, function…</span>
              </button>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 transition-colors">
                  {editingActivity ? "Save Changes" : "Add Activity"}
                </button>
                <button type="button" onClick={closeForm} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily Schedule Templates */}
      {members.length > 0 && activeFamilyId && (
        <MemberDefaultsPanel
          members={members}
          activeFamilyId={activeFamilyId}
          onSaved={(updated) => setMembers(members.map((m) => (m.id === updated.id ? updated : m)))}
        />
      )}

      {/* Activity cards */}
      {activities.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">No activities yet</p>
          <p className="text-sm">Add school schedules, sports, and family events</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activities.map((act) => (
            <div key={act.id} className={`bg-white rounded-xl shadow-sm border p-4 ${act.is_special ? "border-amber-300 bg-amber-50/40" : "border-gray-100"}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[act.activity_type]}`}>
                    {act.activity_type}
                  </span>
                  {act.is_special && (
                    <span className="flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                      <Star size={10} className="fill-amber-500 text-amber-500" /> Special
                    </span>
                  )}
                  <h3 className="w-full font-semibold text-gray-800 mt-0.5">{act.title}</h3>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(act)} className="p-1 text-gray-300 hover:text-indigo-500 transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(act)} className="p-1 text-gray-300 hover:text-red-400 transition-colors"><X size={16} /></button>
                </div>
              </div>
              {act.member && (
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-medium" style={{ backgroundColor: act.member.color }}>
                    {act.member.avatar_initials[0]}
                  </div>
                  <span className="text-sm text-gray-600">{act.member.name}</span>
                </div>
              )}
              <div className="space-y-1 text-sm text-gray-500">
                {act.start_date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} />
                    <span>{act.start_date}{act.end_date && act.end_date !== act.start_date ? ` → ${act.end_date}` : ""}</span>
                  </div>
                )}
                {act.start_time && (
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} />
                    <span>{act.start_time} · {act.duration_minutes} min</span>
                  </div>
                )}
                {act.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={13} />
                    <span className="truncate">{act.location}</span>
                  </div>
                )}
                {act.recurrence !== "none" && (
                  <div className="flex items-center gap-1.5">
                    <Repeat size={13} />
                    <span>{act.recurrence}{act.recurrence_days ? ` (${act.recurrence_days})` : ""}</span>
                  </div>
                )}
              </div>
              {act.synced_to_calendar && (
                <span className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600">✓ Synced to Google Calendar</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
