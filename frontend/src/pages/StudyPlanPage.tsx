import React, { useEffect, useState } from "react";
import {
  BookOpen, Plus, X, Sparkles, Loader2, ChevronDown,
  GraduationCap, Trash2, Edit2, AlertTriangle, Printer,
} from "lucide-react";
import { useAppStore } from "../store/appStore";
import { StudyPlanViewer } from "../components/schedule/StudyPlanViewer";
import { subjectApi, studyPlanApi } from "../services/api";
import type { Subject, SubjectDifficulty, HomeworkFrequency, FamilyMember, StudyPlan } from "../types";
import { format, startOfWeek, addDays } from "date-fns";

const DIFFICULTY_COLORS: Record<SubjectDifficulty, string> = {
  easy: "bg-indigo-100 text-indigo-700",
  medium: "bg-yellow-100 text-yellow-700",
  hard: "bg-red-100 text-red-700",
};

const HW_LABELS: Record<HomeworkFrequency, string> = {
  daily: "Daily HW",
  alternate: "Alt. days HW",
  weekly: "Weekly HW",
  as_needed: "As needed",
};

// ---------- Subject Form ----------
interface SubjectFormProps {
  initial?: Partial<Subject>;
  onSubmit: (data: Partial<Subject> & { name: string }) => Promise<void>;
  onCancel: () => void;
}

const SubjectForm: React.FC<SubjectFormProps> = ({ initial = {}, onSubmit, onCancel }) => {
  const [form, setForm] = useState({
    name: initial.name ?? "",
    teacher: initial.teacher ?? "",
    difficulty: (initial.difficulty ?? "medium") as SubjectDifficulty,
    homework_frequency: (initial.homework_frequency ?? "daily") as HomeworkFrequency,
    homework_duration_minutes: String(initial.homework_duration_minutes ?? 30),
    class_days: initial.class_days ?? "",
    exam_date: initial.exam_date ?? "",
    notes: initial.notes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        ...form,
        homework_duration_minutes: parseInt(form.homework_duration_minutes),
        exam_date: form.exam_date || undefined,
        teacher: form.teacher || undefined,
        class_days: form.class_days || undefined,
        notes: form.notes || undefined,
      });
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Subject Name *</label>
          <input required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g., Algebra" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Teacher</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.teacher} onChange={(e) => set("teacher", e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Difficulty</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Homework</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.homework_frequency} onChange={(e) => set("homework_frequency", e.target.value)}>
            <option value="daily">Daily</option>
            <option value="alternate">Alternate days</option>
            <option value="weekly">Weekly</option>
            <option value="as_needed">As needed</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">HW Duration (min)</label>
          <input type="number" min={5} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.homework_duration_minutes} onChange={(e) => set("homework_duration_minutes", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Class Days (e.g. Mon,Wed,Fri)</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.class_days} onChange={(e) => set("class_days", e.target.value)} placeholder="Mon,Tue,Thu" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Exam Date</label>
          <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.exam_date} onChange={(e) => set("exam_date", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g., Chapter 5 test next week" />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {loading ? "Saving..." : "Save Subject"}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
      </div>
    </form>
  );
};

