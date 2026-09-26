import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles, Loader2, ChevronDown, Users, BookOpen,
  ToggleLeft, ToggleRight, Printer,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAppStore } from "../store/appStore";
import { scheduleApi } from "../services/api";
import type { UnifiedPlan } from "../types";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";

type DayMode = "single" | "multi" | "week";

const MODE_CONFIG: { key: DayMode; label: string; desc: string }[] = [
  { key: "single", label: "1 Day",        desc: "Plan a single day"    },
  { key: "multi",  label: "Multiple Days", desc: "Choose a date range"  },
  { key: "week",   label: "1 Week",        desc: "Full Mon – Sun week"  },
];

// ─── Plan viewer ──────────────────────────────────────────────────────────────

const PlanViewer: React.FC<{ plan: UnifiedPlan; onPrint: () => void }> = ({ plan, onPrint }) => {
  const startLabel = format(new Date(plan.start_date + "T00:00:00"), "MMMM d, yyyy");
  const endLabel =
    plan.end_date && plan.end_date !== plan.start_date
      ? ` – ${format(new Date(plan.end_date + "T00:00:00"), "MMMM d, yyyy")}`
      : "";

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-indigo-100 overflow-hidden print:shadow-none print:border-0">
      <div className="px-6 py-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-600 to-violet-700 text-white print:bg-none print:text-gray-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200">AI Schedule</p>
            <h2 className="text-lg font-bold mt-0.5">{startLabel}{endLabel}</h2>
            <p className="text-xs text-indigo-300 mt-0.5 print:hidden">
              Activities · daily templates · study sessions
            </p>
          </div>
          <button
            onClick={onPrint}
            className="print:hidden flex items-center gap-1.5 text-xs text-white/70 hover:text-white border border-white/30 rounded-xl px-3 py-1.5 hover:bg-white/10 transition-colors"
          >
            <Printer size={13} /> Print
          </button>
        </div>
      </div>
      <div className="px-6 py-5 prose prose-sm max-w-none study-plan-content overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan.content}</ReactMarkdown>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const SchedulePage: React.FC = () => {
  const { activeFamilyId, members } = useAppStore();
  const students = members.filter((m) => m.role === "student");
  const hasStudents = students.length > 0;

  const [dayMode, setDayMode]         = useState<DayMode>("single");
  const [startDate, setStartDate]     = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate]         = useState("");
  const [memberId, setMemberId]       = useState<string>("");
  const [notes, setNotes]             = useState("");
  const [includeStudy, setIncludeStudy] = useState(true);
  const [relaxMinutes, setRelaxMinutes] = useState("60");
  const [loading, setLoading]         = useState(false);
  const [plan, setPlan]               = useState<UnifiedPlan | null>(null);
  const [history, setHistory]         = useState<UnifiedPlan[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const planRef = useRef<HTMLDivElement>(null);

  // Disable study toggle when no students in scope
  const studentsInScope = (() => {
    if (!memberId) return hasStudents;
    return !!members.find((m) => String(m.id) === memberId && m.role === "student");
  })();

  useEffect(() => {
    if (!studentsInScope) setIncludeStudy(false);
    else setIncludeStudy(true);
  }, [studentsInScope]);

  const changeMode = (mode: DayMode) => {
    setDayMode(mode);
    if (mode === "single") {
      setEndDate("");
    } else if (mode === "week") {
      const mon = startOfWeek(new Date(startDate + "T00:00:00"), { weekStartsOn: 1 });
      setStartDate(format(mon, "yyyy-MM-dd"));
      setEndDate(format(endOfWeek(mon, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    } else {
      if (!endDate || endDate < startDate) setEndDate(startDate);
    }
  };

  const onStartDateChange = (val: string) => {
    if (dayMode === "week") {
      const mon = startOfWeek(new Date(val + "T00:00:00"), { weekStartsOn: 1 });
      setStartDate(format(mon, "yyyy-MM-dd"));
      setEndDate(format(endOfWeek(mon, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    } else {
      setStartDate(val);
      if (dayMode === "multi" && endDate && endDate < val) setEndDate(val);
    }
  };

  const computedEnd =
    dayMode === "single" ? undefined :
    dayMode === "week"   ? endDate || format(addDays(new Date(startDate + "T00:00:00"), 6), "yyyy-MM-dd") :
    endDate || undefined;

  const generate = async () => {
    if (!activeFamilyId) return;
    setLoading(true);
    try {
      const result = await scheduleApi.generateUnified({
        family_id: activeFamilyId,
        start_date: startDate,
        end_date: computedEnd,
        member_id: memberId ? parseInt(memberId) : undefined,
        include_study_sessions: includeStudy && studentsInScope,
        relax_time_per_day_minutes: parseInt(relaxMinutes) || 60,
        additional_notes: notes || undefined,
      });
      setPlan(result);
      setHistory((prev) => [result, ...prev.slice(0, 9)]);
    } finally {
      setLoading(false);
    }
  };

  if (!activeFamilyId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Please create or select a family first.</p>
      </div>
    );
  }

  const inputCls = "w-full border border-indigo-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white placeholder-gray-400";
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

  const weekLabel = dayMode === "week" && startDate
    ? `${format(new Date(startDate + "T00:00:00"), "MMM d")} – ${format(new Date((computedEnd ?? startDate) + "T00:00:00"), "MMM d, yyyy")}`
    : null;

  const selectedMember = members.find((m) => String(m.id) === memberId);

  return (
    <div className="p-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">AI Schedule</h1>
          <p className="text-gray-400 text-xs">
            Daily templates · activities · study sessions · Powered by Llama 3.3-70b via Groq
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm shadow-indigo-100 border border-indigo-100 p-7 mb-6 space-y-6">

        {/* ── Step 1: Duration ─────────────────────────────── */}
        <div>
          <p className={labelCls}>Duration</p>
          <div className="flex gap-2 flex-wrap">
            {MODE_CONFIG.map(({ key, label, desc }) => (
              <button
                key={key}
                type="button"
                onClick={() => changeMode(key)}
                className={`flex flex-col items-start px-4 py-2.5 rounded-2xl border transition-all text-left ${
                  dayMode === key
                    ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-transparent shadow-md"
                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                <span className="text-sm font-semibold">{label}</span>
                <span className={`text-xs mt-0.5 ${dayMode === key ? "text-white/70" : "text-gray-400"}`}>{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Step 2: Date(s) ──────────────────────────────── */}
        <div>
          <p className={labelCls}>
            {dayMode === "single" ? "Date" : dayMode === "week" ? "Week" : "Date Range"}
          </p>
          {dayMode === "single" && (
            <input type="date" className={inputCls + " max-w-xs"} value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
          )}
          {dayMode === "multi" && (
            <div className="flex items-center gap-3">
              <input type="date" className={inputCls} value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
              <span className="text-gray-400 text-sm flex-shrink-0">to</span>
              <input type="date" min={startDate} className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          )}
          {dayMode === "week" && (
            <div>
              <input type="date" className={inputCls + " max-w-xs"} value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
              {weekLabel && <p className="text-xs text-indigo-500 font-medium mt-1.5">📅 {weekLabel}</p>}
            </div>
          )}
        </div>

        {/* ── Step 3: Who ──────────────────────────────────── */}
        <div>
          <p className={labelCls}>Who</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMemberId("")}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-medium transition-all ${
                memberId === ""
                  ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-transparent shadow-md"
                  : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300"
              }`}
            >
              <Users size={14} /> Whole Family
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMemberId(memberId === String(m.id) ? "" : String(m.id))}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-medium transition-all ${
                  memberId === String(m.id)
                    ? "text-white border-transparent shadow-md"
                    : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300"
                }`}
                style={memberId === String(m.id) ? { background: m.color } : undefined}
              >
                <div
                  className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0"
                  style={{ backgroundColor: memberId === String(m.id) ? "rgba(255,255,255,0.3)" : m.color }}
                >
                  {m.avatar_initials[0]}
                </div>
                {m.name}
                {m.role === "student" && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${memberId === String(m.id) ? "bg-white/20" : "bg-violet-100 text-violet-600"}`}>
                    student
                  </span>
                )}
              </button>
            ))}
          </div>
          {!memberId && (
            <p className="text-xs text-gray-400 mt-1.5">
              Common activities → 👨‍👩‍👧 Family · individual activities under each member
            </p>
          )}
          {selectedMember && (
            <p className="text-xs text-gray-400 mt-1.5">
              Individual schedule for {selectedMember.name}
              {selectedMember.role === "student" ? " — includes study sessions" : ""}
            </p>
          )}
        </div>

        {/* ── Step 4: Study sessions (students in scope) ───── */}
        {studentsInScope && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <BookOpen size={15} className="text-violet-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-violet-800">Study Sessions</span>
              <button
                type="button"
                onClick={() => setIncludeStudy(!includeStudy)}
                className="flex items-center gap-1.5 text-sm text-violet-700 ml-1"
              >
                {includeStudy
                  ? <ToggleRight size={22} className="text-violet-600" />
                  : <ToggleLeft size={22} className="text-gray-400" />}
                <span className={includeStudy ? "text-violet-700 font-medium" : "text-gray-500"}>
                  {includeStudy ? "Included" : "Excluded"}
                </span>
              </button>
              {includeStudy && (
                <div className="flex items-center gap-2 ml-auto">
                  <label className="text-xs text-violet-600 font-medium whitespace-nowrap">Relax / day</label>
                  <input
                    type="number" min={0} max={180}
                    className="w-16 border border-violet-300 rounded-xl px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                    value={relaxMinutes}
                    onChange={(e) => setRelaxMinutes(e.target.value)}
                  />
                  <span className="text-xs text-violet-500">min</span>
                </div>
              )}
            </div>
            {includeStudy && (
              <p className="text-xs text-violet-500 mt-1.5">
                Study sessions are built from subjects in the Academic Tracker
              </p>
            )}
          </div>
        )}

        {/* ── Notes ────────────────────────────────────────── */}
        <div>
          <p className={labelCls}>Notes <span className="normal-case font-normal text-gray-400">(optional)</span></p>
          <input
            className={inputCls}
            placeholder="e.g., early pick-up at 2pm, exam tomorrow, field trip Wednesday..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* ── Generate ─────────────────────────────────────── */}
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-2xl px-7 py-3 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-lg shadow-indigo-200"
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Generating…</>
          ) : (
            <><Sparkles size={16} /> Generate Schedule</>
          )}
        </button>
      </div>

      {/* Generated plan */}
      {plan && (
        <div className="mb-6" ref={planRef}>
          <PlanViewer plan={plan} onPrint={() => window.print()} />
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="print:hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors mb-4"
          >
            <ChevronDown size={16} className={`transition-transform duration-200 ${showHistory ? "rotate-180" : ""}`} />
            Previous Schedules ({history.length - 1})
          </button>
          {showHistory && (
            <div className="space-y-4">
              {history.slice(1).map((p, i) => (
                <PlanViewer key={i} plan={p} onPrint={() => window.print()} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
