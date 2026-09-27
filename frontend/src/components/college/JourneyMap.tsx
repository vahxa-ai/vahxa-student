import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, BookOpen, ClipboardList, DollarSign, FileText, GraduationCap, MapPin, Printer, Trophy, X } from "lucide-react";
import type { AdmissionsFlow, FlowTrackId, GuideChapter } from "../../types";

type Step = AdmissionsFlow["steps"][number];

const TRACK_META: Record<FlowTrackId, { icon: React.ElementType; lane: string; node: string; dot: string }> = {
  academics:    { icon: GraduationCap, lane: "bg-indigo-50 text-indigo-700",   node: "border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100",   dot: "bg-indigo-500" },
  testing:      { icon: ClipboardList, lane: "bg-violet-50 text-violet-700",   node: "border-violet-200 bg-violet-50/60 hover:bg-violet-100",   dot: "bg-violet-500" },
  activities:   { icon: Trophy,        lane: "bg-emerald-50 text-emerald-700", node: "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100", dot: "bg-emerald-500" },
  applications: { icon: FileText,      lane: "bg-sky-50 text-sky-700",         node: "border-sky-200 bg-sky-50/60 hover:bg-sky-100",            dot: "bg-sky-500" },
  finances:     { icon: DollarSign,    lane: "bg-amber-50 text-amber-700",     node: "border-amber-200 bg-amber-50/60 hover:bg-amber-100",      dot: "bg-amber-500" },
};

/** Index of the phase matching the student's grade (e.g. "9th" → first phase mentioning 9). */
const currentPhaseIndex = (flow: AdmissionsFlow, grade: string | null | undefined): number => {
  const n = grade?.match(/\d{1,2}/)?.[0];
  if (!n) return -1;
  return flow.phases.findIndex((p) => new RegExp(`\\b${n}\\b`).test(p.label));
};

interface Props {
  flow: AdmissionsFlow;
  chapters: GuideChapter[];
  grade?: string | null;
  onOpenChapter: (chapterId: string) => void;
}