// ---------- Main Page ----------
export const StudyPlanPage: React.FC = () => {
  const { members } = useAppStore();
  const students = members.filter((m) => m.role === "student");

  const [selectedStudent, setSelectedStudent] = useState<FamilyMember | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);

  // Study plan generation controls
  const weekMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const [weekStart, setWeekStart] = useState(format(weekMonday, "yyyy-MM-dd"));
  const [relaxMinutes, setRelaxMinutes] = useState("60");
  const [planNotes, setPlanNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<StudyPlan | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (students.length > 0 && !selectedStudent) setSelectedStudent(students[0]);
  }, [students]);

  useEffect(() => {
    if (!selectedStudent) return;
    subjectApi.list(selectedStudent.id).then(setSubjects);
    studyPlanApi.listForMember(selectedStudent.id).then(setPlans);
    setCurrentPlan(null);
  }, [selectedStudent]);

  const handleAddSubject = async (data: Partial<Subject> & { name: string }) => {
    if (!selectedStudent) return;
    const s = await subjectApi.create(selectedStudent.id, data);
    setSubjects((prev) => [...prev, s]);
    setShowSubjectForm(false);
  };

  const handleEditSubject = async (data: Partial<Subject> & { name: string }) => {
    if (!selectedStudent || !editSubject) return;
    const s = await subjectApi.update(selectedStudent.id, editSubject.id, data);
    setSubjects((prev) => prev.map((x) => (x.id === s.id ? s : x)));
    setEditSubject(null);
  };

  const handleDeleteSubject = async (s: Subject) => {
    if (!selectedStudent) return;
    if (!window.confirm(`Remove "${s.name}"?`)) return;
    await subjectApi.delete(selectedStudent.id, s.id);
    setSubjects((prev) => prev.filter((x) => x.id !== s.id));
  };

  const generatePlan = async () => {
    if (!selectedStudent) return;
    setGenerating(true);
    try {
      const plan = await studyPlanApi.generate({
        member_id: selectedStudent.id,
        week_start: weekStart,
        relax_time_per_day_minutes: parseInt(relaxMinutes),
        additional_notes: planNotes || undefined,
      });
      setCurrentPlan(plan);
      setPlans((prev) => [plan, ...prev]);
    } finally { setGenerating(false); }
  };

  const weekEnd = format(addDays(new Date(weekStart + "T00:00:00"), 6), "MMM d, yyyy");

  if (!students.length) {
    return (
      <div className="p-8 text-center">
        <GraduationCap size={48} className="mx-auto mb-3 text-gray-300" />
        <p className="text-gray-500 font-medium">No students found</p>
        <p className="text-gray-400 text-sm mt-1">Add a family member with the "Student" role first.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Study Plan</h1>
          <p className="text-gray-500 text-sm mt-1">AI-generated weekly study schedules for students</p>
        </div>
        {currentPlan && (
          <button onClick={() => window.print()} className="flex items-center gap-2 border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors print:hidden">
            <Printer size={15} /> Print
          </button>
        )}
      </div>

      {/* Student selector */}
      {students.length > 1 && (
        <div className="flex gap-2 mb-6 print:hidden">
          {students.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStudent(s)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                selectedStudent?.id === s.id
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-gray-300 text-gray-600 hover:border-indigo-400"
              }`}
            >
              <div className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold" style={{ backgroundColor: s.color }}>{s.avatar_initials[0]}</div>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {selectedStudent && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Subjects panel */}
          <div className="print:hidden">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                    <BookOpen size={16} className="text-indigo-500" /> Subjects
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedStudent.name}'s enrolled subjects</p>
                </div>
                <button onClick={() => { setShowSubjectForm(true); setEditSubject(null); }} className="flex items-center gap-1 text-indigo-600 text-xs font-medium hover:text-indigo-800">
                  <Plus size={14} /> Add
                </button>
              </div>

              {(showSubjectForm || editSubject) && (
                <div className="mb-4 bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                  <p className="text-xs font-semibold text-indigo-700 mb-3">
                    {editSubject ? `Edit: ${editSubject.name}` : "New Subject"}
                  </p>
                  <SubjectForm
                    initial={editSubject ?? {}}
                    onSubmit={editSubject ? handleEditSubject : handleAddSubject}
                    onCancel={() => { setShowSubjectForm(false); setEditSubject(null); }}
                  />
                </div>
              )}

              {subjects.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No subjects yet — add them above</p>
              ) : (
                <div className="space-y-2">
                  {subjects.map((s) => (
                    <div key={s.id} className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-gray-800">{s.name}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[s.difficulty]}`}>{s.difficulty}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {HW_LABELS[s.homework_frequency]} · {s.homework_duration_minutes} min
                          {s.class_days && ` · ${s.class_days}`}
                        </p>
                        {s.exam_date && (
                          <p className="text-xs text-red-600 flex items-center gap-1 mt-0.5">
                            <AlertTriangle size={10} /> Exam: {format(new Date(s.exam_date + "T00:00:00"), "MMM d")}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-0.5">
                        <button onClick={() => { setEditSubject(s); setShowSubjectForm(false); }} className="p-1 text-gray-400 hover:text-indigo-500 rounded transition-colors"><Edit2 size={13} /></button>
                        <button onClick={() => handleDeleteSubject(s)} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Plan generator + output */}
          <div className="lg:col-span-2">
            {/* Generator controls */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5 print:hidden">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-500" /> Generate Study Plan
              </h2>
              <div className="grid sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Week Starting (Monday)</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(weekStart + "T00:00:00"), "MMM d")} – {weekEnd}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Relax Time / Day (min)</label>
                  <input
                    type="number"
                    min={0}
                    max={240}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={relaxMinutes}
                    onChange={(e) => setRelaxMinutes(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., midterms week"
                    value={planNotes}
                    onChange={(e) => setPlanNotes(e.target.value)}
                  />
                </div>
              </div>
              <button
                onClick={generatePlan}
                disabled={generating || subjects.length === 0}
                className="flex items-center gap-2 bg-indigo-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                title={subjects.length === 0 ? "Add subjects first" : undefined}
              >
                {generating ? <><Loader2 size={15} className="animate-spin" /> Generating...</> : <><Sparkles size={15} /> Generate Plan</>}
              </button>
              {subjects.length === 0 && (
                <p className="text-xs text-amber-600 mt-2">Add at least one subject to generate a study plan.</p>
              )}
            </div>

            {/* Current plan output */}
            {currentPlan && (
              <div className="mb-5">
                <StudyPlanViewer plan={currentPlan} studentName={selectedStudent?.name} />
              </div>
            )}

            {/* Past plans */}
            {plans.length > 1 && (
              <div className="print:hidden">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 mb-3 transition-colors"
                >
                  <ChevronDown size={15} className={`transition-transform ${showHistory ? "rotate-180" : ""}`} />
                  Past Plans ({plans.length - 1})
                </button>
                {showHistory && (
                  <div className="space-y-4">
                    {plans.slice(1).map((p) => (
                      <StudyPlanViewer key={p.id} plan={p} studentName={selectedStudent?.name} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
