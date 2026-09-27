import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, LogOut, ShieldCheck, XCircle } from "lucide-react";
import { GoogleSignInButton } from "../components/auth/GoogleSignInButton";
import { useAppStore } from "../store/appStore";
import { authApi, consentApi, apiErrorMessage } from "../services/api";
import type { ConsentInfo } from "../types";

/**
 * Consent wording shown to parents. The backend records CONSENT_VERSION with each consent,
 * so bump it (backend setting `consent_version`) whenever this text changes.
 * ⚠ Have this reviewed for the laws that apply to your users (e.g. COPPA in the US) before launch.
 */
const ConsentText: React.FC<{ studentName: string }> = ({ studentName }) => (
  <div className="text-sm text-gray-700 space-y-3 leading-relaxed">
    <p>
      <b>{studentName}</b> would like to use <b>Vahxa Student</b>, a study planner that organises school subjects,
      deadlines and daily schedules, and uses AI to prepare curriculum notes and practice questions.
    </p>
    <div>
      <p className="font-semibold text-gray-800">What we collect about your child</p>
      <ul className="list-disc ml-5 mt-1 space-y-0.5">
        <li>Their Google account email and name</li>
        <li>Profile details they enter: age, grade, school, and county/state/country</li>
        <li>Study information they enter: subjects, activities, deadlines and daily routine</li>
      </ul>
    </div>
    <div>
      <p className="font-semibold text-gray-800">How it's used</p>
      <ul className="list-disc ml-5 mt-1 space-y-0.5">
        <li>Only to provide the planner to your child. We don't sell it or use it for advertising.</li>
        <li>Their grade, location, subjects, activities and routine are sent to Google Cloud's Vertex AI (Gemma model)
          to generate schedules, curriculum notes and practice questions.</li>
        <li>Generated curriculum content (not your child's personal details) may be reused for other students in the
          same grade and region.</li>
        <li>The app's administrator can see your child's profile to approve and manage accounts.</li>
      </ul>
    </div>
    <p>
      You can withdraw consent at any time by signing in to Vahxa Student with this Google account. Your child's
      access stops immediately. To have their data deleted, contact the administrator.
    </p>
  </div>
);

export const ConsentPage: React.FC = () => {
  const token = useParams().token ?? "";
  const { me, setMe, loaded } = useAppStore();
  const [info, setInfo] = useState<ConsentInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({ parent_full_name: "", relationship: "Parent", agree: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    consentApi.info(token).then(setInfo).catch((err) => setLoadError(apiErrorMessage(err, "This consent link is not valid.")));
    if (!loaded) authApi.me().then(setMe).catch(() => setMe(null));
  }, [token]); // eslint-disable-line

  const act = async (fn: () => Promise<ConsentInfo>) => {
    setBusy(true); setError(null);
    try { setInfo(await fn()); } catch (err) { setError(apiErrorMessage(err)); } finally { setBusy(false); }
  };
  const signOut = async () => { await authApi.logout(); setMe(null); };

  const card = (children: React.ReactNode) => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50/30 px-4 py-10">
      <div className="max-w-xl mx-auto">
        <p className="font-bold text-gray-800 mb-6">🎓 Vahxa Student — Parental consent</p>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">{children}</div>
      </div>
    </div>
  );

  if (loadError) return card(<p className="text-sm text-red-600">{loadError}</p>);
  if (!info || !loaded) return card(<p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>);

  if (info.status === "granted") return card(
    <div className="text-center">
      <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3" />
      <h1 className="text-lg font-bold text-gray-800">Thank you — consent recorded</h1>
      <p className="text-sm text-gray-600 mt-2">
        {info.student_name}'s account will be reviewed by an admin. You can withdraw consent any time from your{" "}
        <Link to="/parent" className="text-indigo-600 underline">parent page</Link>.
      </p>
    </div>
  );
  if (info.status !== "pending" || info.expired) return card(
    <div className="text-center">
      <XCircle size={40} className="mx-auto text-gray-300 mb-3" />
      <h1 className="text-lg font-bold text-gray-800">
        {info.expired ? "This link has expired" : info.status === "revoked" ? "Consent was declined" : "This link is no longer active"}
      </h1>
      <p className="text-sm text-gray-600 mt-2">Ask {info.student_name} to send a new consent request from the app if needed.</p>
    </div>
  );

  const rightAccount = me && me.user.email === info.parent_email;
  return card(
    <>
      <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4">
        <ShieldCheck size={20} className="text-indigo-500" /> Consent for {info.student_name}
      </h1>
      <ConsentText studentName={info.student_name} />

      <div className="mt-6 pt-5 border-t border-gray-100">
        {!me ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-600">To respond, sign in with <b>{info.parent_email}</b>.</p>
            <GoogleSignInButton onSignedIn={setMe} loginHint={info.parent_email} />
          </div>
        ) : !rightAccount ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-700">
              You're signed in as <b>{me.user.email}</b>, but this request was sent to <b>{info.parent_email}</b>.
            </p>
            <button onClick={signOut} className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
              <LogOut size={14} /> Sign out and use {info.parent_email}
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); act(() => consentApi.grant(token, form)); }} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Your full name *</label>
                <input required minLength={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.parent_full_name} onChange={(e) => setForm((f) => ({ ...f, parent_full_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Relationship *</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.relationship}
                  onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}>
                  {["Parent", "Mother", "Father", "Legal guardian"].map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5" checked={form.agree}
                onChange={(e) => setForm((f) => ({ ...f, agree: e.target.checked }))} />
              I am {info.student_name}'s parent or legal guardian, I have read the information above, and I consent to
              their use of Vahxa Student as described. (Consent version {info.consent_version})
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={busy || !form.agree}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                {busy ? "Saving…" : "I consent"}
              </button>
              <button type="button" disabled={busy}
                onClick={() => window.confirm("Decline consent? Your child won't be able to use the app.") && act(() => consentApi.decline(token))}
                className="px-4 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
                Decline
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
};
