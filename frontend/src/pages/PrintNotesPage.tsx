import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Loader2, Printer, Sigma } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { subjectApi, curriculumApi, apiErrorMessage } from "../services/api";
import type { Subject, Curriculum, CurriculumUnit } from "../types";

type Mode = "notes" | "formulas";

const NOTE_LOAD_CONCURRENCY = 2;

/** Printable study notes for one unit (?unit=ID) or the whole subject. */
export const PrintNotesPage: React.FC = () => {
  const subjectId = Number(useParams().subjectId);
  const [params] = useSearchParams();
  const unitParam = params.get("unit");
  const onlyUnitId = unitParam ? Number(unitParam) : null;
  const { student } = useAppStore();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>(params.get("mode") === "formulas" ? "formulas" : "notes");
  const [includePractice, setIncludePractice] = useState(false);
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [pageBreaks, setPageBreaks] = useState(false);
  const [loading, setLoading] = useState<{ done: number; total: number } | null>(null);
  const [loadErrors, setLoadErrors] = useState(0);

  useEffect(() => {
    Promise.all([subjectApi.get(subjectId), curriculumApi.get(subjectId)])
      .then(([s, c]) => { setSubject(s); setCurriculum(c); })
      .catch((err) => setError(apiErrorMessage(err, "Could not load this subject.")));
  }, [subjectId]);

  const units = useMemo(
    () => (curriculum?.units ?? []).filter((u) => onlyUnitId === null || u.id === onlyUnitId),
    [curriculum, onlyUnitId],
  );
  const missing = units.filter((u) => !u.details);

  const replaceUnit = (updated: CurriculumUnit) =>
    setCurriculum((c) => c && { ...c, units: c.units.map((u) => (u.id === updated.id ? updated : u)) });

  /** Load notes for units that don't have them yet (shared library first, else AI), a few at a time. */
  const loadMissing = async () => {
    const queue = [...missing];
    const total = queue.length;
    let done = 0, failed = 0;
    setLoading({ done, total });
    setLoadErrors(0);
    const worker = async () => {
      for (let u = queue.shift(); u; u = queue.shift()) {
        try {
          replaceUnit(await curriculumApi.generateUnitDetails(subjectId, u.id));
          if (includePractice && !u.practice) replaceUnit(await curriculumApi.generateUnitPractice(subjectId, u.id));
        } catch {
          failed += 1;
        }
        done += 1;
        setLoading({ done, total });
      }
    };
    await Promise.all(Array.from({ length: NOTE_LOAD_CONCURRENCY }, worker));
    setLoadErrors(failed);
    setLoading(null);
  };

  const loadMissingPractice = async () => {
    const need = units.filter((u) => u.details && !u.practice);
    setLoading({ done: 0, total: need.length });
    let done = 0;
    for (const u of need) {
      try { replaceUnit(await curriculumApi.generateUnitPractice(subjectId, u.id)); } catch { /* skip */ }
      done += 1;
      setLoading({ done, total: need.length });
    }
    setLoading(null);
  };

  if (error) return <div className="p-4 sm:p-6 lg:p-8 text-sm text-red-600">{error}</div>;
  if (!subject || !curriculum) {
    return <div className="p-4 sm:p-6 lg:p-8 text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>;
  }

  const single = onlyUnitId !== null ? units[0] : null;
  const withNotes = units.filter((u) => u.details);
  const practiceMissing = includePractice && mode === "notes" ? withNotes.filter((u) => !u.practice).length : 0;
  const context = [student?.grade, student?.school, [student?.state, student?.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  const formulaCount = withNotes.reduce((n, u) => n + (u.details?.formulas.length ?? 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto print:p-0 print:max-w-none">
      {/* ── Toolbar (screen only) ──────────────────────────────────────────── */}
      <div className="print:hidden mb-6 space-y-4">
        <Link to={`/study-planner/subjects/${subjectId}`} className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800">
          <ArrowLeft size={14} /> {subject.name}
        </Link>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-bold text-gray-800">Print {single ? "unit notes" : "subject notes"}</h1>
            <button onClick={() => window.print()} disabled={withNotes.length === 0 || loading !== null}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              <Printer size={15} /> Print / Save as PDF
            </button>
          </div>

          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What to print">
            {([["notes", "Full notes"], ["formulas", "Formula sheet only"]] as const).map(([m, label]) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                className={`text-sm rounded-full px-4 py-1.5 border ${mode === m ? "bg-indigo-600 text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"}`}>
                {label}
              </button>
            ))}
          </div>

          {mode === "notes" && (
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={includePractice} onChange={(e) => setIncludePractice(e.target.checked)} /> Include practice questions</label>
              {includePractice && (
                <label className="flex items-center gap-2"><input type="checkbox" checked={includeAnswers} onChange={(e) => setIncludeAnswers(e.target.checked)} /> with answers</label>
              )}
              {!single && (
                <label className="flex items-center gap-2"><input type="checkbox" checked={pageBreaks} onChange={(e) => setPageBreaks(e.target.checked)} /> Start each unit on a new page</label>
              )}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-600 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-indigo-500" /> Loading notes… {loading.done} of {loading.total}
            </p>
          ) : missing.length > 0 ? (
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5 text-sm text-amber-800 flex flex-wrap items-center gap-3">
              <span className="flex-1 min-w-[12rem]">
                {missing.length} of {units.length} unit{units.length > 1 ? "s don't" : " doesn't"} have notes yet{withNotes.length ? " and won't be printed" : ""}.
              </span>
              <button onClick={loadMissing} className="text-xs font-semibold bg-amber-600 text-white rounded-lg px-3 py-1.5 hover:bg-amber-700">
                Load missing notes
              </button>
            </div>
          ) : practiceMissing > 0 ? (
            <div className="rounded-lg bg-sky-50 border border-sky-100 px-3 py-2.5 text-sm text-sky-800 flex flex-wrap items-center gap-3">
              <span className="flex-1">{practiceMissing} unit{practiceMissing > 1 ? "s have" : " has"} no practice questions yet.</span>
              <button onClick={loadMissingPractice} className="text-xs font-semibold bg-sky-600 text-white rounded-lg px-3 py-1.5 hover:bg-sky-700">Load them</button>
            </div>
          ) : null}
          {loadErrors > 0 && <p className="text-sm text-red-600">{loadErrors} unit{loadErrors > 1 ? "s" : ""} couldn't be loaded — try again.</p>}
          <p className="text-xs text-gray-400">Tip: choose "Save as PDF" in the print dialog to keep a copy.</p>
        </div>
      </div>

      {/* ── Printable document ─────────────────────────────────────────────── */}
      <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 print:shadow-none print:border-0 print:rounded-none print:p-0 text-gray-900">
        <header className="border-b-2 border-gray-800 pb-3 mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-500">
            {mode === "formulas" ? "Formula sheet" : "Study notes"}{curriculum.framework ? ` · ${curriculum.framework}` : ""}
          </p>
          <h1 className="text-2xl font-bold mt-1">{subject.name}{single ? ` — ${single.title}` : ""}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {[student?.name, context, format(new Date(), "MMMM d, yyyy")].filter(Boolean).join(" · ")}
          </p>
        </header>

        {withNotes.length === 0 ? (
          <p className="text-sm text-gray-500">No notes to print yet — load the notes above first.</p>
        ) : mode === "formulas" ? (
          formulaCount === 0 ? (
            <p className="text-sm text-gray-500">These units have no formulas.</p>
          ) : (
            <div className="space-y-5 print:columns-2 print:gap-8">
              {withNotes.filter((u) => u.details!.formulas.length).map((u) => (
                <section key={u.id} className="break-inside-avoid">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-2 flex items-center gap-1.5">
                    <Sigma size={13} className="print:hidden" /> {u.title}
                  </h2>
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      {u.details!.formulas.map((f, i) => (
                        <tr key={i} className="border-t border-gray-200 align-top break-inside-avoid">
                          <td className="py-1.5 pr-3 text-gray-600 w-2/5">{f.name}</td>
                          <td className="py-1.5 font-mono font-semibold break-words">{f.expression}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-8">
            {withNotes.map((u, idx) => {
              const d = u.details!;
              const n = (curriculum.units.findIndex((x) => x.id === u.id) ?? idx) + 1;
              return (
                <section key={u.id} className={pageBreaks && idx > 0 ? "print:break-before-page" : ""}>
                  <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-2 break-after-avoid">
                    {single ? "" : `${n}. `}{u.title}
                  </h2>
                  {u.overview && <p className="text-sm text-gray-600 italic mb-3">{u.overview}</p>}

                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1 break-after-avoid">Summary</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-line mb-4">{d.summary}</p>

                  {d.key_concepts.length > 0 && (
                    <>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1 break-after-avoid">Key concepts</h3>
                      <dl className="text-sm mb-4 space-y-1.5">
                        {d.key_concepts.map((c, i) => (
                          <div key={i} className="break-inside-avoid">
                            <dt className="font-semibold inline">{c.name}: </dt>
                            <dd className="inline text-gray-800">{c.explanation}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}

                  {d.formulas.length > 0 && (
                    <>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1 break-after-avoid">Formulas</h3>
                      <table className="w-full text-sm border-collapse mb-4">
                        <tbody>
                          {d.formulas.map((f, i) => (
                            <tr key={i} className="border-t border-gray-200 align-top break-inside-avoid">
                              <td className="py-1.5 pr-3 text-gray-600 w-1/4">{f.name}</td>
                              <td className="py-1.5 pr-3 font-mono font-semibold break-words w-2/5">{f.expression}</td>
                              <td className="py-1.5 text-gray-600 text-xs">{f.explanation}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {includePractice && u.practice && u.practice.length > 0 && (
                    <>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1 break-after-avoid">Practice questions</h3>
                      <ol className="text-sm list-decimal ml-5 space-y-2">
                        {u.practice.map((q, i) => (
                          <li key={i} className="break-inside-avoid">
                            <p className="whitespace-pre-line">{q.question} <span className="text-xs text-gray-400">({q.difficulty})</span></p>
                            {includeAnswers && (
                              <div className="mt-1 pl-3 border-l-2 border-gray-300 text-gray-700">
                                <p><span className="font-semibold">Answer:</span> {q.answer}</p>
                                {q.explanation && <p className="text-xs whitespace-pre-line mt-0.5">{q.explanation}</p>}
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </article>
    </div>
  );
};
