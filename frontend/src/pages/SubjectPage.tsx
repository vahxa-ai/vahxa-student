import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft, BookOpen, ChevronDown, FileText, Lightbulb, Loader2,
  MapPin, RefreshCw, Sigma, Sparkles, AlertTriangle, Check, Users, Zap, HelpCircle, ClipboardCheck, Timer, Trophy,
} from "lucide-react";
import { useAppStore } from "../store/appStore";
import { subjectApi, curriculumApi, quizApi, apiErrorMessage } from "../services/api";
import type { Subject, Curriculum, CurriculumUnit, PracticeQuestion, AttemptSummary } from "../types";

// ─── Practice questions ───────────────────────────────────────────────────────

const DIFFICULTY_STYLE: Record<PracticeQuestion["difficulty"], string> = {
  easy:   "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard:   "bg-rose-100 text-rose-700",
};

const PracticeCard: React.FC<{ q: PracticeQuestion; index: number }> = ({ q, index }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="rounded-lg border border-sky-100 bg-sky-50/40 px-3.5 py-3">
      <div className="flex items-start gap-2">
        <span className="text-xs font-bold text-sky-700 mt-0.5 flex-shrink-0">Q{index + 1}</span>
        <p className="flex-1 text-sm text-gray-800 leading-relaxed whitespace-pre-line">{q.question}</p>
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0 ${DIFFICULTY_STYLE[q.difficulty]}`}>
          {q.difficulty}
        </span>
      </div>
      {revealed ? (
        <div className="mt-3 ml-6 space-y-2">
          <p className="text-sm">
            <span className="font-semibold text-emerald-700">Answer: </span>
            <span className="text-gray-900 whitespace-pre-line">{q.answer}</span>
          </p>
          {q.explanation && (
            <div className="rounded-md bg-white border border-gray-100 px-3 py-2">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Worked solution</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{q.explanation}</p>
            </div>
          )}
          <button onClick={() => setRevealed(false)} className="text-xs text-gray-400 hover:text-gray-600">Hide answer</button>
        </div>
      ) : (
        <button
          onClick={() => setRevealed(true)}
          className="mt-2 ml-6 text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
        >
          Try it first, then show answer →
        </button>
      )}
    </div>
  );
};

// ─── Unit notes ───────────────────────────────────────────────────────────────

const UnitNotes: React.FC<{ unit: CurriculumUnit }> = ({ unit }) => {
  const d = unit.details!;
  return (
    <div className="space-y-5">
      <section>
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          <FileText size={13} className="text-indigo-500" /> Summary
        </h4>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{d.summary}</p>
      </section>

      {d.key_concepts.length > 0 && (
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            <Lightbulb size={13} className="text-amber-500" /> Key Concepts
          </h4>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {d.key_concepts.map((c, i) => (
              <div key={i} className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2.5">
                <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{c.explanation}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {d.formulas.length > 0 && (
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            <Sigma size={13} className="text-violet-500" /> Formulas
          </h4>
          <div className="space-y-2">
            {d.formulas.map((f, i) => (
              <div key={i} className="rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2.5">
                <p className="text-xs font-semibold text-violet-700">{f.name}</p>
                <p className="font-mono text-base text-gray-900 my-1 break-words">{f.expression}</p>
                {f.explanation && <p className="text-xs text-gray-600 leading-relaxed">{f.explanation}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const SubjectPage: React.FC = () => {
  const subjectId = Number(useParams().subjectId);
  const { student } = useAppStore();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [syllabusOpen, setSyllabusOpen] = useState(false);
  const [syllabus, setSyllabus] = useState("");
  const [savingSyllabus, setSavingSyllabus] = useState(false);
  const [syllabusSaved, setSyllabusSaved] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [openUnitId, setOpenUnitId] = useState<number | null>(null);
  const [loadingUnitId, setLoadingUnitId] = useState<number | null>(null);
  const [unitErrors, setUnitErrors] = useState<Record<number, string>>({});
  const [practiceLoadingId, setPracticeLoadingId] = useState<number | null>(null);
  const [practiceErrors, setPracticeErrors] = useState<Record<number, string>>({});

  // quizzes & tests
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [history, setHistory] = useState<AttemptSummary[]>([]);
  const [testOpen, setTestOpen] = useState(searchParams.get("test") === "1");
  const [testUnits, setTestUnits] = useState<number[] | null>(null);   // null = all units
  const [testCount, setTestCount] = useState(20);
  const [testMinutes, setTestMinutes] = useState<number | null>(null);
  const [startingTest, setStartingTest] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [quizBusyId, setQuizBusyId] = useState<number | null>(null);
  const [quizErrors, setQuizErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    quizApi.history(subjectId).then(setHistory).catch(() => setHistory([]));
  }, [subjectId]);

  const bestByUnit = useMemo(() => {
    const best: Record<number, number> = {};
    for (const h of history) {
      if (h.kind === "quiz" && h.percent !== null) best[h.unit_ids[0]] = Math.max(best[h.unit_ids[0]] ?? 0, h.percent);
    }
    return best;
  }, [history]);

  const startQuiz = async (unit: CurriculumUnit) => {
    setQuizBusyId(unit.id);
    setQuizErrors(({ [unit.id]: _, ...rest }) => rest);
    try {
      const attempt = await quizApi.startQuiz(subjectId, unit.id);
      navigate(`/study-planner/subjects/${subjectId}/attempts/${attempt.id}`);
    } catch (err) {
      setQuizErrors((e) => ({ ...e, [unit.id]: apiErrorMessage(err) }));
      setQuizBusyId(null);
    }
  };

  const regenerateQuiz = async (unit: CurriculumUnit) => {
    if (curriculum?.shared && !window.confirm("Write a new set of quiz questions with AI? This replaces them for every student in this grade and region.")) return;
    setQuizBusyId(unit.id);
    setQuizErrors(({ [unit.id]: _, ...rest }) => rest);
    try {
      replaceUnit(await quizApi.prepareUnit(subjectId, unit.id, true));
    } catch (err) {
      setQuizErrors((e) => ({ ...e, [unit.id]: apiErrorMessage(err) }));
    } finally {
      setQuizBusyId(null);
    }
  };

  const startTest = async () => {
    setStartingTest(true);
    setTestError(null);
    try {
      const attempt = await quizApi.startTest(subjectId, {
        unit_ids: testUnits, count: testCount, time_limit_minutes: testMinutes,
      });
      navigate(`/study-planner/subjects/${subjectId}/attempts/${attempt.id}`);
    } catch (err) {
      setTestError(apiErrorMessage(err));
      setStartingTest(false);
    }
  };

  useEffect(() => {
    Promise.all([subjectApi.get(subjectId), curriculumApi.get(subjectId)])
      .then(([s, c]) => {
        setSubject(s);
        setSyllabus(s.syllabus_text ?? "");
        setSyllabusOpen(!!s.syllabus_text);
        setCurriculum(c);
      })
      .catch((err) => setLoadError(apiErrorMessage(err, "Could not load this subject.")));
  }, [subjectId]);

  const location = [student?.county, student?.state, student?.country].filter(Boolean).join(", ");
  const context = [student?.grade, student?.school, location].filter(Boolean).join(" · ");
  const syllabusDirty = (subject?.syllabus_text ?? "") !== syllabus;

  const saveSyllabus = async () => {
    setSavingSyllabus(true);
    try {
      setSubject(await subjectApi.update(subjectId, { syllabus_text: syllabus.trim() }));
      setSyllabusSaved(true);
      setTimeout(() => setSyllabusSaved(false), 2000);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingSyllabus(false);
    }
  };

  const generate = async () => {
    const regenerate = !!curriculum?.units.length;
    if (regenerate && !window.confirm(
      curriculum?.shared
        ? "Regenerate with AI? This replaces the shared curriculum and its notes for every student in this grade and region."
        : "Regenerate the unit list with AI? Saved notes for every unit will be replaced."
    )) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      if (syllabusDirty) setSubject(await subjectApi.update(subjectId, { syllabus_text: syllabus.trim() }));
      const result = await curriculumApi.generate(subjectId, regenerate);
      setCurriculum(result);
      if (result.from_library) setNotice("Loaded instantly from the shared library — another student in your grade and region already built this curriculum.");
      setOpenUnitId(null);
      setUnitErrors({});
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const replaceUnit = (updated: CurriculumUnit) =>
    setCurriculum((c) => c && { ...c, units: c.units.map((u) => (u.id === updated.id ? updated : u)) });

  const loadPractice = async (unit: CurriculumUnit, force = false) => {
    setPracticeLoadingId(unit.id);
    setPracticeErrors(({ [unit.id]: _, ...rest }) => rest);
    try {
      replaceUnit(await curriculumApi.generateUnitPractice(subjectId, unit.id, force));
    } catch (err) {
      setPracticeErrors((e) => ({ ...e, [unit.id]: apiErrorMessage(err) }));
    } finally {
      setPracticeLoadingId(null);
    }
  };

  const loadUnitNotes = async (unit: CurriculumUnit, force = false) => {
    setLoadingUnitId(unit.id);
    setUnitErrors(({ [unit.id]: _, ...rest }) => rest);
    let updated: CurriculumUnit | null = null;
    try {
      updated = await curriculumApi.generateUnitDetails(subjectId, unit.id, force);
      replaceUnit(updated);
    } catch (err) {
      setUnitErrors((e) => ({ ...e, [unit.id]: apiErrorMessage(err) }));
    } finally {
      setLoadingUnitId(null);
    }
    // Practice questions build on the notes, so fetch them once the notes are in
    if (updated && !updated.practice) loadPractice(updated);
  };

  const toggleUnit = (unit: CurriculumUnit) => {
    if (openUnitId === unit.id) { setOpenUnitId(null); return; }
    setOpenUnitId(unit.id);
    if (!unit.details) {
      if (loadingUnitId === null) loadUnitNotes(unit);
    } else if (!unit.practice && practiceLoadingId === null) {
      loadPractice(unit);
    }
  };

  if (loadError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <Link to="/study-planner" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 mb-4">
          <ArrowLeft size={14} /> Academic Tracker
        </Link>
        <p className="text-sm text-red-600">{loadError}</p>
      </div>
    );
  }
  if (!subject || !curriculum) {
    return <div className="p-4 sm:p-6 lg:p-8 text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>;
  }

  const hasUnits = curriculum.units.length > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <Link to="/study-planner" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 mb-4">
        <ArrowLeft size={14} /> Academic Tracker
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 flex-shrink-0">
          <BookOpen size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-800">{subject.name}</h1>
          <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-1 flex-wrap">
            {subject.teacher && <span>Teacher: {subject.teacher} ·</span>}
            {context ? <><MapPin size={11} /> {context}</> : "Curriculum · units · key concepts · formulas"}
          </p>
        </div>
      </div>

      {!location && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5 text-sm text-amber-800">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          <span>
            Add your county, state and country in <Link to="/profile" className="font-semibold underline">My Profile</Link> so
            the curriculum matches your local standards.
          </span>
        </div>
      )}

      {/* Syllabus */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-5">
        <button
          type="button"
          onClick={() => setSyllabusOpen(!syllabusOpen)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
        >
          <span className="flex items-center gap-2">
            <FileText size={15} className="text-indigo-500" />
            Your syllabus <span className="text-xs font-normal text-gray-400">(optional)</span>
            {subject.syllabus_text && <span className="text-xs text-emerald-600 font-medium">• saved</span>}
          </span>
          <ChevronDown size={15} className={`text-gray-400 transition-transform ${syllabusOpen ? "rotate-180" : ""}`} />
        </button>
        {syllabusOpen && (
          <div className="border-t border-gray-100 p-5">
            <p className="text-xs text-gray-500 mb-2">
              Paste your school's syllabus or textbook table of contents. The curriculum will follow its units and order
              exactly. Leave empty to use your region's standards.
            </p>
            <textarea
              rows={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={"Unit 1: Expressions and Equations\nUnit 2: Linear Functions\n…"}
              value={syllabus}
              onChange={(e) => setSyllabus(e.target.value)}
            />
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={saveSyllabus}
                disabled={!syllabusDirty || savingSyllabus}
                className="flex items-center gap-1.5 border border-indigo-300 text-indigo-600 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-indigo-50 disabled:opacity-40 transition-colors"
              >
                {savingSyllabus ? <Loader2 size={12} className="animate-spin" /> : syllabusSaved ? <Check size={12} /> : null}
                {syllabusSaved ? "Saved" : "Save syllabus"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Curriculum */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-700">
              Curriculum{curriculum.framework ? ` — ${curriculum.framework}` : ""}
            </h2>
            {curriculum.source && (
              <p className={`text-xs mt-0.5 ${curriculum.source === "syllabus" ? "text-emerald-600" : "text-amber-600"}`}>
                {curriculum.source === "syllabus"
                  ? "Built from your syllabus"
                  : "AI-inferred from your region's standards — may differ from your school. Add your syllabus for an exact match."}
              </p>
            )}
            {curriculum.shared && (
              <p className="text-xs mt-0.5 text-indigo-500 flex items-center gap-1">
                <Users size={11} /> Shared with students in {[student?.grade, student?.state, student?.country].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {hasUnits && (
            <div className="flex items-center gap-2">
            <button
              onClick={() => setTestOpen((o) => !o)}
              aria-expanded={testOpen}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg px-3 py-1.5 hover:bg-indigo-700 transition-colors"
            >
              <ClipboardCheck size={13} /> Take a test
            </button>
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-lg px-3 py-1.5 hover:bg-indigo-50 disabled:opacity-50 transition-colors"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {generating ? "Regenerating…" : "Regenerate"}
            </button>
            </div>
          )}
        </div>

        {hasUnits && testOpen && (
          <div className="mx-4 sm:mx-5 mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><ClipboardCheck size={15} className="text-indigo-500" /> Subject test</h3>
              <p className="text-xs text-gray-500 mt-0.5">Multiple choice across the units you pick. Answers are revealed when you submit.</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-gray-600">Units</p>
                <button type="button" className="text-xs text-indigo-600 hover:underline"
                  onClick={() => setTestUnits(testUnits === null ? [] : null)}>
                  {testUnits === null ? "Clear all" : "Select all"}
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                {curriculum.units.map((u, i) => {
                  const checked = testUnits === null || testUnits.includes(u.id);
                  return (
                    <label key={u.id} className="flex items-start gap-2 text-sm text-gray-700 rounded-lg bg-white border border-gray-100 px-2.5 py-2 cursor-pointer">
                      <input type="checkbox" className="mt-0.5" checked={checked} onChange={() => {
                        const current = testUnits ?? curriculum.units.map((x) => x.id);
                        const next = checked ? current.filter((id) => id !== u.id) : [...current, u.id];
                        setTestUnits(next.length === curriculum.units.length ? null : next);
                      }} />
                      <span className="min-w-0"><span className="text-gray-400 mr-1">{i + 1}.</span>{u.title}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="text-xs font-semibold text-gray-600">
                Questions
                <select className="block mt-1 border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white" value={testCount}
                  onChange={(e) => setTestCount(Number(e.target.value))}>
                  {[10, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-gray-600">
                <span className="inline-flex items-center gap-1"><Timer size={12} /> Time limit</span>
                <select className="block mt-1 border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white" value={testMinutes ?? ""}
                  onChange={(e) => setTestMinutes(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">No limit</option>
                  {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                </select>
              </label>
            </div>
            {testError && <p className="text-sm text-red-600">{testError}</p>}
            <button onClick={startTest} disabled={startingTest || (testUnits !== null && testUnits.length === 0)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {startingTest ? <><Loader2 size={15} className="animate-spin" /> Preparing questions…</> : "Start test"}
            </button>
            {startingTest && <p className="text-xs text-gray-500">Units without a question bank yet are being prepared — this can take up to a minute the first time.</p>}
          </div>
        )}

        {error && <p className="px-5 pt-3 text-sm text-red-600">{error}</p>}
        {notice && (
          <p className="mx-5 mt-3 flex items-start gap-1.5 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-700">
            <Zap size={13} className="flex-shrink-0 mt-0.5" /> {notice}
          </p>
        )}

        {!hasUnits ? (
          <div className="px-5 py-10 text-center">
            <Sparkles size={28} className="mx-auto text-indigo-300 mb-3" />
            <p className="text-sm text-gray-600 mb-1">No curriculum loaded yet</p>
            <p className="text-xs text-gray-400 mb-5">
              Gemma will lay out this course's units or chapters{syllabus.trim() ? " from your syllabus" : ` for ${context || "your grade and region"}`}.
            </p>
            <button
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity shadow-md shadow-indigo-200"
            >
              {generating
                ? <><Loader2 size={15} className="animate-spin" /> Building curriculum…</>
                : <><Sparkles size={15} /> Load Curriculum</>}
            </button>
          </div>
        ) : (
          <ol className="divide-y divide-gray-100">
            {curriculum.units.map((unit, i) => {
              const open = openUnitId === unit.id;
              const loading = loadingUnitId === unit.id;
              return (
                <li key={unit.id}>
                  <button
                    type="button"
                    onClick={() => toggleUnit(unit)}
                    className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      unit.details ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700"
                    }`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-800">
                        {unit.title}
                        {bestByUnit[unit.id] !== undefined && (
                          <span className={`ml-2 inline-flex items-center gap-0.5 align-middle text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            bestByUnit[unit.id] >= 80 ? "bg-emerald-100 text-emerald-700" : bestByUnit[unit.id] >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                            <Trophy size={9} /> {bestByUnit[unit.id]}%
                          </span>
                        )}
                      </span>
                      {unit.overview && <span className="block text-xs text-gray-500 mt-0.5">{unit.overview}</span>}
                    </span>
                    <ChevronDown size={15} className={`text-gray-400 flex-shrink-0 mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>

                  {open && (
                    <div className="px-4 pb-5 sm:px-5 sm:pl-14">
                      {loading ? (
                        <p className="flex items-center gap-2 text-sm text-gray-500 py-3">
                          <Loader2 size={14} className="animate-spin text-indigo-500" />
                          Loading notes — summary, key concepts and formulas…
                        </p>
                      ) : unitErrors[unit.id] ? (
                        <div className="text-sm py-2">
                          <p className="text-red-600 mb-2">{unitErrors[unit.id]}</p>
                          <button onClick={() => loadUnitNotes(unit)} className="text-xs font-medium text-indigo-600 hover:underline">
                            Try again
                          </button>
                        </div>
                      ) : unit.details ? (
                        <>
                          <UnitNotes unit={unit} />

                          <section className="mt-5">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                <HelpCircle size={13} className="text-sky-500" /> Practice Questions
                              </h4>
                              {unit.practice && (
                                <button
                                  onClick={() => {
                                    if (curriculum.shared && !window.confirm("Generate a new set of questions with AI? This replaces them for every student in this grade and region.")) return;
                                    loadPractice(unit, true);
                                  }}
                                  disabled={practiceLoadingId !== null}
                                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-sky-700 disabled:opacity-40 transition-colors"
                                >
                                  <RefreshCw size={11} /> New questions
                                </button>
                              )}
                            </div>
                            {practiceLoadingId === unit.id ? (
                              <p className="flex items-center gap-2 text-sm text-gray-500 py-2">
                                <Loader2 size={14} className="animate-spin text-sky-500" />
                                Preparing practice questions with worked solutions…
                              </p>
                            ) : practiceErrors[unit.id] ? (
                              <div className="text-sm py-1">
                                <p className="text-red-600 mb-1">{practiceErrors[unit.id]}</p>
                                <button onClick={() => loadPractice(unit)} className="text-xs font-medium text-indigo-600 hover:underline">
                                  Try again
                                </button>
                              </div>
                            ) : unit.practice ? (
                              <div className="space-y-2.5">
                                {unit.practice.map((q, qi) => <PracticeCard key={`${unit.practice_generated_at}-${qi}`} q={q} index={qi} />)}
                              </div>
                            ) : (
                              <button onClick={() => loadPractice(unit)} disabled={practiceLoadingId !== null}
                                className="text-xs font-medium text-sky-700 hover:underline disabled:opacity-40 py-1">
                                Load practice questions
                              </button>
                            )}
                          </section>

                          <section className="mt-5 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                  <ClipboardCheck size={13} className="text-violet-500" /> Unit quiz
                                </h4>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  10 multiple-choice questions with instant feedback
                                  {bestByUnit[unit.id] !== undefined && <> · best score <b>{bestByUnit[unit.id]}%</b></>}
                                </p>
                              </div>
                              <button onClick={() => startQuiz(unit)} disabled={quizBusyId !== null}
                                className="inline-flex items-center gap-1.5 bg-violet-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                                {quizBusyId === unit.id ? <><Loader2 size={14} className="animate-spin" /> {unit.quiz_size ? "Starting…" : "Writing questions…"}</>
                                  : bestByUnit[unit.id] !== undefined ? "Retake quiz" : "Start quiz"}
                              </button>
                            </div>
                            {quizErrors[unit.id] && <p className="text-sm text-red-600 mt-2">{quizErrors[unit.id]}</p>}
                            {unit.quiz_size && (
                              <button onClick={() => regenerateQuiz(unit)} disabled={quizBusyId !== null}
                                className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-violet-700 disabled:opacity-40">
                                <RefreshCw size={11} /> New quiz questions
                              </button>
                            )}
                          </section>

                          <div className="flex justify-end mt-4">
                            <button
                              onClick={() => {
                                if (curriculum.shared && !window.confirm("Regenerate these notes with AI? This replaces them for every student in this grade and region.")) return;
                                loadUnitNotes(unit, true);
                              }}
                              disabled={loadingUnitId !== null}
                              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 disabled:opacity-40 transition-colors"
                            >
                              <RefreshCw size={11} /> Refresh notes
                            </button>
                          </div>
                        </>
                      ) : (
                        <button onClick={() => loadUnitNotes(unit)} disabled={loadingUnitId !== null}
                          className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-40 py-2">
                          Load notes for this unit
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {history.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-5">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Trophy size={15} className="text-amber-500" /> Your results</h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {history.slice(0, 10).map((h) => (
              <li key={h.id}>
                <Link to={`/study-planner/subjects/${subjectId}/attempts/${h.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <span className={`w-12 text-center text-sm font-bold rounded-lg py-1 ${
                    (h.percent ?? 0) >= 80 ? "bg-emerald-100 text-emerald-700" : (h.percent ?? 0) >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                    {h.percent}%
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-gray-800 truncate">
                      {h.kind === "quiz" ? `Quiz — ${h.unit_titles[0]}` : `Test — ${h.unit_titles.length} unit${h.unit_titles.length > 1 ? "s" : ""}`}
                    </span>
                    <span className="block text-xs text-gray-400">
                      {h.score}/{h.total} · {h.submitted_at ? format(new Date(h.submitted_at + "Z"), "MMM d, h:mm a") : ""}{h.timed_out ? " · over time" : ""}
                    </span>
                  </span>
                  <ChevronDown size={14} className="-rotate-90 text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