/** Visual admissions journey: phases (columns) × lanes (rows) on wide screens; a vertical timeline on phones. */
export const JourneyMap: React.FC<Props> = ({ flow, chapters, grade, onOpenChapter }) => {
  const [selected, setSelected] = useState<Step | null>(null);
  const current = currentPhaseIndex(flow, grade);
  const cells = useMemo(() => {
    const map: Record<string, Step[]> = {};
    for (const s of flow.steps) (map[`${s.phase}|${s.track}`] ??= []).push(s);
    return map;
  }, [flow]);
  const phaseIndex = (id: string) => flow.phases.findIndex((p) => p.id === id);

  const Node: React.FC<{ step: Step; compact?: boolean }> = ({ step, compact }) => {
    const meta = TRACK_META[step.track];
    const active = selected?.id === step.id;
    return (
      <button type="button" onClick={() => setSelected(active ? null : step)} aria-pressed={active}
        className={`w-full text-left rounded-lg border px-2.5 py-2 text-xs font-medium text-gray-800 leading-snug transition-colors break-inside-avoid ${meta.node} ${active ? "ring-2 ring-indigo-400" : ""}`}>
        {compact && <span className={`inline-block w-2 h-2 rounded-full mr-1.5 align-middle ${meta.dot}`} />}
        {step.title}
      </button>
    );
  };

  const detail = selected && (() => {
    const chapter = selected.chapter ? chapters[selected.chapter - 1] : null;
    const meta = TRACK_META[selected.track];
    return (
      <div className="mt-4 rounded-2xl border border-indigo-100 bg-white shadow-sm p-4 print:hidden" role="region" aria-live="polite">
        <div className="flex items-start gap-3">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.lane}`}><meta.icon size={15} /></span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800">{selected.title}</p>
            <p className="text-xs text-gray-500">{flow.phases[phaseIndex(selected.phase)]?.label} · {flow.tracks.find((t) => t.id === selected.track)?.label}</p>
            {selected.detail && <p className="text-sm text-gray-700 mt-2">{selected.detail}</p>}
            {chapter && (
              <button onClick={() => onOpenChapter(chapter.id)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                <BookOpen size={13} /> Read chapter {selected.chapter}: {chapter.title}
              </button>
            )}
          </div>
          <button onClick={() => setSelected(null)} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
      </div>
    );
  })();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 print:hidden">
        <div className="flex flex-wrap gap-1.5">
          {flow.tracks.map((t) => {
            const meta = TRACK_META[t.id];
            return <span key={t.id} className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-1 ${meta.lane}`}><meta.icon size={11} /> {t.label}</span>;
          })}
        </div>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50">
          <Printer size={13} /> Print map
        </button>
      </div>

      {/* ── Wide screens & print: phases × lanes grid ─────────────────────── */}
      <div className="hidden md:block print:block overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm print:shadow-none print:border-gray-300">
        <div className="grid" style={{ gridTemplateColumns: `8.5rem repeat(${flow.phases.length}, minmax(0, 1fr))`, minWidth: `${8.5 + flow.phases.length * 9.5}rem` }}>
          <div className="sticky left-0 z-20 bg-white border-b border-r border-gray-100" />
          {flow.phases.map((p, i) => (
            <div key={p.id} className={`relative px-3 py-2.5 border-b border-gray-100 text-xs font-bold text-center ${i === current ? "bg-indigo-600 text-white" : "bg-gray-50 text-gray-700"}`}>
              {p.label}
              {i === current && <span className="block text-[10px] font-medium text-indigo-100 flex items-center justify-center gap-0.5"><MapPin size={9} /> You are here</span>}
              {i < flow.phases.length - 1 && <ArrowRight size={12} className="absolute -right-1.5 top-1/2 -translate-y-1/2 z-10 text-gray-300 bg-white rounded-full" />}
            </div>
          ))}
          {flow.tracks.map((t) => {
            const meta = TRACK_META[t.id];
            return (
              <React.Fragment key={t.id}>
                <div className={`sticky left-0 z-20 px-3 py-3 border-b border-r border-gray-100 text-xs font-semibold flex items-start gap-1.5 ${meta.lane}`}>
                  <meta.icon size={13} className="mt-0.5 flex-shrink-0" /> {t.label}
                </div>
                {flow.phases.map((p, i) => (
                  <div key={p.id} className={`px-2 py-2 border-b border-l border-gray-100 space-y-1.5 ${i === current ? "bg-indigo-50/40" : i < current ? "opacity-60" : ""}`}>
                    {(cells[`${p.id}|${t.id}`] ?? []).map((s) => <Node key={s.id} step={s} />)}
                  </div>
                ))}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Phones: vertical timeline ──────────────────────────────────────── */}
      <ol className="md:hidden print:hidden space-y-1">
        {flow.phases.map((p, i) => {
          const steps = flow.steps.filter((s) => s.phase === p.id);
          return (
            <li key={p.id}>
              <div className={`rounded-2xl border p-3 ${i === current ? "border-indigo-300 bg-indigo-50/60" : "border-gray-100 bg-white"} ${i < current ? "opacity-60" : ""}`}>
                <p className={`text-sm font-bold mb-2 flex items-center gap-1.5 ${i === current ? "text-indigo-700" : "text-gray-800"}`}>
                  {p.label}{i === current && <span className="text-[10px] font-semibold bg-indigo-600 text-white rounded-full px-2 py-0.5 inline-flex items-center gap-0.5"><MapPin size={9} /> You are here</span>}
                </p>
                <div className="space-y-1.5">{steps.map((s) => <Node key={s.id} step={s} compact />)}</div>
              </div>
              {i < flow.phases.length - 1 && <ArrowDown size={16} className="mx-auto my-1 text-gray-300" />}
            </li>
          );
        })}
      </ol>

      {detail}
      <p className="text-[11px] text-gray-400 mt-3 print:hidden">Tap a step for details. Dates vary by school and year — check official sources.</p>
    </div>
  );
};
