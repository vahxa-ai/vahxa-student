import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, ShieldCheck, ShieldAlert, Users } from "lucide-react";
import { adminApi, apiErrorMessage, type AdminAction } from "../services/api";
import type { AdminStudent, StudentStatus } from "../types";

const TABS: { key: StudentStatus | "all"; label: string }[] = [
  { key: "awaiting_approval", label: "Awaiting approval" },
  { key: "awaiting_consent", label: "Awaiting consent" },
  { key: "approved", label: "Approved" },
  { key: "suspended", label: "Suspended" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const STATUS_STYLE: Record<StudentStatus, string> = {
  awaiting_consent: "bg-amber-100 text-amber-700",
  awaiting_approval: "bg-indigo-100 text-indigo-700",
  approved: "bg-emerald-100 text-emerald-700",
  suspended: "bg-orange-100 text-orange-700",
  rejected: "bg-rose-100 text-rose-700",
};

const ACTIONS_FOR: Record<StudentStatus, { action: AdminAction; label: string; style: string }[]> = {
  awaiting_approval: [
    { action: "approve", label: "Approve", style: "bg-emerald-600 text-white hover:bg-emerald-700" },
    { action: "reject", label: "Reject", style: "border border-rose-200 text-rose-600 hover:bg-rose-50" },
  ],
  awaiting_consent: [{ action: "reject", label: "Reject", style: "border border-rose-200 text-rose-600 hover:bg-rose-50" }],
  approved: [{ action: "suspend", label: "Suspend", style: "border border-orange-200 text-orange-600 hover:bg-orange-50" }],
  suspended: [{ action: "reinstate", label: "Reinstate", style: "bg-indigo-600 text-white hover:bg-indigo-700" }],
  rejected: [{ action: "reinstate", label: "Reconsider", style: "border border-indigo-200 text-indigo-600 hover:bg-indigo-50" }],
};

const fmt = (d: string | null) => (d ? format(new Date(d + "Z"), "MMM d, yyyy h:mm a") : "—");

const StudentCard: React.FC<{ s: AdminStudent; onChange: (s: AdminStudent) => void }> = ({ s, onChange }) => {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = s.consent;

  const act = async (action: AdminAction) => {
    if ((action === "reject" || action === "suspend") &&
        !window.confirm(`${action === "reject" ? "Reject" : "Suspend"} ${s.name}?`)) return;
    setBusy(true); setError(null);
    try { onChange(await adminApi.act(s.id, action, note.trim() || undefined)); setNote(""); }
    catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-800">{s.name}{s.age ? <span className="text-gray-400 font-normal"> · {s.age}</span> : null}</p>
          <p className="text-xs text-gray-500">{s.email ?? "not signed in yet"}</p>
          <p className="text-xs text-gray-500 mt-0.5">{[s.grade, s.school, s.location].filter(Boolean).join(" · ") || "—"}</p>
        </div>
        {s.status && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[s.status]}`}>
          {s.status.replace("_", " ")}</span>}
      </div>

      <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 text-xs text-gray-600 space-y-0.5">
        <p className="flex items-center gap-1.5 font-semibold text-gray-700">
          {c?.status === "granted" ? <ShieldCheck size={13} className="text-emerald-500" /> : <ShieldAlert size={13} className="text-amber-500" />}
          Parental consent: {c ? c.status : "not requested"}
        </p>
        <p>Parent on file: {s.parent_name ?? "—"} &lt;{s.parent_email ?? "—"}&gt;</p>
        {c?.status === "granted" && <>
          <p>Given by <b>{c.parent_full_name}</b> ({c.relationship}) signed in as {c.parent_email}</p>
          <p>On {fmt(c.granted_at)} · IP {c.granted_ip ?? "—"} · wording v{c.consent_version}</p>
        </>}
        {c?.status === "pending" && <p>Requested {fmt(c.requested_at)}</p>}
        {c?.revoked_at && <p>Withdrawn/declined {fmt(c.revoked_at)}</p>}
      </div>
      {s.status_note && <p className="text-xs text-gray-500 mt-2">Note: {s.status_note}</p>}

      {s.status && ACTIONS_FOR[s.status].length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input className="flex-1 min-w-[10rem] border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
            placeholder="Optional note (emailed on reject/suspend)" value={note} onChange={(e) => setNote(e.target.value)} />
          {ACTIONS_FOR[s.status].map(({ action, label, style }) => (
            <button key={action} disabled={busy} onClick={() => act(action)}
              className={`text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors ${style}`}>
              {label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
};

export const AdminPage: React.FC = () => {
  const [tab, setTab] = useState<StudentStatus | "all">("awaiting_approval");
  const [students, setStudents] = useState<AdminStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStudents(null);
    adminApi.students(tab === "all" ? undefined : tab).then(setStudents).catch((err) => setError(apiErrorMessage(err)));
  }, [tab]);

  const onChange = (updated: AdminStudent) =>
    setStudents((list) => list && (tab === "all"
      ? list.map((s) => (s.id === updated.id ? updated : s))
      : list.filter((s) => s.id !== updated.id)));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Users size={22} className="text-indigo-500" /> Students</h1>
      <p className="text-gray-500 text-sm mt-1 mb-5">Approve students once a parent has consented.</p>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
              tab === t.key ? "bg-indigo-600 text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {!students ? (
        <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-gray-500">No students here.</p>
      ) : (
        <div className="space-y-3">{students.map((s) => <StudentCard key={s.id} s={s} onChange={onChange} />)}</div>
      )}
    </div>
  );
};
