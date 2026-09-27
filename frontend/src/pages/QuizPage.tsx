import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, Loader2, RotateCcw, Trophy, X } from "lucide-react";
import { quizApi, apiErrorMessage } from "../services/api";
import type { Attempt, AttemptQuestion } from "../types";

const LETTERS = ["A", "B", "C", "D"];
const DIFF_STYLE: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700", medium: "bg-amber-100 text-amber-700", hard: "bg-rose-100 text-rose-700",
};

// Test answers are kept locally until submit, so a reload doesn't lose them
const draftKey = (id: number) => `vahxa-test-draft-${id}`;
const loadDraft = (id: number, n: number): (number | null)[] => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(draftKey(id)) || "null");
    if (Array.isArray(saved) && saved.length === n) return saved;
  } catch { /* storage unavailable */ }
  return Array(n).fill(null);
};
const saveDraft = (id: number, answers: (number | null)[]) => {
  try { sessionStorage.setItem(draftKey(id), JSON.stringify(answers)); } catch { /* ignore */ }
};

const utc = (s: string) => new Date(s.endsWith("Z") ? s : s + "Z");

// ─── Option button ────────────────────────────────────────────────────────────

const Option: React.FC<{
  label: string; text: string; state: "idle" | "selected" | "correct" | "wrong" | "missed";
  disabled?: boolean; onClick?: () => void;
}> = ({ label, text, state, disabled, onClick }) => {
  const style = {
    idle: "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40",
    selected: "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200",
    correct: "border-emerald-500 bg-emerald-50",
    wrong: "border-rose-400 bg-rose-50",
    missed: "border-emerald-400 border-dashed bg-emerald-50/50",
  }[state];
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`w-full text-left flex items-start gap-3 rounded-xl border-2 px-3.5 py-3 min-h-[3.25rem] transition-colors disabled:cursor-default ${style}`}>
      <span className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center flex-shrink-0 ${
        state === "correct" || state === "missed" ? "bg-emerald-500 text-white" : state === "wrong" ? "bg-rose-500 text-white"
          : state === "selected" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>
        {state === "correct" || state === "missed" ? <Check size={14} /> : state === "wrong" ? <X size={14} /> : label}
      </span>
      <span className="text-sm text-gray-800 leading-relaxed pt-0.5 whitespace-pre-line">{text}</span>
    </button>
  );
};

const QuestionHeader: React.FC<{ q: AttemptQuestion; n: number; total: number; showUnit: boolean }> = ({ q, n, total, showUnit }) => (
  <div className="flex items-center gap-2 flex-wrap mb-3">
    <span className="text-xs font-semibold text-gray-500">Question {n} of {total}</span>
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${DIFF_STYLE[q.difficulty] ?? DIFF_STYLE.medium}`}>{q.difficulty}</span>
    {showUnit && <span className="text-xs text-gray-400 truncate">· {q.unit_title}</span>}
  </div>
);

const Explanation: React.FC<{ q: AttemptQuestion }> = ({ q }) => (
  <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${q.correct ? "bg-emerald-50 border border-emerald-100" : "bg-rose-50 border border-rose-100"}`}>
    <p className={`font-semibold mb-1 ${q.correct ? "text-emerald-700" : "text-rose-700"}`}>
      {q.your_answer === null ? `Not answered — the answer is ${LETTERS[q.correct_answer!]}` : q.correct ? "Correct!" : `Not quite — the answer is ${LETTERS[q.correct_answer!]}`}
    </p>
    {q.explanation && <p className="text-gray-700 leading-relaxed whitespace-pre-line">{q.explanation}</p>}
  </div>
);

const optionState = (q: AttemptQuestion, i: number): "idle" | "correct" | "wrong" | "missed" => {
  if (q.correct_answer === null) return "idle";
  if (i === q.correct_answer) return q.your_answer === i ? "correct" : "missed";
  return q.your_answer === i ? "wrong" : "idle";
};

// ─── Results ──────────────────────────────────────────────────────────────────

