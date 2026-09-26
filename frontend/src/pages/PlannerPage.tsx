import React, { useEffect, useState } from "react";
import {
  Sparkles, Loader2, CalendarDays,
  SlidersHorizontal, X, ChevronDown, Printer, BookOpen,
  ToggleLeft, ToggleRight,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAppStore } from "../store/appStore";
import { scheduleApi } from "../services/api";
import type { UnifiedPlan } from "../types";
import { format, startOfWeek } from "date-fns";

type DayMode = "single" | "multi" | "week";

// ─── Plan Viewer ──────────────────────────────────────────────────────────────

const PlanViewer: React.FC<{ plan: UnifiedPlan }> = ({ plan }) => {
  const startLabel = format(new Date(plan.start_date + "T00:00:00"), "MMMM d, yyyy");
  const endLabel =
    plan.end_date && plan.end_date !== plan.start_date
      ? ` – ${format(new Date(plan.end_date + "T00:00:00"), "MMMM d, yyyy")}`
      : "";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-0">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-purple-700 text-white print:bg-none print:text-gray-900 print:border-b print:border-gray-200">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200 print:text-gray-500">
          Unified Family Planner
        </p>
        <h2 className="text-lg font-bold mt-0.5">{startLabel}{endLabel}</h2>
        <p className="text-xs text-indigo-300 mt-1 print:hidden">
          Powered by Llama 3.3-70b · includes activities + study sessions
        </p>
      </div>
      <div className="px-6 py-5 prose prose-sm prose-indigo max-w-none study-plan-content overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan.content}</ReactMarkdown>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const PlannerPage: React.FC = () => {
  const { activeFamilyId, members } = useAppStore();
  const students = members.filter((m) => m.role === "student");
  const hasStudents = students.length > 0;

  // ── date / time ──
  const [dayMode, setDayMode] = useState<DayMode>("single");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState("");

  // ── options ──
  const [memberId, setMemberId] = useState<string>("");
  const [relaxMinutes, setRelaxMinutes] = useState("60");
  const [includeStudy, setIncludeStudy] = useState(true);
  const [notes, setNotes] = useState("");

  // ── custom prompt ──
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  // ── output ──
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<UnifiedPlan | null>(null);
  const [history, setHistory] = useState<UnifiedPlan[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!hasStudents) setIncludeStudy(false);
  }, [hasStudents]);

  // ── date mode helpers ──
  const handleDayModeChange = (mode: DayMode) => {
    setDayMode(mode);
    if (mode === "single") {
      setEndDate("");
    } else if (mode === "week") {
      const mon = startOfWeek(new Date(startDate + "T00:00:00"), { weekStartsOn: 1 });
      setStartDate(format(mon, "yyyy-MM-dd"));
      setEndDate(format(new Date(mon.getTime() + 6 * 86400000), "yyyy-MM-dd"));
    } else if (!endDate || endDate < startDate) {
      setEndDate(startDate);
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (dayMode === "week") {
      const mon = startOfWeek(new Date(val + "T00:00:00"), { weekStartsOn: 1 });
      setStartDate(format(mon, "yyyy-MM-dd"));
      setEndDate(format(new Date(mon.getTime() + 6 * 86400000), "yyyy-MM-dd"));
      return;
    }
    if (dayMode === "multi" && endDate && endDate < val) setEndDate(val);
  };

  const generate = async () => {
    if (!activeFamilyId) return;
    setLoading(true);
    try {
      const result = await scheduleApi.generateUnified({
        family_id: activeFamilyId,
        start_date: startDate,
        end_date: dayMode !== "single" && endDate ? endDate : undefined,
        member_id: memberId ? parseInt(memberId) : undefined,
        relax_time_per_day_minutes: parseInt(relaxMinutes) || 60,
        include_study_sessions: includeStudy,
        custom_prompt: customPrompt.trim() || undefined,
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
      <div className="p-8 text-center text-gray-500">
        Please create or select a family first.
      </div>
    );
  }

  const dayModes: { key: DayMode; label: string }[] = [
    { key: "single", label: "Single Day" },
    { key: "multi", label: "Multi-Day" },
    { key: "week", label: "Full Week" },
  ];

  return (
    <div className="p-8">
      {/* Title */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">AI Planner</h1>
          <p className="text-gray-500 text-sm mt-1">
            Unified schedule + study plan in one tabular view
          </p>
        </div>
        {plan && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors print:hidden"
          >
            <Printer size={15} /> Print / PDF
          </button>
        )}
      </div>

      {/* ── Controls ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6 print:hidden">

        {/* Day mode pills */}
        <div className="flex gap-2 mb-5">
          {dayModes.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleDayModeChange(key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                dayMode === key
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
              }`}
            >
              <CalendarDays size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Dates */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {dayMode === "multi" ? "Start Date" : dayMode === "week" ? "Any date in week" : "Date"}
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
            />
            {dayMode === "week" && (
              <p className="text-xs text-gray-400 mt-1">
                Mon {format(new Date(startDate + "T00:00:00"), "MMM d")} –{" "}
                Sun {endDate ? format(new Date(endDate + "T00:00:00"), "MMM d") : ""}
              </p>
            )}
          </div>
          {dayMode === "multi" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                min={startDate}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Focus + Notes */}
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Focus On</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
              <option value="">Entire Family</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Additional Notes</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., early pick-up, game day"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Study sessions toggle */}
        {hasStudents && (
          <div className="mb-4 py-3 px-4 bg-indigo-50 rounded-lg border border-indigo-100">
            <div className="flex flex-wrap items-center gap-4">
              <BookOpen size={15} className="text-indigo-500 flex-shrink-0" />
              <span className="text-sm font-medium text-indigo-800">Study Sessions</span>
              <button
                type="button"
                onClick={() => setIncludeStudy(!includeStudy)}
                className="flex items-center gap-1.5 text-sm text-indigo-700"
              >
                {includeStudy
                  ? <ToggleRight size={22} className="text-indigo-600" />
                  : <ToggleLeft size={22} className="text-gray-400" />}
                {includeStudy ? "Included" : "Excluded"}
              </button>
              {includeStudy && (
                <div className="flex items-center gap-2 ml-auto">
                  <label className="text-xs text-indigo-600 font-medium whitespace-nowrap">
                    Relax time / day
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    className="w-20 border border-indigo-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    value={relaxMinutes}
                    onChange={(e) => setRelaxMinutes(e.target.value)}
                  />
                  <span className="text-xs text-indigo-500">min</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom prompt */}
        <div className="mb-5">
          <button
            type="button"
            onClick={() => setShowCustomPrompt(!showCustomPrompt)}
            className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <SlidersHorizontal size={14} />
            {showCustomPrompt ? "Hide" : "Add"} Daily Routine Prompt
            <ChevronDown size={13} className={`transition-transform ${showCustomPrompt ? "rotate-180" : ""}`} />
          </button>
          {showCustomPrompt && (
            <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-indigo-800">Daily Routine &amp; Preferences</p>
                  <p className="text-xs text-indigo-500 mt-0.5">
                    Describe your baseline structure. AI optimises the unified plan around it.
                  </p>
                </div>
                <button type="button" onClick={() => setCustomPrompt("")} className="text-indigo-400 hover:text-indigo-600 ml-2">
                  <X size={14} />
                </button>
              </div>
              <textarea
                rows={10}
                className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono resize-y"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
              />
            </div>
          )}
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 bg-indigo-600 text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading
            ? <><Loader2 size={16} className="animate-spin" /> Generating unified plan…</>
            : <><Sparkles size={16} /> Generate Unified Plan</>}
        </button>
      </div>

      {/* Output */}
      {plan && <div className="mb-6"><PlanViewer plan={plan} /></div>}

      {/* History */}
      {history.length > 1 && (
        <div className="print:hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors mb-3"
          >
            <ChevronDown size={15} className={`transition-transform ${showHistory ? "rotate-180" : ""}`} />
            Previous Plans ({history.length - 1})
          </button>
          {showHistory && (
            <div className="space-y-4">
              {history.slice(1).map((p, i) => <PlanViewer key={i} plan={p} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
