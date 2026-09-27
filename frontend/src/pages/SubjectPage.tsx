import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, BookOpen, ChevronDown, FileText, Lightbulb, Loader2,
  MapPin, RefreshCw, Sigma, Sparkles, AlertTriangle, Check,
} from "lucide-react";
import { useAppStore } from "../store/appStore";
import { subjectApi, curriculumApi, apiErrorMessage } from "../services/api";
import type { Subject, Curriculum, CurriculumUnit } from "../types";

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

  const [openUnitId, setOpenUnitId] = useState<number | null>(null);
  const [loadingUnitId, setLoadingUnitId] = useState<number | null>(null);
  const [unitErrors, setUnitErrors] = useState<Record<number, string>>({});

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
    if (curriculum?.units.length && !window.confirm("Regenerate the unit list? Saved notes for every unit will be replaced.")) return;
    setGenerating(true);
    setError(null);
    try {
      if (syllabusDirty) setSubject(await subjectApi.update(subjectId, { syllabus_text: syllabus.trim() }));
      setCurriculum(await curriculumApi.generate(subjectId));
      setOpenUnitId(null);
      setUnitErrors({});
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const loadUnitNotes = async (unit: CurriculumUnit) => {
    setLoadingUnitId(unit.id);
    setUnitErrors(({ [unit.id]: _, ...rest }) => rest);
    try {
      const updated = await curriculumApi.generateUnitDetails(subjectId, unit.id);
      setCurriculum((c) => c && { ...c, units: c.units.map((u) => (u.id === updated.id ? updated : u)) });
    } catch (err) {
      setUnitErrors((e) => ({ ...e, [unit.id]: apiErrorMessage(err) }));
    } finally {
      setLoadingUnitId(null);
    }
  };

  const toggleUnit = (unit: CurriculumUnit) => {
    if (openUnitId === unit.id) { setOpenUnitId(null); return; }
    setOpenUnitId(unit.id);
    if (!unit.details && loadingUnitId === null) loadUnitNotes(unit);
  };

  if (loadError) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link to="/study-planner" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 mb-4">
          <ArrowLeft size={14} /> Academic Tracker
        </Link>
        <p className="text-sm text-red-600">{loadError}</p>
      </div>
    );
  }
  if (!subject || !curriculum) {
    return <div className="p-8 text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>;
  }

  const hasUnits = curriculum.units.length > 0;

  return (
    <div className="p-8 max-w-4xl mx-auto">
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
          </div>
          {hasUnits && (
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-lg px-3 py-1.5 hover:bg-indigo-50 disabled:opacity-50 transition-colors"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {generating ? "Regenerating…" : "Regenerate"}
            </button>
          )}
        </div>

        {error && <p className="px-5 pt-3 text-sm text-red-600">{error}</p>}

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
                      <span className="block text-sm font-medium text-gray-800">{unit.title}</span>
                      {unit.overview && <span className="block text-xs text-gray-500 mt-0.5">{unit.overview}</span>}
                    </span>
                    <ChevronDown size={15} className={`text-gray-400 flex-shrink-0 mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>

                  {open && (
                    <div className="px-5 pb-5 pl-14">
                      {loading ? (
                        <p className="flex items-center gap-2 text-sm text-gray-500 py-3">
                          <Loader2 size={14} className="animate-spin text-indigo-500" />
                          Writing notes — summary, key concepts and formulas…
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
                          <div className="flex justify-end mt-4">
                            <button
                              onClick={() => loadUnitNotes(unit)}
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
    </div>
  );
};
