import React, { useEffect, useState } from "react";
import {
  Check, ChevronDown, DollarSign, ExternalLink, GraduationCap, Info, Loader2, Plus, Search, SlidersHorizontal,
  Sparkles, Trophy,
} from "lucide-react";
import { collegeApi, apiErrorMessage } from "../../services/api";
import type {
  AthleticsPrefs, CollegePreferences, CollegePriority, CollegeProfile, Recommendations, RecommendationGroup,
  RecommendedCollege,
} from "../../types";

const card = "bg-white rounded-2xl border border-gray-100 shadow-sm";
const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

const EMPTY_ATHLETICS: AthleticsPrefs = { sport: null, team: null, position_or_event: null, level: null, stats: null, wants_to_compete: false };
const EMPTY_PREFS: CollegePreferences = { regions: null, size: null, setting: null, need_aid: null, budget_note: null, priorities: [], athletics: null };

const PRIORITIES: { key: CollegePriority; label: string }[] = [
  { key: "academics", label: "Academics" }, { key: "aid", label: "Financial aid" }, { key: "athletics", label: "Athletics" },
  { key: "location", label: "Location" }, { key: "size", label: "Size" },
];

const GROUP_META: Record<RecommendationGroup["key"], { icon: React.ElementType; style: string }> = {
  athletics: { icon: Trophy, style: "text-orange-600 bg-orange-50" },
  aid: { icon: DollarSign, style: "text-emerald-600 bg-emerald-50" },
  academics: { icon: GraduationCap, style: "text-indigo-600 bg-indigo-50" },
};
const FIT_STYLE = { reach: "bg-rose-100 text-rose-700", target: "bg-indigo-100 text-indigo-700", likely: "bg-emerald-100 text-emerald-700" };
const LEVEL_STYLE = { strong: "border-emerald-300 bg-emerald-50", possible: "border-amber-300 bg-amber-50", stretch: "border-rose-200 bg-rose-50" };

// Fixed, reviewed explanation of US college athletics levels (not AI-generated)
const DIVISIONS: { name: string; text: string }[] = [
  { name: "NCAA Division I", text: "The highest level, mostly larger universities. Athletic scholarships are available (full or partial, depending on the sport). The biggest time commitment, and the most competitive recruiting." },
  { name: "NCAA Division II", text: "Competitive athletics with more balance with academics. Athletic scholarships are available but are usually partial, often combined with academic aid." },
  { name: "NCAA Division III", text: "The largest division, often smaller colleges including many academically strong ones. No athletic scholarships — but need-based and merit aid can be generous. Academics come first." },
  { name: "NAIA", text: "A separate association of mostly smaller colleges. Athletic scholarships are available, and eligibility rules are simpler than the NCAA's." },
  { name: "Junior college (NJCAA)", text: "Two-year colleges with competitive athletics and scholarships — a route to play, improve and then transfer to a four-year college." },
];

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick} aria-pressed={active}
    className={`text-xs rounded-full px-3 py-1.5 border ${active ? "bg-indigo-600 text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"}`}>
    {children}
  </button>
);

// ─── Preferences ──────────────────────────────────────────────────────────────

