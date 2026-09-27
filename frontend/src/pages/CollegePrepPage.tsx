import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Award, BookOpen, Check, ChevronDown, Compass, Info, Loader2, Map as MapIcon, Pencil, Plus, RefreshCw, School, Target,
  Trash2, X,
} from "lucide-react";
import { useAppStore } from "../store/appStore";
import { collegeApi, apiErrorMessage, type AchievementInput } from "../services/api";
import type {
  Achievement, AchievementCategory, AdmissionsGuide, CollegeCategory, CollegeEntry, CollegeProfile, Roadmap,
  RoadmapCategory,
} from "../types";

type Tab = "roadmap" | "guide" | "colleges" | "activities";
const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "roadmap", label: "My roadmap", icon: MapIcon },
  { key: "guide", label: "Admissions guide", icon: BookOpen },
  { key: "colleges", label: "College list", icon: School },
  { key: "activities", label: "Activities", icon: Award },
];

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const card = "bg-white rounded-2xl border border-gray-100 shadow-sm";

const CATEGORY_STYLE: Record<RoadmapCategory, string> = {
  academics: "bg-indigo-100 text-indigo-700", testing: "bg-violet-100 text-violet-700",
  activities: "bg-emerald-100 text-emerald-700", applications: "bg-sky-100 text-sky-700",
  finances: "bg-amber-100 text-amber-700", summer: "bg-orange-100 text-orange-700", wellbeing: "bg-pink-100 text-pink-700",
};

const Busy: React.FC<{ text: string }> = ({ text }) => (
  <p className="text-sm text-gray-500 flex items-center gap-2 py-2"><Loader2 size={15} className="animate-spin text-indigo-500" /> {text}</p>
);
const Err: React.FC<{ msg: string | null }> = ({ msg }) => (msg ? <p className="text-sm text-red-600 mt-2">{msg}</p> : null);

// ─── Goals ────────────────────────────────────────────────────────────────────

const GoalsCard: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CollegeProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    collegeApi.getProfile().then((p) => { setForm(p); if (!p.intended_majors && !p.interests) setOpen(true); })
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  const set = (k: keyof CollegeProfile, v: string) => setForm((f) => f && { ...f, [k]: v });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true); setError(null);
    try {
      setForm(await collegeApi.saveProfile(form));
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (err) { setError(apiErrorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <div className={`${card} mb-5`}>
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-2xl">
        <span className="flex items-center gap-2"><Target size={15} className="text-indigo-500" /> My college goals
          {form?.intended_majors && <span className="text-xs font-normal text-gray-400 truncate">— {form.intended_majors}</span>}
        </span>
        <ChevronDown size={15} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && form && (
        <form onSubmit={save} className="border-t border-gray-100 p-5 space-y-3">
          <p className="text-xs text-gray-500">These personalise your roadmap and college summaries. Everything is optional.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm font-medium text-gray-700">Intended major(s)
              <input className={inputCls + " mt-1"} placeholder="e.g., Computer Science, Biology" value={form.intended_majors ?? ""} onChange={(e) => set("intended_majors", e.target.value)} />
            </label>
            <label className="text-sm font-medium text-gray-700">Career ideas
              <input className={inputCls + " mt-1"} placeholder="e.g., software engineer, doctor" value={form.career_goals ?? ""} onChange={(e) => set("career_goals", e.target.value)} />
            </label>
          </div>
          <label className="block text-sm font-medium text-gray-700">Interests & strengths
            <textarea rows={2} className={inputCls + " mt-1"} placeholder="e.g., robotics, debate, volunteering at the animal shelter" value={form.interests ?? ""} onChange={(e) => set("interests", e.target.value)} />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm font-medium text-gray-700">GPA (optional)
              <input className={inputCls + " mt-1"} maxLength={40} placeholder="e.g., 3.8 unweighted" value={form.gpa ?? ""} onChange={(e) => set("gpa", e.target.value)} />
            </label>
            <label className="text-sm font-medium text-gray-700">Test scores (optional)
              <input className={inputCls + " mt-1"} placeholder="e.g., PSAT 1250" value={form.test_scores ?? ""} onChange={(e) => set("test_scores", e.target.value)} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save goals"}
            </button>
            {saved && <span className="text-sm text-emerald-600 flex items-center gap-1"><Check size={14} /> Saved</span>}
          </div>
          <Err msg={error} />
        </form>
      )}
    </div>
  );
};

