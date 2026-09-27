import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap, Sparkles, Loader2, BookOpen,
  Pencil, Trash2, Check, Plus, X, Bell, Calendar,
  AlertTriangle, Clock, ChevronDown, ChevronRight,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { differenceInDays, format, parseISO } from "date-fns";
import { useAppStore } from "../store/appStore";
import { subjectApi, deadlineApi } from "../services/api";
import type { Subject, SubjectDifficulty, HomeworkFrequency, Deadline, DeadlineType } from "../types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTY_LABELS: Record<SubjectDifficulty, string> = {
  easy: "Easy", medium: "Medium", hard: "Hard",
};
const DIFFICULTY_COLORS: Record<SubjectDifficulty, string> = {
  easy: "bg-indigo-100 text-indigo-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-red-100 text-red-700",
};
const FREQ_LABELS: Record<HomeworkFrequency, string> = {
  daily: "Daily", alternate: "Alternate", weekly: "Weekly", as_needed: "As needed",
};

const DEADLINE_TYPES: { value: DeadlineType; label: string; icon: string }[] = [
  { value: "exam",        label: "Exam",        icon: "📝" },
  { value: "assignment",  label: "Assignment",  icon: "📄" },
  { value: "essay",       label: "Essay",       icon: "✍️" },
  { value: "internship",  label: "Internship",  icon: "💼" },
  { value: "project",     label: "Project",     icon: "🔧" },
  { value: "other",       label: "Other",       icon: "📌" },
];

const DEADLINE_TYPE_COLORS: Record<DeadlineType, string> = {
  exam:       "bg-red-100 text-red-700",
  assignment: "bg-blue-100 text-blue-700",
  essay:      "bg-violet-100 text-violet-700",
  internship: "bg-amber-100 text-amber-700",
  project:    "bg-indigo-100 text-indigo-700",
  other:      "bg-gray-100 text-gray-600",
};

