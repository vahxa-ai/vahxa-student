import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { parentApi, apiErrorMessage } from "../services/api";
import type { ParentChild } from "../types";

const fmt = (d: string | null) => (d ? format(new Date(d + "Z"), "MMM d, yyyy") : "");

/** Parents see the children they've consented for and can withdraw consent. */
export const ParentPage: React.FC = () => {
  const [children, setChildren] = useState<ParentChild[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    parentApi.children().then(setChildren).catch((err) => setError(apiErrorMessage(err)));
  }, []);

  const revoke = async (child: ParentChild) => {
    if (!window.confirm(`Withdraw consent for ${child.student_name}? Their access stops immediately.`)) return;
    setBusyId(child.consent_id);
    try {
      const updated = await parentApi.revoke(child.consent_id);
      setChildren((list) => list && list.map((c) => (c.consent_id === updated.consent_id ? updated : c)));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800">Parental consent</h1>
      <p className="text-gray-500 text-sm mt-1 mb-6">Children you've given consent for. You can withdraw it at any time.</p>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {!children ? (
        <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>
      ) : children.length === 0 ? (
        <p className="text-sm text-gray-500">No consents yet. Use the link in the consent email your child's sign-up sent you.</p>
      ) : (
        <div className="space-y-3">
          {children.map((c) => (
            <div key={c.consent_id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
              {c.consent_status === "granted"
                ? <ShieldCheck size={22} className="text-emerald-500 flex-shrink-0" />
                : <ShieldOff size={22} className="text-gray-300 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{c.student_name}</p>
                <p className="text-xs text-gray-500 truncate">{c.student_email}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {c.consent_status === "granted" ? `Consent given ${fmt(c.granted_at)}` : `Withdrawn ${fmt(c.revoked_at)}`}
                </p>
              </div>
              {c.consent_status === "granted" && (
                <button onClick={() => revoke(c)} disabled={busyId === c.consent_id}
                  className="text-xs font-medium border border-rose-200 text-rose-600 rounded-lg px-3 py-1.5 hover:bg-rose-50 disabled:opacity-50">
                  {busyId === c.consent_id ? "Withdrawing…" : "Withdraw consent"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