// ─── Roadmap ──────────────────────────────────────────────────────────────────

const RoadmapTab: React.FC = () => {
  const [roadmap, setRoadmap] = useState<Roadmap | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => { collegeApi.getRoadmap().then(setRoadmap).catch((err) => { setRoadmap(null); setError(apiErrorMessage(err)); }); }, []);

  const generate = async () => {
    if (roadmap && !window.confirm("Rebuild your roadmap from your current grade, goals, colleges and activities? Ticked items with the same name stay ticked.")) return;
    setBusy(true); setError(null);
    try { setRoadmap(await collegeApi.generateRoadmap()); } catch (err) { setError(apiErrorMessage(err)); } finally { setBusy(false); }
  };
  const toggle = async (id: string, completed: boolean) => {
    setTogglingId(id);
    try { setRoadmap(await collegeApi.setMilestone(id, completed)); } catch (err) { setError(apiErrorMessage(err)); } finally { setTogglingId(null); }
  };

  return (
    <>
      <GoalsCard />
      {roadmap === undefined ? <Busy text="Loading…" /> : busy ? (
        <div className={`${card} p-6`}><Busy text="Building your personalised roadmap — this takes about a minute…" /></div>
      ) : !roadmap ? (
        <div className={`${card} p-6 text-center`}>
          <MapIcon size={30} className="mx-auto text-indigo-300 mb-3" />
          <h2 className="font-semibold text-gray-800">Your path to college, step by step</h2>
          <p className="text-sm text-gray-500 mt-1 mb-4 max-w-md mx-auto">
            A plan from your current grade to application day — what to focus on each term, with a checklist.
            Add your goals above first for a more personal plan.
          </p>
          <button onClick={generate} className="bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-indigo-700">Build my roadmap</button>
          <Err msg={error} />
        </div>
      ) : (
        <>
          <div className={`${card} p-5 mb-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm text-gray-700 leading-relaxed flex-1 min-w-[14rem]">{roadmap.overview}</p>
              <button onClick={generate} className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50">
                <RefreshCw size={12} /> Update my roadmap
              </button>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span><span>{roadmap.completed} of {roadmap.total} done</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={roadmap.total} aria-valuenow={roadmap.completed}>
                <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: `${roadmap.total ? (100 * roadmap.completed) / roadmap.total : 0}%` }} />
              </div>
            </div>
            <Err msg={error} />
          </div>

          <ol className="relative border-l-2 border-indigo-100 ml-3 space-y-5">
            {roadmap.stages.map((st, i) => {
              const done = st.milestones.filter((m) => m.completed_at).length;
              return (
                <li key={st.id} className="ml-5">
                  <span className={`absolute -left-[9px] w-4 h-4 rounded-full border-2 border-white ${done === st.milestones.length ? "bg-emerald-500" : i === 0 ? "bg-indigo-600" : "bg-indigo-200"}`} />
                  <div className={`${card} p-4 sm:p-5`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-bold text-gray-800">{st.label}</h3>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{done}/{st.milestones.length}</span>
                    </div>
                    {st.focus && <p className="text-sm text-gray-600 mt-1">{st.focus}</p>}
                    {st.goals.length > 0 && (
                      <ul className="mt-2 text-sm text-gray-700 list-disc ml-5 space-y-0.5">{st.goals.map((g, j) => <li key={j}>{g}</li>)}</ul>
                    )}
                    <div className="mt-3 space-y-1.5">
                      {st.milestones.map((m) => (
                        <label key={m.id} className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer ${m.completed_at ? "border-emerald-200 bg-emerald-50/50" : "border-gray-200 hover:border-indigo-200"}`}>
                          <input type="checkbox" className="mt-1" checked={!!m.completed_at} disabled={togglingId === m.id}
                            onChange={(e) => toggle(m.id, e.target.checked)} />
                          <span className="flex-1 min-w-0">
                            <span className={`block text-sm font-medium ${m.completed_at ? "text-gray-500 line-through" : "text-gray-800"}`}>{m.title}</span>
                            {m.detail && <span className="block text-xs text-gray-500 mt-0.5">{m.detail}</span>}
                          </span>
                          <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0 ${CATEGORY_STYLE[m.category] ?? CATEGORY_STYLE.academics}`}>{m.category}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </>
  );
};

// ─── Guide ────────────────────────────────────────────────────────────────────

const GuideTab: React.FC = () => {
  const { student } = useAppStore();
  const [guide, setGuide] = useState<AdmissionsGuide | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { collegeApi.getGuide().then(setGuide).catch((err) => { setGuide(null); setError(apiErrorMessage(err)); }); }, []);

  const create = async () => {
    setBusy(true); setError(null);
    try { setGuide(await collegeApi.createGuide()); } catch (err) { setError(apiErrorMessage(err)); } finally { setBusy(false); }
  };

  if (guide === undefined) return <Busy text="Loading…" />;
  if (!guide) return (
    <div className={`${card} p-6 text-center`}>
      <BookOpen size={30} className="mx-auto text-indigo-300 mb-3" />
      <h2 className="font-semibold text-gray-800">How college admissions work{student?.country ? ` in ${student.country}` : ""}</h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">A plain-language guide: grades, exams, activities, essays, applications and financial aid.</p>
      {busy ? <Busy text="Writing the guide — about a minute…" /> : (
        <button onClick={create} className="bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-indigo-700">Open the guide</button>
      )}
      <Err msg={error} />
    </div>
  );
  return (
    <>
      <div className={`${card} p-5 mb-4`}>
        <h2 className="text-lg font-bold text-gray-800">{guide.title}</h2>
        {guide.intro && <p className="text-sm text-gray-600 mt-1">{guide.intro}</p>}
        <p className="text-xs text-gray-400 mt-2 flex items-start gap-1"><Info size={12} className="mt-0.5 flex-shrink-0" />
          General guidance for {guide.country}. Rules and dates change — always confirm with official sources and your school counsellor.</p>
      </div>
      <div className="space-y-2">
        {guide.chapters.map((c, i) => {
          const open = openId === c.id;
          return (
            <div key={c.id} className={card}>
              <button onClick={() => setOpenId(open ? null : c.id)} aria-expanded={open}
                className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-gray-50 rounded-2xl">
                <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-gray-800">{c.title}</span>
                  {c.summary && <span className="block text-xs text-gray-500 mt-0.5">{c.summary}</span>}
                </span>
                <ChevronDown size={16} className={`text-gray-400 mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="px-5 pb-5 sm:pl-[3.75rem]">
                  <div className="prose prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{c.body}</ReactMarkdown></div>
                  {c.key_takeaways.length > 0 && (
                    <div className="mt-4 rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
                      <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Key takeaways</p>
                      <ul className="text-sm text-gray-700 list-disc ml-5 space-y-0.5">{c.key_takeaways.map((t, j) => <li key={j}>{t}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

// ─── Colleges ─────────────────────────────────────────────────────────────────

const CAT_META: Record<CollegeCategory, { label: string; hint: string; style: string }> = {
  reach: { label: "Reach", hint: "Admission is a stretch", style: "bg-rose-100 text-rose-700" },
  target: { label: "Target", hint: "Your profile fits well", style: "bg-indigo-100 text-indigo-700" },
  likely: { label: "Likely", hint: "Strong chance of admission", style: "bg-emerald-100 text-emerald-700" },
  undecided: { label: "Not sure yet", hint: "", style: "bg-gray-100 text-gray-600" },
};

const Bullets: React.FC<{ title: string; items: string[] }> = ({ title, items }) => items.length ? (
  <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{title}</p>
    <ul className="text-sm text-gray-700 list-disc ml-5 space-y-0.5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
) : null;

const CollegeCard: React.FC<{ c: CollegeEntry; onChange: (c: CollegeEntry) => void; onDelete: () => void }> = ({ c, onChange, onDelete }) => {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = c.summary;

  const summarize = async () => {
    setBusy(true); setError(null); setOpen(true);
    try { onChange(await collegeApi.summarizeCollege(c.id)); } catch (err) { setError(apiErrorMessage(err)); } finally { setBusy(false); }
  };
  const setCategory = async (category: CollegeCategory) => {
    try { onChange(await collegeApi.updateCollege(c.id, { category })); } catch (err) { setError(apiErrorMessage(err)); }
  };

  return (
    <div className={`${card} p-4`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[10rem]">
          <p className="font-semibold text-gray-800">{s?.recognized ? s.official_name : c.name}</p>
          {s?.recognized && <p className="text-xs text-gray-500">{[s.type, s.location, s.selectivity].filter(Boolean).join(" · ")}</p>}
        </div>
        <select value={c.category} onChange={(e) => setCategory(e.target.value as CollegeCategory)} aria-label="Category"
          className={`text-xs font-semibold rounded-full px-2.5 py-1 border-0 ${CAT_META[c.category].style}`}>
          {(Object.keys(CAT_META) as CollegeCategory[]).map((k) => <option key={k} value={k}>{CAT_META[k].label}</option>)}
        </select>
        <button onClick={() => window.confirm(`Remove ${c.name} from your list?`) && onDelete()} aria-label={`Remove ${c.name}`}
          className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
      </div>

      {busy ? <Busy text="Looking into this college…" /> : !s ? (
        <button onClick={summarize} className="mt-2 text-xs font-medium text-indigo-600 hover:underline">What do they look for? Get a summary →</button>
      ) : !s.recognized ? (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          We couldn't confidently identify this college. Try its full official name, then refresh the summary.
          <button onClick={summarize} className="ml-2 font-semibold underline">Refresh</button>
        </p>
      ) : (
        <>
          <button onClick={() => setOpen(!open)} className="mt-2 text-xs font-medium text-indigo-600 hover:underline">{open ? "Hide summary" : "Show summary"}</button>
          {open && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-gray-700">{s.overview}</p>
              {s.fit_for_student && (
                <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">How you fit</p>
                  <p className="text-sm text-gray-700">{s.fit_for_student}</p>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <Bullets title="What they look for" items={s.what_they_look_for} />
                <Bullets title="Typical requirements" items={s.typical_requirements} />
              </div>
              {(s.testing_policy || s.application_options) && (
                <div className="text-sm text-gray-700 space-y-1">
                  {s.testing_policy && <p><b>Testing:</b> {s.testing_policy}</p>}
                  {s.application_options && <p><b>Applying:</b> {s.application_options}</p>}
                </div>
              )}
              <Bullets title="Your next steps" items={s.next_steps} />
              <p className="text-[11px] text-gray-400 flex items-start gap-1"><Info size={11} className="mt-0.5 flex-shrink-0" />
                AI summary from general knowledge — requirements, test policies and deadlines change every year. Verify on the college's official admissions website.
                <button onClick={summarize} className="ml-1 underline whitespace-nowrap">Refresh</button></p>
            </div>
          )}
        </>
      )}
      <Err msg={error} />
    </div>
  );
};

const CollegesTab: React.FC = () => {
  const [colleges, setColleges] = useState<CollegeEntry[] | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CollegeCategory>("target");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { collegeApi.colleges().then(setColleges).catch((err) => setError(apiErrorMessage(err))); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const c = await collegeApi.addCollege({ name: name.trim(), category });
      setColleges((l) => [...(l ?? []), c]); setName("");
    } catch (err) { setError(apiErrorMessage(err)); }
  };
  const replace = (c: CollegeEntry) => setColleges((l) => l && l.map((x) => (x.id === c.id ? c : x)));
  const remove = async (id: number) => {
    try { await collegeApi.deleteCollege(id); setColleges((l) => l && l.filter((x) => x.id !== id)); } catch (err) { setError(apiErrorMessage(err)); }
  };

  return (
    <>
      <form onSubmit={add} className={`${card} p-4 mb-5 flex flex-wrap gap-2`}>
        <input required minLength={2} className={inputCls + " flex-1 min-w-[12rem]"} placeholder="Add a college, e.g. University of Texas at Austin"
          value={name} onChange={(e) => setName(e.target.value)} />
        <select className="border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white" value={category} onChange={(e) => setCategory(e.target.value as CollegeCategory)} aria-label="Category">
          {(Object.keys(CAT_META) as CollegeCategory[]).map((k) => <option key={k} value={k}>{CAT_META[k].label}</option>)}
        </select>
        <button type="submit" className="inline-flex items-center gap-1 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700"><Plus size={15} /> Add</button>
        <p className="w-full text-xs text-gray-400">A balanced list usually has a few reach, target and likely colleges.</p>
      </form>
      <Err msg={error} />
      {!colleges ? <Busy text="Loading…" /> : colleges.length === 0 ? (
        <p className="text-sm text-gray-500">No colleges yet — add a few you're curious about. You can change categories any time.</p>
      ) : (
        <div className="space-y-6">
          {(["reach", "target", "likely", "undecided"] as CollegeCategory[]).map((cat) => {
            const list = colleges.filter((c) => c.category === cat);
            if (!list.length) return null;
            return (
              <section key={cat}>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{CAT_META[cat].label} <span className="text-gray-400 font-normal">· {list.length}{CAT_META[cat].hint ? ` · ${CAT_META[cat].hint}` : ""}</span></h3>
                <div className="space-y-2">{list.map((c) => <CollegeCard key={c.id} c={c} onChange={replace} onDelete={() => remove(c.id)} />)}</div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
};

// ─── Activities ───────────────────────────────────────────────────────────────

const ACH_CATS: { key: AchievementCategory; label: string }[] = [
  { key: "extracurricular", label: "Club / extracurricular" }, { key: "leadership", label: "Leadership" },
  { key: "award", label: "Award / honor" }, { key: "volunteer", label: "Volunteering" }, { key: "work", label: "Job / work" },
  { key: "summer", label: "Summer program" }, { key: "research", label: "Research / project" }, { key: "arts", label: "Arts" },
  { key: "athletics", label: "Athletics" }, { key: "other", label: "Other" },
];
const BLANK: AchievementInput = { title: "", category: "extracurricular", organization: null, role: null, grades: null,
  hours_per_week: null, weeks_per_year: null, description: null };

const AchievementForm: React.FC<{ initial: AchievementInput; onSave: (a: AchievementInput) => Promise<void>; onCancel: () => void }> = ({ initial, onSave, onCancel }) => {
  const [f, setF] = useState<AchievementInput>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof AchievementInput>(k: K, v: AchievementInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const text = (v: string) => (v.trim() ? v : null);
  const num = (v: string) => (v === "" ? null : Number(v));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try { await onSave({ ...f, title: f.title.trim() }); } catch (err) { setError(apiErrorMessage(err)); } finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm font-medium text-gray-700">Activity *
          <input required className={inputCls + " mt-1"} placeholder="e.g., Robotics Club" value={f.title} onChange={(e) => set("title", e.target.value)} />
        </label>
        <label className="text-sm font-medium text-gray-700">Type
          <select className={inputCls + " mt-1 bg-white"} value={f.category} onChange={(e) => set("category", e.target.value as AchievementCategory)}>
            {ACH_CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">Role / position
          <input className={inputCls + " mt-1"} placeholder="e.g., Team captain" value={f.role ?? ""} onChange={(e) => set("role", text(e.target.value))} />
        </label>
        <label className="text-sm font-medium text-gray-700">Organization
          <input className={inputCls + " mt-1"} value={f.organization ?? ""} onChange={(e) => set("organization", text(e.target.value))} />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="text-sm font-medium text-gray-700">Grades
          <input className={inputCls + " mt-1"} placeholder="9,10" value={f.grades ?? ""} onChange={(e) => set("grades", text(e.target.value))} />
        </label>
        <label className="text-sm font-medium text-gray-700">Hrs/week
          <input type="number" min={0} max={100} step="0.5" className={inputCls + " mt-1"} value={f.hours_per_week ?? ""} onChange={(e) => set("hours_per_week", num(e.target.value))} />
        </label>
        <label className="text-sm font-medium text-gray-700">Weeks/yr
          <input type="number" min={0} max={52} className={inputCls + " mt-1"} value={f.weeks_per_year ?? ""} onChange={(e) => set("weeks_per_year", num(e.target.value))} />
        </label>
      </div>
      <label className="block text-sm font-medium text-gray-700">What you did & achieved
        <textarea rows={3} className={inputCls + " mt-1"} placeholder="Short, specific, with impact — e.g., Led a team of 6 to build a robot; placed 2nd at regionals."
          value={f.description ?? ""} onChange={(e) => set("description", text(e.target.value))} />
        <span className="text-xs text-gray-400">{(f.description ?? "").length} characters (application forms often allow ~150)</span>
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        <button type="button" onClick={onCancel} className="border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
      </div>
      <Err msg={error} />
    </form>
  );
};

const ActivitiesTab: React.FC = () => {
  const [items, setItems] = useState<Achievement[] | null>(null);
  const [editing, setEditing] = useState<Achievement | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { collegeApi.achievements().then(setItems).catch((err) => setError(apiErrorMessage(err))); }, []);

  const yearlyHours = useMemo(() => (items ?? []).reduce((sum, a) => sum + (a.hours_per_week ?? 0) * (a.weeks_per_year ?? 0), 0), [items]);
  const save = async (data: AchievementInput) => {
    if (editing === "new") {
      const a = await collegeApi.addAchievement(data);
      setItems((l) => [...(l ?? []), a]);
    } else if (editing) {
      const a = await collegeApi.updateAchievement(editing.id, data);
      setItems((l) => l && l.map((x) => (x.id === a.id ? a : x)));
    }
    setEditing(null);
  };
  const remove = async (a: Achievement) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try { await collegeApi.deleteAchievement(a.id); setItems((l) => l && l.filter((x) => x.id !== a.id)); } catch (err) { setError(apiErrorMessage(err)); }
  };

  return (
    <>
      <div className={`${card} p-4 mb-5 flex flex-wrap items-center justify-between gap-3`}>
        <p className="text-sm text-gray-600 flex-1 min-w-[14rem]">
          Keep a running record from 9th grade on — it becomes your application's activities list and a source of essay ideas.
          {yearlyHours > 0 && <span className="block text-xs text-gray-400 mt-1">About {Math.round(yearlyHours)} hours per year across your activities.</span>}
        </p>
        {editing === null && (
          <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700"><Plus size={15} /> Add activity</button>
        )}
      </div>
      {editing === "new" && <div className={`${card} p-5 mb-4`}><AchievementForm initial={BLANK} onSave={save} onCancel={() => setEditing(null)} /></div>}
      <Err msg={error} />
      {!items ? <Busy text="Loading…" /> : items.length === 0 && editing === null ? (
        <p className="text-sm text-gray-500">Nothing yet — add clubs, sports, awards, volunteering, jobs or summer programs.</p>
      ) : (
        <div className="space-y-2">
          {items.map((a) => editing !== "new" && editing?.id === a.id ? (
            <div key={a.id} className={`${card} p-5`}>
              <AchievementForm initial={{ ...a }} onSave={save} onCancel={() => setEditing(null)} />
            </div>
          ) : (
            <div key={a.id} className={`${card} p-4 flex items-start gap-3`}>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{a.title}{a.role && <span className="font-normal text-gray-500"> — {a.role}</span>}</p>
                <p className="text-xs text-gray-500">
                  {[ACH_CATS.find((c) => c.key === a.category)?.label, a.organization, a.grades && `Grades ${a.grades}`,
                    a.hours_per_week != null && `${a.hours_per_week} hrs/wk`, a.weeks_per_year != null && `${a.weeks_per_year} wks/yr`].filter(Boolean).join(" · ")}
                </p>
                {a.description && <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{a.description}</p>}
              </div>
              <button onClick={() => setEditing(a)} aria-label={`Edit ${a.title}`} className="p-2 text-gray-400 hover:text-indigo-600"><Pencil size={15} /></button>
              <button onClick={() => remove(a)} aria-label={`Delete ${a.title}`} className="p-2 text-gray-400 hover:text-red-500"><X size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const CollegePrepPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "roadmap") as Tab;
  const { student } = useAppStore();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
          <Compass size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">College Prep</h1>
          <p className="text-gray-400 text-xs">Your path from {student?.grade || "high school"} to college{student?.country ? ` · ${student.country}` : ""}</p>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 -mx-1 px-1" role="tablist">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setParams({ tab: key })}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
              tab === key ? "bg-indigo-600 text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "roadmap" && <RoadmapTab />}
      {tab === "guide" && <GuideTab />}
      {tab === "colleges" && <CollegesTab />}
      {tab === "activities" && <ActivitiesTab />}
    </div>
  );
};
