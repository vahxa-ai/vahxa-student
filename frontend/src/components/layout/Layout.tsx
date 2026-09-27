import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sidebar, type ShellMode } from "./Sidebar";
import { useAppStore } from "../../store/appStore";
import { authApi, setUnauthorizedHandler } from "../../services/api";
import { SignInPage } from "../../pages/SignInPage";
import { StudentGatePage } from "../../pages/StudentGatePage";
import type { Me } from "../../types";

const modeFor = (me: Me): ShellMode | "gate" => {
  if (me.user.is_admin) return "admin";
  if (me.student?.status === "approved") return "student";
  if (me.is_parent && !me.student) return "parent";
  return "gate";
};

// Paths each shell may show (first entry is its home); students may use everything except /admin
const ALLOWED: Record<ShellMode, string[] | null> = {
  admin: ["/admin", "/parent"],
  parent: ["/parent"],
  student: null,
};

export const Layout: React.FC = () => {
  const { me, loaded, setMe, student } = useAppStore();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile drawer on navigation, and with the Escape key
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setMe(null));
    authApi.me().then(setMe).catch(() => setMe(null));
  }, []); // eslint-disable-line

  if (!loaded) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading…</div>;
  }
  if (!me) return <SignInPage />;

  const mode = modeFor(me);
  if (mode === "gate") return <StudentGatePage />;

  const allowed = ALLOWED[mode];
  if (allowed && !allowed.some((p) => pathname.startsWith(p))) return <Navigate to={allowed[0]} replace />;
  if (mode === "student" && pathname.startsWith("/admin")) return <Navigate to="/" replace />;
  if (pathname.startsWith("/parent") && !me.is_parent && mode !== "parent") return <Navigate to="/" replace />;

  return (
    <div className="lg:flex min-h-screen">
      <Sidebar mode={mode} open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2 px-3 h-14">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-controls="app-sidebar"
              aria-expanded={menuOpen}
              className="p-2.5 -ml-1 rounded-xl text-gray-600 hover:bg-gray-100"
            >
              <Menu size={22} />
            </button>
            <p className="font-bold text-gray-800 text-sm flex-1 truncate">🎓 Vahxa Student</p>
            {me.user.picture ? (
              <img src={me.user.picture} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full" />
            ) : (
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-white text-xs font-bold flex items-center justify-center">
                {(student?.name ?? me.user.email).charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-x-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-50/30 pb-[env(safe-area-inset-bottom)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
