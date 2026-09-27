import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, CheckCircle2, Clock, FileText, Loader2, Printer, X } from "lucide-react";
import { sampleTestApi, apiErrorMessage } from "../services/api";
import type { SampleTestAttempt, STQuestion } from "../types";

const LETTERS = ["A", "B", "C", "D"];
type Answers = Record<string, number | string | null>;

// Answers are kept locally until submit, so a reload doesn't lose them
const draftKey = (id: number) => `vahxa-sample-draft-${id}`;
const loadDraft = (id: number): Answers => {
  try { return JSON.parse(sessionStorage.getItem(draftKey(id)) || "{}") || {}; } catch { return {}; }
};
const saveDraft = (id: number, a: Answers) => {
  try { sessionStorage.setItem(draftKey(id), JSON.stringify(a)); } catch { /* storage unavailable */ }
};
const utc = (s: string) => new Date(s.endsWith("Z") ? s : s + "Z");
const pct = (score: number, total: number) => (total ? Math.round((100 * score) / total) : 0);

// ─── Question views ───────────────────────────────────────────────────────────

const McqQuestion: React.FC<{ q: STQuestion; n: string; value: number | null; onChange?: (v: number) => void }> = ({ q, n, value, onChange }) => {
  const revealed = q.correct_answer !== null;
  return (
    <fieldset className="break-inside-avoid">
      <legend className="text-sm text-gray-900 font-medium leading-relaxed whitespace-pre-line mb-2">
        <span className="font-bold mr-1.5">{n}.</span>{q.question}
        <span className="ml-2 text-xs font-normal text-gray-400">[{q.marks}]</span>
      </legend>
      <div className="grid gap-1.5">
        {q.options!.map((o, i) => {
          const isRight = revealed && i === q.correct_answer;
          const isWrongPick = revealed && i === value && i !== q.correct_answer;
          return (
            <label key={i} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${
              isRight ? "border-emerald-400 bg-emerald-50" : isWrongPick ? "border-rose-300 bg-rose-50"
                : value === i ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white"} ${revealed ? "" : "cursor-pointer hover:border-indigo-300"}`}>
              <input type="radio" name={q.id} className="mt-0.5 print:hidden" disabled={revealed}
                checked={value === i} onChange={() => onChange?.(i)} />
              <span className="font-semibold text-gray-500">{LETTERS[i]}.</span>
              <span className="flex-1 whitespace-pre-line">{o}</span>
              {isRight && <Check size={15} className="text-emerald-600 flex-shrink-0" />}
              {isWrongPick && <X size={15} className="text-rose-500 flex-shrink-0" />}
            </label>
          );
        })}
      </div>
      {revealed && q.explanation && (
        <p className={`mt-2 text-sm rounded-lg px-3 py-2 ${q.correct ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
          {value === null ? "Not answered. " : q.correct ? "Correct. " : "Incorrect. "}{q.explanation}
        </p>
      )}
    </fieldset>
  );
};

const WrittenQuestion: React.FC<{ q: STQuestion; n: string; value: string; onChange: (v: string) => void; long: boolean }> = ({ q, n, value, onChange, long }) => (
  <div className="break-inside-avoid">
    <p className="text-sm text-gray-900 font-medium leading-relaxed whitespace-pre-line mb-2">
      <span className="font-bold mr-1.5">{n}.</span>{q.question}
      <span className="ml-2 text-xs font-normal text-gray-400">[{q.marks} marks]</span>
    </p>
    <textarea rows={long ? 8 : 4} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder="Type your answer, or work on paper and leave this blank"
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 print:hidden" />
    {/* Printed papers get lined answer space instead of the text box */}
    <div className="hidden print:block">
      {Array.from({ length: long ? 12 : 5 }).map((_, i) => <div key={i} className="border-b border-gray-300 h-7" />)}
    </div>
  </div>
);

// Self-marking: tick the marking points earned
const MarkWritten: React.FC<{ q: STQuestion; n: string; ticks: boolean[]; onToggle: (i: number) => void; locked: boolean }> = ({ q, n, ticks, onToggle, locked }) => {
  const awarded = Math.min(q.marks, q.marking_points!.reduce((sum, p, i) => sum + (ticks[i] ? p.marks : 0), 0));
  return (
    <div className="break-inside-avoid rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-900 font-medium leading-relaxed whitespace-pre-line">
          <span className="font-bold mr-1.5">{n}.</span>{q.question}
        </p>
        <span className="text-sm font-bold text-indigo-700 whitespace-nowrap">{awarded}/{q.marks}</span>
      </div>
      <div className="mt-3 grid md:grid-cols-2 gap-3">
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Your answer</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">{(q.your_answer as string) || <i className="text-gray-400">No typed answer — use your paper working.</i>}</p>
        </div>
        <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 px-3 py-2">
          <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-1">Model answer</p>
          <p className="text-sm text-gray-800 whitespace-pre-line">{q.model_answer}</p>
        </div>
      </div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1.5">Marking scheme — tick what your answer earned</p>
      <div className="space-y-1.5">
        {q.marking_points!.map((p, i) => (
          <label key={i} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${ticks[i] ? "border-indigo-300 bg-indigo-50/60" : "border-gray-200"} ${locked ? "" : "cursor-pointer"}`}>
            <input type="checkbox" className="mt-0.5" checked={!!ticks[i]} disabled={locked} onChange={() => onToggle(i)} />
            <span className="flex-1">{p.point}</span>
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">{p.marks} mark{p.marks > 1 ? "s" : ""}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const SampleTestPage: React.FC = () => {
  const attemptId = Number(useParams().attemptId);
  const [attempt, setAttempt] = useState<SampleTestAttempt | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [ticks, setTicks] = useState<Record<string, boolean[]>>({});
  const [editingMarks, setEditingMarks] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const submittedRef = useRef(false);

  const initTicks = (a: SampleTestAttempt) => {
    // Pre-tick from saved marks (first N points summing to the awarded marks), so re-marking starts where you left off
    const t: Record<string, boolean[]> = {};
    for (const s of a.sections) for (const q of s.questions) {
      if (!q.marking_points) continue;
      let left = q.awarded ?? 0;
      t[q.id] = q.marking_points.map((p) => { const take = left >= p.marks; if (take) left -= p.marks; return take; });
    }
    setTicks(t);
  };

  useEffect(() => {
    submittedRef.current = false;
    sampleTestApi.get(attemptId).then((a) => {
      setAttempt(a);
      if (!a.submitted_at) setAnswers(loadDraft(a.id));
      else initTicks(a);
    }).catch((err) => setError(apiErrorMessage(err, "Could not load this test.")));
  }, [attemptId]);

  const submit = useCallback(async () => {
    if (!attempt || submittedRef.current) return;
    submittedRef.current = true;
    setBusy(true); setError(null);
    try {
      const done = await sampleTestApi.submit(attempt.id, answers);
      try { sessionStorage.removeItem(draftKey(attempt.id)); } catch { /* ignore */ }
      setAttempt(done); initTicks(done); setEditingMarks(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      submittedRef.current = false;
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [attempt, answers]);

  // Countdown for timed attempts (auto-submits at zero)
  const expiresAt = attempt?.expires_at && !attempt.submitted_at ? utc(attempt.expires_at).getTime() : null;
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const remaining = expiresAt ? Math.max(0, Math.round((expiresAt - now) / 1000)) : null;
  useEffect(() => { if (remaining === 0) submit(); }, [remaining, submit]);

  if (error && !attempt) return <div className="p-4 sm:p-6 lg:p-8 text-sm text-red-600">{error}</div>;
  if (!attempt) return <div className="p-4 sm:p-6 lg:p-8 text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>;

  const submitted = !!attempt.submitted_at;
  const setAnswer = (id: string, v: number | string) => {
    const next = { ...answers, [id]: v };
    setAnswers(next);
    saveDraft(attempt.id, next);
  };
  const confirmSubmit = () => {
    const unansweredMcq = attempt.sections.filter((s) => s.type === "mcq")
      .flatMap((s) => s.questions).filter((q) => answers[q.id] === undefined || answers[q.id] === null).length;
    const msg = unansweredMcq
      ? `${unansweredMcq} multiple-choice question${unansweredMcq > 1 ? "s are" : " is"} unanswered. Submit and see the answers?`
      : "Submit the test and see the answers?";
    if (window.confirm(msg)) submit();
  };

  const written = attempt.sections.filter((s) => s.type !== "mcq").flatMap((s) => s.questions);
  const writtenAwarded = written.reduce((sum, q) => sum + Math.min(q.marks,
    (q.marking_points ?? []).reduce((s2, p, i) => s2 + (ticks[q.id]?.[i] ? p.marks : 0), 0)), 0);
  const saveMarks = async () => {
    setBusy(true); setError(null);
    try {
      const marks: Record<string, number> = {};
      for (const q of written) marks[q.id] = Math.min(q.marks, (q.marking_points ?? []).reduce((s, p, i) => s + (ticks[q.id]?.[i] ? p.marks : 0), 0));
      const updated = await sampleTestApi.selfMark(attempt.id, marks);
      setAttempt(updated); setEditingMarks(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const marking = submitted && (!attempt.marked_at || editingMarks);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto print:p-0 print:max-w-none">
      <div className="flex items-center justify-between gap-3 mb-4 print:hidden">
        <Link to={`/study-planner/subjects/${attempt.subject_id}`} className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800">
          <ArrowLeft size={14} /> Subject
        </Link>
        <div className="flex items-center gap-2">
          {remaining !== null && (
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums rounded-full px-3 py-1 ${
              remaining <= 60 ? "bg-rose-100 text-rose-700" : "bg-indigo-50 text-indigo-700"}`} aria-live="polite">
              <Clock size={14} /> {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
            </span>
          )}
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50">
            <Printer size={13} /> {submitted ? "Print answer key" : "Print paper"}
          </button>
        </div>
      </div>

      {/* Paper header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 mb-5 print:shadow-none print:border-0 print:p-0">
        <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide flex items-center gap-1.5"><FileText size={13} /> Sample Test {attempt.number} · {attempt.unit_title}</p>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{attempt.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{attempt.total_marks} marks · suggested time {attempt.duration_minutes} minutes</p>
        {attempt.instructions && <p className="text-sm text-gray-700 mt-3 whitespace-pre-line">{attempt.instructions}</p>}
        <p className="hidden print:block text-sm mt-3">Name: ______________________ &nbsp; Date: ____________ &nbsp; Score: ______ / {attempt.total_marks}</p>
      </div>

      {/* Scores */}
      {submitted && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 print:hidden">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-extrabold text-gray-800">{attempt.mcq_score}<span className="text-base text-gray-400">/{attempt.mcq_marks}</span></p>
              <p className="text-xs text-gray-500">Multiple choice</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-800">{marking ? writtenAwarded : attempt.written_score}<span className="text-base text-gray-400">/{attempt.written_marks}</span></p>
              <p className="text-xs text-gray-500">Written {marking ? "(marking…)" : "(self-marked)"}</p>
            </div>
            <div>
              {attempt.total_score !== null && !marking ? (
                <>
                  <p className={`text-2xl font-extrabold ${pct(attempt.total_score, attempt.total_marks) >= 75 ? "text-emerald-600" : pct(attempt.total_score, attempt.total_marks) >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                    {pct(attempt.total_score, attempt.total_marks)}%
                  </p>
                  <p className="text-xs text-gray-500">{attempt.total_score}/{attempt.total_marks} total</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-extrabold text-gray-300">—</p>
                  <p className="text-xs text-gray-500">Total after marking</p>
                </>
              )}
            </div>
          </div>
          {attempt.timed_out && <p className="text-xs text-rose-500 text-center mt-2">Submitted after the time limit.</p>}
          {marking ? (
            <p className="text-sm text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2 mt-4">
              Multiple choice is marked. Now mark your written answers below: compare with the model answer and tick each point you earned.
            </p>
          ) : (
            <button onClick={() => setEditingMarks(true)} className="block mx-auto mt-3 text-xs text-gray-500 hover:text-indigo-600">Change my marks</button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-3 print:hidden">{error}</p>}

      {/* Sections */}
      <div className="space-y-5">
        {attempt.sections.map((sec) => (
          <section key={sec.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 print:shadow-none print:border-0 print:p-0 print:break-inside-auto">
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <h2 className="text-base font-bold text-gray-800">{sec.title}</h2>
              <span className="text-xs text-gray-400 whitespace-nowrap">{sec.marks} marks</span>
            </div>
            {sec.instructions && <p className="text-xs text-gray-500 mb-4">{sec.instructions}</p>}
            <div className="space-y-5">
              {sec.questions.map((q) => {
                const n = q.id;
                if (sec.type === "mcq") {
                  const v = submitted ? (q.your_answer as number | null) : (answers[q.id] as number | undefined) ?? null;
                  return <McqQuestion key={q.id} q={q} n={n} value={v} onChange={(i) => setAnswer(q.id, i)} />;
                }
                if (submitted) {
                  return (
                    <MarkWritten key={q.id} q={q} n={n} ticks={ticks[q.id] ?? []} locked={!marking}
                      onToggle={(i) => setTicks((t) => ({ ...t, [q.id]: (t[q.id] ?? []).map((v, j) => (j === i ? !v : v)) }))} />
                  );
                }
                return <WrittenQuestion key={q.id} q={q} n={n} long={sec.type === "long"}
                  value={(answers[q.id] as string) ?? ""} onChange={(v) => setAnswer(q.id, v)} />;
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex justify-end print:hidden">
        {!submitted ? (
          <button onClick={confirmSubmit} disabled={busy}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white rounded-xl px-6 py-3 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Submit & see answers
          </button>
        ) : marking ? (
          <button onClick={saveMarks} disabled={busy}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white rounded-xl px-6 py-3 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Save my marks ({attempt.mcq_score! + writtenAwarded}/{attempt.total_marks})
          </button>
        ) : (
          <Link to={`/study-planner/subjects/${attempt.subject_id}`}
            className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-gray-50">
            Back to subject
          </Link>
        )}
      </div>
    </div>
  );
};