const urgencyConfig = (daysLeft: number) => {
  if (daysLeft < 0)  return { label: "Overdue",  bg: "bg-red-50",    border: "border-red-300",   badge: "bg-red-500 text-white",    dot: "bg-red-500"   };
  if (daysLeft <= 3) return { label: "Urgent",   bg: "bg-red-50",    border: "border-red-200",   badge: "bg-red-100 text-red-700",  dot: "bg-red-500"   };
  if (daysLeft <= 7) return { label: "Soon",     bg: "bg-amber-50",  border: "border-amber-200", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" };
  return               { label: "Upcoming", bg: "bg-gray-50",   border: "border-gray-200",  badge: "bg-gray-100 text-gray-600",  dot: "bg-gray-400"  };
};

const BLANK_SUBJECT = (): Partial<Subject> & { name: string } => ({
  name: "", teacher: "",
  difficulty: "medium" as SubjectDifficulty,
  homework_frequency: "daily" as HomeworkFrequency,
  homework_duration_minutes: 30,
  class_days: "", exam_date: "", notes: "",
});

const BLANK_DEADLINE = () => ({
  title: "", deadline_type: "assignment" as DeadlineType,
  due_date: "", subject_id: "" as string, description: "",
});

// ─── Page ─────────────────────────────────────────────────────────────────────

export const StudyPlannerPage: React.FC = () => {
  const { student } = useAppStore();

  // subjects
  const [subjects, setSubjects]               = useState<Subject[]>([]);
  const [showSubjectForm, setShowSubjectForm]  = useState(false);
  const [subjectForm, setSubjectForm]          = useState(BLANK_SUBJECT());
  const [editingSubjectId, setEditingSubjectId]= useState<number | null>(null);
  const [savingSubject, setSavingSubject]      = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState<number | null>(null);

  // deadlines
  const [deadlines, setDeadlines]             = useState<Deadline[]>([]);
  const [showDeadlineForm, setShowDeadlineForm]= useState(false);
  const [deadlineForm, setDeadlineForm]        = useState(BLANK_DEADLINE());
  const [editingDeadlineId, setEditingDeadlineId] = useState<number | null>(null);
  const [savingDeadline, setSavingDeadline]    = useState(false);
  const [deletingDeadlineId, setDeletingDeadlineId] = useState<number | null>(null);
  const [togglingId, setTogglingId]            = useState<number | null>(null);

  // reminders
  const [generatingReminders, setGeneratingReminders] = useState(false);
  const [reminders, setReminders]             = useState<string | null>(null);
  const [showReminders, setShowReminders]     = useState(false);
  const remindersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    subjectApi.list().then(setSubjects);
    deadlineApi.list().then(setDeadlines);
  }, []);

  const today = new Date(); today.setHours(0,0,0,0);

  // ── Subjects CRUD ─────────────────────────────────────────────────────────

  const startSubjectEdit = (sub: Subject) => {
    setEditingSubjectId(sub.id);
    setSubjectForm({
      name: sub.name, teacher: sub.teacher ?? "",
      difficulty: sub.difficulty, homework_frequency: sub.homework_frequency,
      homework_duration_minutes: sub.homework_duration_minutes,
      class_days: sub.class_days ?? "", exam_date: sub.exam_date ?? "", notes: sub.notes ?? "",
    });
    setShowSubjectForm(true);
  };
  const cancelSubjectEdit = () => {
    setEditingSubjectId(null); setSubjectForm(BLANK_SUBJECT()); setShowSubjectForm(false);
  };
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.name.trim()) return;
    setSavingSubject(true);
    try {
      const payload = {
        ...subjectForm,
        teacher: subjectForm.teacher || null, class_days: subjectForm.class_days || null,
        exam_date: subjectForm.exam_date || null, notes: subjectForm.notes || null,
      };
      if (editingSubjectId !== null) {
        const updated = await subjectApi.update(editingSubjectId, payload);
        setSubjects((prev) => prev.map((s) => s.id === editingSubjectId ? updated : s));
      } else {
        const created = await subjectApi.create(payload as Partial<Subject> & { name: string });
        setSubjects((prev) => [...prev, created]);
      }
      cancelSubjectEdit();
    } finally { setSavingSubject(false); }
  };
  const handleDeleteSubject = async (id: number) => {
    setDeletingSubjectId(id);
    try { await subjectApi.delete(id); setSubjects((prev) => prev.filter((s) => s.id !== id)); }
    finally { setDeletingSubjectId(null); }
  };

  // ── Deadlines CRUD ─────────────────────────────────────────────────────────

  const startDeadlineEdit = (dl: Deadline) => {
    setEditingDeadlineId(dl.id);
    setDeadlineForm({
      title: dl.title, deadline_type: dl.deadline_type,
      due_date: dl.due_date, subject_id: dl.subject_id ? String(dl.subject_id) : "",
      description: dl.description ?? "",
    });
    setShowDeadlineForm(true);
  };
  const cancelDeadlineEdit = () => {
    setEditingDeadlineId(null); setDeadlineForm(BLANK_DEADLINE()); setShowDeadlineForm(false);
  };
  const handleSaveDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deadlineForm.title.trim() || !deadlineForm.due_date) return;
    setSavingDeadline(true);
    try {
      const payload = {
        title: deadlineForm.title.trim(),
        deadline_type: deadlineForm.deadline_type,
        due_date: deadlineForm.due_date,
        subject_id: deadlineForm.subject_id ? parseInt(deadlineForm.subject_id) : null,
        description: deadlineForm.description || null,
      };
      if (editingDeadlineId !== null) {
        const updated = await deadlineApi.update(editingDeadlineId, payload);
        setDeadlines((prev) => prev.map((d) => d.id === editingDeadlineId ? updated : d));
      } else {
        const created = await deadlineApi.create(payload as any);
        setDeadlines((prev) => [...prev, created].sort((a, b) => a.due_date.localeCompare(b.due_date)));
      }
      cancelDeadlineEdit();
    } finally { setSavingDeadline(false); }
  };
  const handleDeleteDeadline = async (id: number) => {
    setDeletingDeadlineId(id);
    try { await deadlineApi.delete(id); setDeadlines((prev) => prev.filter((d) => d.id !== id)); }
    finally { setDeletingDeadlineId(null); }
  };
  const toggleComplete = async (dl: Deadline) => {
    setTogglingId(dl.id);
    try {
      const updated = await deadlineApi.update(dl.id, { completed: !dl.completed });
      setDeadlines((prev) => prev.map((d) => d.id === dl.id ? updated : d));
    } finally { setTogglingId(null); }
  };

  // ── Reminder generation ────────────────────────────────────────────────────

  const handleGenerateReminders = async () => {
    setGeneratingReminders(true);
    setReminders(null);
    try {
      const { content } = await deadlineApi.generateReminders();
      setReminders(content);
      setShowReminders(true);
      setTimeout(() => remindersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } finally { setGeneratingReminders(false); }
  };

  const fieldCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const openDeadlines  = deadlines.filter((d) => !d.completed);
  const doneDeadlines  = deadlines.filter((d) => d.completed);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
          <GraduationCap size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Academic Tracker</h1>
          <p className="text-gray-400 text-xs">Subjects · deadlines · AI reminders</p>
        </div>
      </div>

      {/* ── Subjects ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-5">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-700">
              Subjects
            </h2>
            {subjects.length > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{subjects.length}</span>
            )}
          </div>
          <button
            onClick={() => { setShowSubjectForm(!showSubjectForm); if (editingSubjectId) cancelSubjectEdit(); }}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-300 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors"
          >
            <Plus size={13} /> Add Subject
          </button>
        </div>

        <div className="px-5 py-3">
          {subjects.length > 0 ? (
            <div className="space-y-2 mb-3">
              {subjects.map((sub) => (
                <div key={sub.id} className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2.5 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
                  <Link to={`/study-planner/subjects/${sub.id}`} className="flex-1 min-w-0 group" title="View curriculum">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800 group-hover:text-indigo-700">{sub.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[sub.difficulty]}`}>
                        {DIFFICULTY_LABELS[sub.difficulty]}
                      </span>
                      <span className="text-xs text-gray-500">
                        {FREQ_LABELS[sub.homework_frequency]} · {sub.homework_duration_minutes} min HW
                      </span>
                      {sub.class_days && <span className="text-xs text-gray-400">{sub.class_days}</span>}
                      {sub.exam_date && <span className="text-xs text-red-600 font-medium">Exam: {sub.exam_date}</span>}
                    </div>
                    {sub.teacher && <p className="text-xs text-gray-400 mt-0.5">Teacher: {sub.teacher}</p>}
                    <p className="text-xs text-indigo-500 mt-1 flex items-center gap-0.5 opacity-70 group-hover:opacity-100">
                      {sub.curriculum_generated_at ? "View curriculum & notes" : "Load curriculum"} <ChevronRight size={12} />
                    </p>
                  </Link>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => startSubjectEdit(sub)} aria-label={`Edit ${sub.name}`} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => handleDeleteSubject(sub.id)} aria-label={`Delete ${sub.name}`} disabled={deletingSubjectId === sub.id} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                      {deletingSubjectId === sub.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !showSubjectForm && <p className="text-sm text-gray-400 italic py-2">No subjects yet — add subjects to enrich the AI schedule.</p>
          )}

          {showSubjectForm && (
            <form onSubmit={handleSaveSubject} className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mt-2">
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-3">
                {editingSubjectId !== null ? "Edit Subject" : "New Subject"}
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Subject Name *</label>
                  <input required className={fieldCls} placeholder="e.g., Mathematics" value={subjectForm.name}
                    onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teacher</label>
                  <input className={fieldCls} placeholder="e.g., Mr. Smith" value={subjectForm.teacher ?? ""}
                    onChange={(e) => setSubjectForm((f) => ({ ...f, teacher: e.target.value }))} />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Difficulty</label>
                  <select className={fieldCls} value={subjectForm.difficulty}
                    onChange={(e) => setSubjectForm((f) => ({ ...f, difficulty: e.target.value as SubjectDifficulty }))}>
                    <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">HW Frequency</label>
                  <select className={fieldCls} value={subjectForm.homework_frequency}
                    onChange={(e) => setSubjectForm((f) => ({ ...f, homework_frequency: e.target.value as HomeworkFrequency }))}>
                    <option value="daily">Daily</option><option value="alternate">Alternate days</option>
                    <option value="weekly">Weekly</option><option value="as_needed">As needed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">HW Duration (min)</label>
                  <input type="number" min={5} max={300} className={fieldCls} value={subjectForm.homework_duration_minutes ?? 30}
                    onChange={(e) => setSubjectForm((f) => ({ ...f, homework_duration_minutes: parseInt(e.target.value) || 30 }))} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Class Days</label>
                  <input className={fieldCls} placeholder="Mon,Wed,Fri" value={subjectForm.class_days ?? ""}
                    onChange={(e) => setSubjectForm((f) => ({ ...f, class_days: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <input className={fieldCls} placeholder="Optional" value={subjectForm.notes ?? ""}
                    onChange={(e) => setSubjectForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingSubject}
                  className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-lg px-4 py-2 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {savingSubject ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : <><Check size={12} /> {editingSubjectId !== null ? "Save Changes" : "Add Subject"}</>}
                </button>
                <button type="button" onClick={cancelSubjectEdit} className="border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-xs font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ── Deadlines ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-5">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-violet-500" />
            <h2 className="text-sm font-semibold text-gray-700">
              Deadlines
            </h2>
            {openDeadlines.length > 0 && (
              <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">{openDeadlines.length} open</span>
            )}
          </div>
          <button
            onClick={() => { setShowDeadlineForm(!showDeadlineForm); if (editingDeadlineId) cancelDeadlineEdit(); }}
            className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-800 border border-violet-300 rounded-lg px-3 py-1.5 hover:bg-violet-50 transition-colors"
          >
            <Plus size={13} /> Add Deadline
          </button>
        </div>

        <div className="px-5 py-3">
          {/* Add / Edit form */}
          {showDeadlineForm && (
            <form onSubmit={handleSaveDeadline} className="bg-violet-50 border border-violet-200 rounded-lg p-4 mb-4">
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-3">
                {editingDeadlineId !== null ? "Edit Deadline" : "New Deadline"}
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                  <input required className={fieldCls} placeholder="e.g., Chapter 5 Essay" value={deadlineForm.title}
                    onChange={(e) => setDeadlineForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select className={fieldCls} value={deadlineForm.deadline_type}
                    onChange={(e) => setDeadlineForm((f) => ({ ...f, deadline_type: e.target.value as DeadlineType }))}>
                    {DEADLINE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Due Date *</label>
                  <input required type="date" className={fieldCls} value={deadlineForm.due_date}
                    onChange={(e) => setDeadlineForm((f) => ({ ...f, due_date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Subject (optional)</label>
                  <select className={fieldCls} value={deadlineForm.subject_id}
                    onChange={(e) => setDeadlineForm((f) => ({ ...f, subject_id: e.target.value }))}>
                    <option value="">No subject</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes / Description</label>
                <input className={fieldCls} placeholder="e.g., 1500 words, APA format" value={deadlineForm.description}
                  onChange={(e) => setDeadlineForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingDeadline}
                  className="flex items-center gap-1.5 bg-violet-600 text-white rounded-lg px-4 py-2 text-xs font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
                  {savingDeadline ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : <><Check size={12} /> {editingDeadlineId !== null ? "Save Changes" : "Add Deadline"}</>}
                </button>
                <button type="button" onClick={cancelDeadlineEdit} className="border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-xs font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              </div>
            </form>
          )}

          {/* Open deadlines */}
          {openDeadlines.length === 0 && !showDeadlineForm ? (
            <p className="text-sm text-gray-400 italic py-2">No open deadlines — add exams, assignments, or essays to track them here.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {openDeadlines.map((dl) => {
                const dueDate = parseISO(dl.due_date);
                const daysLeft = differenceInDays(dueDate, today);
                const urg = urgencyConfig(daysLeft);
                const linkedSubject = subjects.find((s) => s.id === dl.subject_id);
                const typeInfo = DEADLINE_TYPES.find((t) => t.value === dl.deadline_type);
                return (
                  <div key={dl.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${urg.bg} ${urg.border}`}>
                    {/* Complete toggle */}
                    <button
                      onClick={() => toggleComplete(dl)}
                      disabled={togglingId === dl.id}
                      className="mt-0.5 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-violet-500 flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50"
                    >
                      {togglingId === dl.id && <Loader2 size={10} className="animate-spin text-gray-400" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold text-gray-800">{dl.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${DEADLINE_TYPE_COLORS[dl.deadline_type]}`}>
                          {typeInfo?.icon} {typeInfo?.label}
                        </span>
                        {linkedSubject && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                            {linkedSubject.name}
                          </span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${urg.badge}`}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar size={11} />
                        <span>Due {format(dueDate, "EEE, MMM d, yyyy")}</span>
                        {dl.description && <span className="text-gray-400">· {dl.description}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => startDeadlineEdit(dl)} aria-label={`Edit ${dl.title}`} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => handleDeleteDeadline(dl.id)} aria-label={`Delete ${dl.title}`} disabled={deletingDeadlineId === dl.id} className="p-2 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors disabled:opacity-40">
                        {deletingDeadlineId === dl.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed deadlines (collapsed) */}
          {doneDeadlines.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                ✓ {doneDeadlines.length} completed
              </summary>
              <div className="space-y-1.5 mt-2">
                {doneDeadlines.map((dl) => {
                  const typeInfo = DEADLINE_TYPES.find((t) => t.value === dl.deadline_type);
                  return (
                    <div key={dl.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 opacity-60">
                      <button onClick={() => toggleComplete(dl)} disabled={togglingId === dl.id} className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                        {togglingId === dl.id ? <Loader2 size={10} className="animate-spin text-white" /> : <Check size={10} className="text-white" />}
                      </button>
                      <span className="text-sm text-gray-500 line-through flex-1">{dl.title}</span>
                      <span className="text-xs text-gray-400">{typeInfo?.icon} {dl.due_date}</span>
                      <button onClick={() => handleDeleteDeadline(dl.id)} aria-label={`Delete ${dl.title}`} className="p-2 text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* ── Generate Reminders ────────────────────────────────────────────── */}
      {openDeadlines.length > 0 && (
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Bell size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">AI Reminder Plan</h3>
              <p className="text-xs text-white/70">Get a personalised prep schedule for all {openDeadlines.length} open deadline{openDeadlines.length > 1 ? "s" : ""}</p>
            </div>
          </div>
          <button
            onClick={handleGenerateReminders}
            disabled={generatingReminders}
            className="flex items-center gap-2 bg-white text-violet-700 rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-violet-50 disabled:opacity-50 transition-colors shadow-lg mt-3"
          >
            {generatingReminders ? <><Loader2 size={15} className="animate-spin" /> Generating…</> : <><Sparkles size={15} /> Generate Reminders</>}
          </button>
        </div>
      )}

      {/* Reminder output */}
      {reminders && (
        <div ref={remindersRef} className="bg-white rounded-xl shadow-sm border border-violet-100 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-200">AI Reminder Plan</p>
              <h2 className="text-base font-bold mt-0.5">{student?.name} — Upcoming Deadlines</h2>
            </div>
            <button onClick={() => setShowReminders(!showReminders)} className="text-white/70 hover:text-white">
              <ChevronDown size={18} className={`transition-transform ${showReminders ? "" : "rotate-180"}`} />
            </button>
          </div>
          {showReminders && (
            <div className="px-6 py-5 prose prose-sm max-w-none overflow-x-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{reminders}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
