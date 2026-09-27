import React, { useEffect, useRef, useState } from "react";
import { authApi, apiErrorMessage } from "../../services/api";
import type { Me } from "../../types";

declare global {
  interface Window { google?: any }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";
let gisLoader: Promise<void> | null = null;
let clientIdPromise: Promise<string> | null = null;

const loadGis = () =>
  (gisLoader ??= new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { gisLoader = null; reject(new Error("Could not load Google Sign-In.")); };
    document.head.appendChild(script);
  }));

const getClientId = () => (clientIdPromise ??= authApi.config().then((c) => c.google_client_id));

interface Props {
  onSignedIn: (me: Me) => void;
  /** Pre-select this account in Google's chooser (e.g. the parent's email on a consent link). */
  loginHint?: string;
  text?: "signin_with" | "continue_with" | "signup_with";
}

/** Official "Sign in with Google" button; posts the ID token to the backend, which sets a session cookie. */
export const GoogleSignInButton: React.FC<Props> = ({ onSignedIn, loginHint, text = "continue_with" }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const onSignedInRef = useRef(onSignedIn);
  onSignedInRef.current = onSignedIn;

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadGis(), getClientId()])
      .then(([, clientId]) => {
        if (cancelled || !ref.current) return;
        if (!clientId) { setError("Google sign-in isn't configured on the server yet."); return; }
        window.google.accounts.id.initialize({
          client_id: clientId,
          login_hint: loginHint,
          ux_mode: "popup",
          callback: async ({ credential }: { credential: string }) => {
            setBusy(true);
            setError(null);
            try {
              onSignedInRef.current(await authApi.signInWithGoogle(credential));
            } catch (err) {
              setError(apiErrorMessage(err, "Sign-in failed. Please try again."));
            } finally {
              setBusy(false);
            }
          },
        });
        window.google.accounts.id.renderButton(ref.current, {
          theme: "outline", size: "large", shape: "pill", text, width: 280,
        });
      })
      .catch((err) => setError(err.message));
    return () => { cancelled = true; };
  }, [loginHint, text]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={ref} className={busy ? "opacity-50 pointer-events-none" : ""} />
      {busy && <p className="text-xs text-gray-400">Signing you in…</p>}
      {error && <p className="text-xs text-red-600 text-center max-w-xs">{error}</p>}
    </div>
  );
};
