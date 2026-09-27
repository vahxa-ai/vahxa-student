import React, { useState } from "react";
import { Check, Clock, Loader2, LogOut, Mail, ShieldCheck, UserCheck, XCircle, PauseCircle } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { authApi, onboardingApi, apiErrorMessage } from "../services/api";
import type { Me } from "../types";

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { me, setMe } = useAppStore();
  const signOut = async () => { await authApi.logout(); setMe(null); };
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50/30 px-4 py-10">
      <div className="max-w-xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <p className="font-bold text-gray-800">🎓 Vahxa Student</p>
          <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800">
            <LogOut size={13} /> Sign out {me?.user.email}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ─── Sign-up form ─────────────────────────────────────────────────────────────

const SignupForm: React.FC<{ me: Me }> = ({ me }) => {
  const { setMe } = useAppStore();
  const s = me.student;
  const [form, setForm] = useState({
    name: s?.name ?? me.user.name ?? "", age: s?.age?.toString() ?? "", school: s?.school ?? "", grade: s?.grade ?? "",
    county: s?.county ?? "", state: s?.state ?? "", country: s?.country ?? "",
    parent_name: s?.parent_name ?? "", parent_email: s?.parent_email ?? "",
  });
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const opt = (v: string) => v.trim() || null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      setMe(await onboardingApi.submit({
        name: form.name.trim(), age: form.age ? parseInt(form.age) : null,
        school: opt(form.school), grade: opt(form.grade), county: opt(form.county),
        state: opt(form.state), country: opt(form.country),
        parent_name: form.parent_name.trim(), parent_email: form.parent_email.trim(),
      }));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Create your student profile</h1>
        <p className="text-sm text-gray-500 mt-1">Signed in as {me.user.email}</p>
      </div>

      <section className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Your name *</label>
            <input required className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
            <input type="number" min={3} max={25} className={inputCls} value={form.age} onChange={(e) => set("age", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
            <input className={inputCls} value={form.school} onChange={(e) => set("school", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grade *</label>
            <input required className={inputCls} placeholder="e.g., 9th Grade" value={form.grade} onChange={(e) => set("grade", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">County / District</label>
            <input className={inputCls} value={form.county} onChange={(e) => set("county", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State / Province</label>
            <input className={inputCls} value={form.state} onChange={(e) => set("state", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
            <input required className={inputCls} value={form.country} onChange={(e) => set("country", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <ShieldCheck size={15} className="text-indigo-500" /> Parent or guardian
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            We'll email them a link to review and give consent. They must sign in with this Google account.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Their name *</label>
            <input required className={inputCls} value={form.parent_name} onChange={(e) => set("parent_name", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Their Gmail *</label>
            <input required type="email" className={inputCls} placeholder="parent@gmail.com" value={form.parent_email} onChange={(e) => set("parent_email", e.target.value)} />
          </div>
        </div>
      </section>

      <label className="flex items-start gap-2 text-sm text-gray-600">
        <input type="checkbox" className="mt-0.5" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        I understand I can use Vahxa Student only after my parent or guardian consents and an admin approves my account.
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={!ack || saving}
        className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
        {saving ? "Sending…" : "Send consent request to my parent"}
      </button>
    </form>
  );
};

// ─── Status tracker ───────────────────────────────────────────────────────────

const Step: React.FC<{ done: boolean; active: boolean; title: string; children?: React.ReactNode }> = ({ done, active, title, children }) => (
  <li className="flex gap-3">
    <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
      done ? "bg-emerald-500 text-white" : active ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-400"}`}>
      {done ? <Check size={14} /> : active ? <Clock size={14} /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
    </span>
    <div className="pb-5 min-w-0 flex-1">
      <p className={`text-sm font-semibold ${active ? "text-gray-900" : done ? "text-gray-700" : "text-gray-400"}`}>{title}</p>
      {children}
    </div>
  </li>
);

const StatusTracker: React.FC<{ me: Me }> = ({ me }) => {
  const { setMe } = useAppStore();
  const student = me.student!;
  const status = student.status!;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [parent, setParent] = useState({ parent_name: student.parent_name ?? "", parent_email: student.parent_email ?? "" });

  const run = async (fn: () => Promise<Me>, ok: string) => {
    setBusy(true); setMsg(null);
    try { setMe(await fn()); setMsg({ kind: "ok", text: ok }); setEditing(false); }
    catch (err) { setMsg({ kind: "err", text: apiErrorMessage(err) }); }
    finally { setBusy(false); }
  };

  if (status === "rejected" || status === "suspended") {
    const Icon = status === "rejected" ? XCircle : PauseCircle;
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
        <Icon size={36} className="mx-auto text-rose-400 mb-3" />
        <h1 className="text-lg font-bold text-gray-800">
          {status === "rejected" ? "Your sign-up wasn't approved" : "Your account is paused"}
        </h1>
        {student.status_note && <p className="text-sm text-gray-600 mt-2">Note from the admin: {student.status_note}</p>}
        <p className="text-sm text-gray-500 mt-3">If you think this is a mistake, please contact the admin.</p>
      </div>
    );
  }

  const consentPending = status === "awaiting_consent";
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-1">Almost there, {student.name.split(" ")[0]}!</h1>
      <p className="text-sm text-gray-500 mb-6">Your account will open once these steps are done.</p>
      <ol>
        <Step done active={false} title="Profile created" />
        <Step done={!consentPending} active={consentPending} title="Parent or guardian consent">
          {consentPending && (
            <div className="mt-1.5 space-y-2">
              <p className="text-sm text-gray-600">
                {student.status_note ? `${student.status_note}. ` : ""}We emailed <b>{student.parent_email}</b>.
                Ask them to open the email and sign in with that Google account.
              </p>
              {!editing ? (
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy} onClick={() => run(onboardingApi.resendConsent, "Email sent again.")}
                    className="flex items-center gap-1.5 text-xs font-medium border border-indigo-300 text-indigo-600 rounded-lg px-3 py-1.5 hover:bg-indigo-50 disabled:opacity-50">
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />} Resend email
                  </button>
                  <button onClick={() => setEditing(true)} className="text-xs font-medium text-gray-500 hover:text-gray-800 px-2">
                    Wrong email?
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <input className={inputCls} placeholder="Parent's name" value={parent.parent_name}
                    onChange={(e) => setParent((p) => ({ ...p, parent_name: e.target.value }))} />
                  <input className={inputCls} type="email" placeholder="parent@gmail.com" value={parent.parent_email}
                    onChange={(e) => setParent((p) => ({ ...p, parent_email: e.target.value }))} />
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={() => run(() => onboardingApi.changeParent(parent), "Updated — a new email is on its way.")}
                      className="text-xs font-medium bg-indigo-600 text-white rounded-lg px-3 py-1.5 hover:bg-indigo-700 disabled:opacity-50">
                      Save & send
                    </button>
                    <button onClick={() => setEditing(false)} className="text-xs text-gray-500 px-2">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Step>
        <Step done={false} active={status === "awaiting_approval"} title="Admin approval">
          {status === "awaiting_approval" && (
            <p className="text-sm text-gray-600 mt-1.5 flex items-center gap-1.5">
              <UserCheck size={14} className="text-indigo-500" /> Your parent has consented. An admin will review your account soon — we'll email you.
            </p>
          )}
        </Step>
      </ol>
      {msg && <p className={`text-sm ${msg.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
};

/** Shown to signed-in students until their account is approved. */
export const StudentGatePage: React.FC = () => {
  const { me } = useAppStore();
  if (!me) return null;
  const needsSignup = !me.student || me.student.status === null;
  return <Shell>{needsSignup ? <SignupForm me={me} /> : <StatusTracker me={me} />}</Shell>;
};