const PreferencesCard: React.FC<{ profile: CollegeProfile; onSaved: (p: CollegeProfile) => void; startOpen: boolean }> = ({ profile, onSaved, startOpen }) => {
  const [open, setOpen] = useState(startOpen);
  const [prefs, setPrefs] = useState<CollegePreferences>({ ...EMPTY_PREFS, ...(profile.preferences ?? {}) });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ath = prefs.athletics ?? EMPTY_ATHLETICS;

  const set = <K extends keyof CollegePreferences>(k: K, v: CollegePreferences[K]) => setPrefs((p) => ({ ...p, [k]: v }));
  const setAth = <K extends keyof AthleticsPrefs>(k: K, v: AthleticsPrefs[K]) => set("athletics", { ...ath, [k]: v });
  const text = (v: string) => (v.trim() ? v : null);
  const togglePriority = (k: CollegePriority) =>
    set("priorities", prefs.priorities.includes(k) ? prefs.priorities.filter((x) => x !== k) : [...prefs.priorities, k]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const athletics = ath.sport ? ath : null;
      onSaved(await collegeApi.saveProfile({ ...profile, preferences: { ...prefs, athletics } }));
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (err) { setError(apiErrorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <div className={`${card} mb-5`}>
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-2xl">
        <span className="flex items-center gap-2"><SlidersHorizontal size={15} className="text-indigo-500" /> What matters to you</span>
        <ChevronDown size={15} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <form onSubmit={save} className="border-t border-gray-100 p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">Priorities <span className="text-xs font-normal text-gray-400">(tap in order of importance)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITIES.map((p) => (
                <Chip key={p.key} active={prefs.priorities.includes(p.key)} onClick={() => togglePriority(p.key)}>
                  {prefs.priorities.includes(p.key) && `${prefs.priorities.indexOf(p.key) + 1}. `}{p.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-sm font-medium text-gray-700 sm:col-span-3">Where would you like to study?
              <input className={inputCls + " mt-1"} placeholder="e.g., Texas or nearby, anywhere in the US" value={prefs.regions ?? ""} onChange={(e) => set("regions", text(e.target.value))} />
            </label>
            <label className="text-sm font-medium text-gray-700">Size
              <select className={inputCls + " mt-1 bg-white"} value={prefs.size ?? ""} onChange={(e) => set("size", (e.target.value || null) as CollegePreferences["size"])}>
                <option value="">No preference</option><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">Setting
              <select className={inputCls + " mt-1 bg-white"} value={prefs.setting ?? ""} onChange={(e) => set("setting", (e.target.value || null) as CollegePreferences["setting"])}>
                <option value="">No preference</option><option value="urban">City</option><option value="suburban">Suburban</option><option value="rural">Rural / small town</option>
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">Need financial aid?
              <select className={inputCls + " mt-1 bg-white"} value={prefs.need_aid ?? ""} onChange={(e) => set("need_aid", (e.target.value || null) as CollegePreferences["need_aid"])}>
                <option value="">Not sure</option><option value="yes">Yes</option><option value="maybe">Maybe</option><option value="no">No</option>
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium text-gray-700">Anything about cost? <span className="text-xs font-normal text-gray-400">(optional — no exact income needed)</span>
            <input className={inputCls + " mt-1"} maxLength={300} placeholder="e.g., prefer in-state tuition, need strong merit scholarships" value={prefs.budget_note ?? ""} onChange={(e) => set("budget_note", text(e.target.value))} />
          </label>

          <fieldset className="rounded-xl border border-orange-100 bg-orange-50/40 p-4 space-y-3">
            <legend className="text-sm font-semibold text-gray-800 px-1 flex items-center gap-1.5"><Trophy size={14} className="text-orange-500" /> Sports</legend>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm font-medium text-gray-700">Sport
                <input className={inputCls + " mt-1"} placeholder="e.g., Soccer" value={ath.sport ?? ""} onChange={(e) => setAth("sport", text(e.target.value))} />
              </label>
              <label className="text-sm font-medium text-gray-700">Team
                <select className={inputCls + " mt-1 bg-white"} value={ath.team ?? ""} onChange={(e) => setAth("team", (e.target.value || null) as AthleticsPrefs["team"])}>
                  <option value="">Not specified</option><option value="mens">Men's / boys'</option><option value="womens">Women's / girls'</option><option value="coed">Coed</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">Position / event
                <input className={inputCls + " mt-1"} placeholder="e.g., goalkeeper, 5K" value={ath.position_or_event ?? ""} onChange={(e) => setAth("position_or_event", text(e.target.value))} />
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">Level
                <input className={inputCls + " mt-1"} placeholder="e.g., varsity starter, club team, state qualifier" value={ath.level ?? ""} onChange={(e) => setAth("level", text(e.target.value))} />
              </label>
              <label className="text-sm font-medium text-gray-700">Stats / times / honors
                <input className={inputCls + " mt-1"} placeholder="e.g., 5K 17:40; all-district" value={ath.stats ?? ""} onChange={(e) => setAth("stats", text(e.target.value))} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={ath.wants_to_compete} onChange={(e) => setAth("wants_to_compete", e.target.checked)} disabled={!ath.sport} />
              I'd like to compete in college
            </label>
            {ath.wants_to_compete && !ath.team && <p className="text-xs text-amber-700">Tip: choose the team — performance standards differ, so level advice needs it.</p>}
          </fieldset>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{saving ? "Saving…" : "Save preferences"}</button>
            {saved && <span className="text-sm text-emerald-600 flex items-center gap-1"><Check size={14} /> Saved</span>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
};

// ─── Results ──────────────────────────────────────────────────────────────────

const CollegeResult: React.FC<{ c: RecommendedCollege; added: boolean; onAdd: () => Promise<void> }> = ({ c, added, onAdd }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    setBusy(true); setError(null);
    try { await onAdd(); } catch (err) { setError(apiErrorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1 min-w-[10rem]">
          <p className="font-semibold text-gray-800">{c.name}</p>
          {c.location && <p className="text-xs text-gray-500">{c.location}</p>}
        </div>
        {c.division && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{c.division}</span>}
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${FIT_STYLE[c.fit_category]}`}>{c.fit_category}</span>
      </div>
      {c.why && <p className="text-sm text-gray-700 mt-1.5">{c.why}</p>}
      {[c.athletics_note, c.aid_note, c.academic_note].filter(Boolean).map((n, i) => <p key={i} className="text-xs text-gray-500 mt-1">• {n}</p>)}
      <div className="mt-2">
        {added ? (
          <span className="text-xs text-emerald-600 font-medium inline-flex items-center gap-1"><Check size={12} /> On your list</span>
        ) : (
          <button onClick={add} disabled={busy} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add to my list as {c.fit_category}
          </button>
        )}
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    </div>
  );
};

export const FindCollegesTab: React.FC = () => {
  const [profile, setProfile] = useState<CollegeProfile | null>(null);
  const [recs, setRecs] = useState<Recommendations | null | undefined>(undefined);
  const [listed, setListed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDivisions, setShowDivisions] = useState(false);

  useEffect(() => {
    collegeApi.getProfile().then(setProfile).catch((err) => setError(apiErrorMessage(err)));
    collegeApi.getRecommendations().then(setRecs).catch(() => setRecs(null));
    collegeApi.colleges().then((l) => setListed(new Set(l.map((c) => c.name.toLowerCase())))).catch(() => undefined);
  }, []);

  const find = async () => {
    setBusy(true); setError(null);
    try { setRecs(await collegeApi.generateRecommendations()); } catch (err) { setError(apiErrorMessage(err)); } finally { setBusy(false); }
  };
  const add = async (c: RecommendedCollege) => {
    await collegeApi.addCollege({ name: c.name, category: c.fit_category, notes: c.why || null });
    setListed((s) => new Set(s).add(c.name.toLowerCase()));
  };

  if (!profile || recs === undefined) return <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>;
  const athlete = !!(profile.preferences?.athletics?.sport && profile.preferences.athletics.wants_to_compete);

  return (
    <>
      <PreferencesCard profile={profile} onSaved={setProfile} startOpen={!profile.preferences} />

      {athlete && (
        <div className={`${card} mb-5`}>
          <button onClick={() => setShowDivisions(!showDivisions)} aria-expanded={showDivisions}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-2xl">
            <span className="flex items-center gap-2"><Info size={15} className="text-orange-500" /> D1, D2, D3, NAIA… what's the difference?</span>
            <ChevronDown size={15} className={`text-gray-400 transition-transform ${showDivisions ? "rotate-180" : ""}`} />
          </button>
          {showDivisions && (
            <dl className="border-t border-gray-100 p-5 space-y-3">
              {DIVISIONS.map((d) => (
                <div key={d.name}><dt className="text-sm font-semibold text-gray-800">{d.name}</dt><dd className="text-sm text-gray-600">{d.text}</dd></div>
              ))}
            </dl>
          )}
        </div>
      )}

      <div className={`${card} p-5 mb-5 flex flex-wrap items-center justify-between gap-3`}>
        <p className="text-sm text-gray-600 flex-1 min-w-[14rem]">
          Suggestions based on your activities, goals and preferences{athlete ? " — including where you could compete" : ""}.
          Update your Activities tab first for the best results.
        </p>
        <button onClick={find} disabled={busy}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
          {busy ? <Loader2 size={15} className="animate-spin" /> : recs ? <Sparkles size={15} /> : <Search size={15} />}
          {busy ? "Finding and checking colleges…" : recs ? "Refresh suggestions" : "Find colleges for me"}
        </button>
        {busy && <p className="w-full text-xs text-gray-400">This takes about 30–60 seconds — each suggestion is fact-checked.</p>}
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </div>

      {recs && (
        <div className="space-y-6">
          <div className={`${card} p-5`}>
            <p className="text-sm text-gray-700 leading-relaxed">{recs.summary}</p>
            {recs.athletic_levels.length > 0 && (
              <div className="mt-4 grid sm:grid-cols-2 gap-2">
                {recs.athletic_levels.map((lv, i) => (
                  <div key={i} className={`rounded-xl border px-3 py-2 ${LEVEL_STYLE[lv.fit]}`}>
                    <p className="text-sm font-semibold text-gray-800">{lv.division} <span className="text-xs font-normal text-gray-500">· {lv.fit} fit</span></p>
                    <p className="text-xs text-gray-600 mt-0.5">{lv.why}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {recs.groups.map((g) => {
            const { icon: Icon, style } = GROUP_META[g.key];
            return (
              <section key={g.key}>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-1">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${style}`}><Icon size={14} /></span>{g.title}
                </h3>
                {g.intro && <p className="text-xs text-gray-500 mb-2">{g.intro}</p>}
                {g.key === "athletics" && (
                  <p className="text-xs text-orange-800 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 mb-2">
                    Colleges change divisions and programs — confirm each one's division and that it offers your sport on the{" "}
                    <a href="https://web3.ncaa.org/directory/" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5">NCAA directory <ExternalLink size={10} /></a>{" "}
                    or the <a href="https://www.naia.org/schools/index" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5">NAIA school list <ExternalLink size={10} /></a>.
                  </p>
                )}
                <div className="space-y-2">
                  {g.colleges.map((c) => <CollegeResult key={c.name} c={c} added={listed.has(c.name.toLowerCase())} onAdd={() => add(c)} />)}
                </div>
              </section>
            );
          })}

          {recs.next_steps.length > 0 && (
            <div className={`${card} p-5`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Next steps</p>
              <ul className="text-sm text-gray-700 list-disc ml-5 space-y-1">{recs.next_steps.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          <p className="text-[11px] text-gray-400 flex items-start gap-1"><Info size={11} className="mt-0.5 flex-shrink-0" />
            AI suggestions from general knowledge, fact-checked by a second pass{recs.removed_by_check ? ` (${recs.removed_by_check} removed)` : ""}.
            Programs, aid policies and costs change — verify with each college, and use its Net Price Calculator for your real cost.</p>
        </div>
      )}
    </>
  );
};