const Results: React.FC<{ attempt: Attempt; onRetake: () => void; retaking: boolean }> = ({ attempt, onRetake, retaking }) => {
  const pct = attempt.total ? Math.round((100 * (attempt.score ?? 0)) / attempt.total) : 0;
  const [filter, setFilter] = useState<"all" | "wrong">("all");
  const shown = attempt.questions.filter((q) => filter === "all" || !q.correct);
  const message = pct >= 90 ? "Outstanding!" : pct >= 75 ? "Great work!" : pct >= 50 ? "Good effort — review the misses below." : "Keep practising — the explanations below will help.";
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
        <Trophy size={32} className={`mx-auto mb-2 ${pct >= 75 ? "text-amber-400" : "text-indigo-300"}`} />
        <p className="text-4xl font-extrabold text-gray-800">{attempt.score}<span className="text-gray-400 text-2xl">/{attempt.total}</span></p>
        <p className={`text-sm font-semibold mt-1 ${pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-rose-600"}`}>{pct}% · {message}</p>
        {attempt.timed_out && <p className="text-xs text-rose-500 mt-1">Submitted after the time limit.</p>}
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <button onClick={onRetake} disabled={retaking}
            className="inline-flex items-center gap-1.5 bg-indigo-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {retaking ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
            {attempt.kind === "quiz" ? "New quiz" : "Take another test"}
          </button>
          <Link to={`/study-planner/subjects/${attempt.subject_id}`}
            className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-700 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-50">
            Back to subject
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Review</h2>
        <div className="flex gap-1 text-xs">
          {(["all", "wrong"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 border ${filter === f ? "bg-indigo-600 text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`}>
              {f === "all" ? `All (${attempt.total})` : `Missed (${attempt.questions.filter((q) => !q.correct).length})`}
            </button>
          ))}
        </div>
      </div>
      {shown.map((q) => (
        <div key={q.index} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <QuestionHeader q={q} n={q.index + 1} total={attempt.total} showUnit={attempt.kind === "test"} />
          <p className="text-sm sm:text-base text-gray-900 font-medium leading-relaxed whitespace-pre-line mb-3">{q.question}</p>
          <div className="space-y-2">
            {q.options.map((o, i) => <Option key={i} label={LETTERS[i]} text={o} state={optionState(q, i)} disabled />)}
          </div>
          <Explanation q={q} />
        </div>
      ))}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const QuizPage: React.FC = () => {
  const params = useParams();
  const attemptId = Number(params.attemptId);
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const [draft, setDraft] = useState<(number | null)[]>([]);
  const [now, setNow] = useState(Date.now());
  const submittedRef = useRef(false);

  useEffect(() => {
    submittedRef.current = false;
    setAttempt(null);
    quizApi.get(attemptId).then((a) => {
      setAttempt(a);
      if (a.kind === "test") setDraft(loadDraft(a.id, a.total));
      const firstOpen = a.questions.findIndex((q) => q.your_answer === null);
      setCurrent(a.kind === "quiz" && firstOpen >= 0 ? firstOpen : 0);
    }).catch((err) => setError(apiErrorMessage(err, "Could not load this attempt.")));
  }, [attemptId]);

  const submit = useCallback(async () => {
    if (!attempt || submittedRef.current) return;
    submittedRef.current = true;
    setBusy(true); setError(null);
    try {
      const done = await quizApi.submit(attempt.id, attempt.kind === "test" ? draft : undefined);
      try { sessionStorage.removeItem(draftKey(attempt.id)); } catch { /* ignore */ }
      setAttempt(done);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      submittedRef.current = false;
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [attempt, draft]);

  // Countdown for timed tests (auto-submits at zero)
  const expiresAt = attempt?.expires_at && !attempt.submitted_at ? utc(attempt.expires_at).getTime() : null;
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const remaining = expiresAt ? Math.max(0, Math.round((expiresAt - now) / 1000)) : null;
  useEffect(() => { if (remaining === 0) submit(); }, [remaining, submit]);

  const answeredCount = useMemo(() => {
    if (!attempt) return 0;
    return attempt.kind === "test" ? draft.filter((d) => d !== null).length
      : attempt.questions.filter((q) => q.your_answer !== null).length;
  }, [attempt, draft]);

  const retake = async () => {
    if (!attempt) return;
    if (attempt.kind === "test") { navigate(`/study-planner/subjects/${attempt.subject_id}?test=1`); return; }
    setRetaking(true);
    try {
      const next = await quizApi.startQuiz(attempt.subject_id, attempt.unit_ids[0]);
      navigate(`/study-planner/subjects/${attempt.subject_id}/attempts/${next.id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setRetaking(false);
    }
  };

  if (error && !attempt) return <div className="p-4 sm:p-6 lg:p-8 text-sm text-red-600">{error}</div>;
  if (!attempt) return <div className="p-4 sm:p-6 lg:p-8 text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>;

  const title = attempt.kind === "quiz" ? `Unit quiz — ${attempt.questions[0]?.unit_title ?? ""}` : "Subject test";
  const header = (
    <div className="flex items-center justify-between gap-3 mb-4">
      <Link to={`/study-planner/subjects/${attempt.subject_id}`} className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800">
        <ArrowLeft size={14} /> Subject
      </Link>
      {remaining !== null && (
        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums rounded-full px-3 py-1 ${
          remaining <= 60 ? "bg-rose-100 text-rose-700" : "bg-indigo-50 text-indigo-700"}`} aria-live="polite">
          <Clock size={14} /> {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </span>
      )}
    </div>
  );

  if (attempt.submitted_at) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        {header}
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">{title} — results</h1>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <Results attempt={attempt} onRetake={retake} retaking={retaking} />
      </div>
    );
  }

  const q = attempt.questions[current];
  const isQuiz = attempt.kind === "quiz";
  const revealed = isQuiz && q.correct_answer !== null;
  const chosen = isQuiz ? q.your_answer : draft[current];

  const choose = async (i: number) => {
    if (isQuiz) {
      if (revealed || busy) return;
      setBusy(true); setError(null);
      try {
        const updated = await quizApi.answer(attempt.id, current, i);
        setAttempt((a) => a && { ...a, questions: a.questions.map((x) => (x.index === updated.index ? updated : x)) });
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        setBusy(false);
      }
    } else {
      const next = draft.map((d, idx) => (idx === current ? i : d));
      setDraft(next);
      saveDraft(attempt.id, next);
    }
  };

  const confirmSubmit = () => {
    const unanswered = attempt.total - answeredCount;
    if (unanswered > 0 && !window.confirm(`${unanswered} question${unanswered > 1 ? "s are" : " is"} unanswered. Submit anyway?`)) return;
    submit();
  };

  const last = current === attempt.total - 1;
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      {header}
      <h1 className="text-lg sm:text-xl font-bold text-gray-800 mb-1">{title}</h1>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-5" role="progressbar"
        aria-valuemin={0} aria-valuemax={attempt.total} aria-valuenow={answeredCount}>
        <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all" style={{ width: `${(100 * answeredCount) / attempt.total}%` }} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
        <QuestionHeader q={q} n={current + 1} total={attempt.total} showUnit={!isQuiz} />
        <p className="text-base text-gray-900 font-medium leading-relaxed whitespace-pre-line mb-4">{q.question}</p>
        <div className="space-y-2.5">
          {q.options.map((o, i) => (
            <Option key={i} label={LETTERS[i]} text={o} disabled={revealed || busy}
              state={revealed ? optionState(q, i) : chosen === i ? "selected" : "idle"}
              onClick={() => choose(i)} />
          ))}
        </div>
        {revealed && <Explanation q={q} />}
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex items-center justify-between gap-3 mt-5">
          <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}
            className="inline-flex items-center gap-1 text-sm text-gray-600 px-3 py-2.5 rounded-xl hover:bg-gray-50 disabled:opacity-30">
            <ChevronLeft size={16} /> Back
          </button>
          {last ? (
            <button onClick={isQuiz ? submit : confirmSubmit} disabled={busy || (isQuiz && !revealed)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {isQuiz ? "See results" : "Submit test"}
            </button>
          ) : (
            <button onClick={() => setCurrent((c) => c + 1)} disabled={isQuiz && !revealed}
              className="inline-flex items-center gap-1 bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40">
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      {!isQuiz && (
        <div className="mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500">{answeredCount} of {attempt.total} answered</p>
            <button onClick={confirmSubmit} disabled={busy}
              className="text-xs font-semibold text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-50 disabled:opacity-40">
              Submit test
            </button>
          </div>
          <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
            {attempt.questions.map((x) => (
              <button key={x.index} onClick={() => setCurrent(x.index)} aria-label={`Question ${x.index + 1}`}
                className={`h-9 rounded-lg text-xs font-semibold border ${
                  x.index === current ? "border-indigo-500 ring-2 ring-indigo-200" : "border-transparent"} ${
                  draft[x.index] !== null ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                {x.index + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
