import React from "react";
import { NavLink } from "react-router-dom";
import {
  UserRound, ListChecks, Sparkles, Home,
  Settings, GraduationCap, Zap, Users, ShieldCheck, LogOut, X,
} from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { authApi } from "../../services/api";

export type ShellMode = "student" | "admin" | "parent";

const STUDENT_NAV = [
  { to: "/",              icon: Home,         label: "Dashboard"     },
  { to: "/activities",    icon: ListChecks,   label: "Activities"    },
  { to: "/study-planner", icon: GraduationCap,label: "Academic Tracker" },
  { to: "/schedule",      icon: Sparkles,     label: "AI Schedule"   },
  { to: "/profile",       icon: UserRound,    label: "My Profile"    },
  { to: "/settings",      icon: Settings,     label: "Settings"      },
];
const ADMIN_NAV = [{ to: "/admin", icon: Users, label: "Students" }];
const PARENT_NAV = [{ to: "/parent", icon: ShieldCheck, label: "Parental consent" }];

interface SidebarProps {
  mode: ShellMode;
  /** Mobile drawer state (ignored on large screens, where the sidebar is always shown). */
  open: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mode, open, onClose }) => {
  const { me, student, setMe } = useAppStore();
  const navItems = [
    ...(mode === "student" ? STUDENT_NAV : mode === "admin" ? ADMIN_NAV : []),
    ...(me?.is_parent || mode === "parent" ? PARENT_NAV : []),
  ];
  const displayName = student?.name ?? me?.user.name ?? me?.user.email ?? "";
  const subtitle = mode === "admin" ? "Administrator" : mode === "parent" ? "Parent / guardian"
    : [student?.grade, student?.school].filter(Boolean).join(" · ") || "Student";
  const signOut = async () => { await authApi.logout(); setMe(null); };

  return (
    <>
    {/* Mobile backdrop */}
    <div
      aria-hidden="true"
      onClick={onClose}
      className={`print:hidden fixed inset-0 z-30 bg-black/40 transition-opacity lg:hidden ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    />
    <aside
      id="app-sidebar"
      aria-label="Main navigation"
      className={`print:hidden fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] bg-white border-r border-gray-100 flex flex-col shadow-xl
        transform transition-transform duration-200 ease-out pb-[env(safe-area-inset-bottom)]
        lg:static lg:z-auto lg:w-64 lg:max-w-none lg:min-h-screen lg:shadow-sm lg:translate-x-0
        ${open ? "translate-x-0" : "-translate-x-full"}`}
    >

      {/* ── Brand header ────────────────────────────────────── */}
      <div
        className="p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}
      >
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
        <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-xl shadow">
            🎓
          </div>
          <div className="flex-1">
            <p className="font-bold text-white text-sm tracking-wide">Vahxa-Student</p>
            <p className="text-white/60 text-xs">Smart Student Planner</p>
          </div>
          <button onClick={onClose} aria-label="Close menu"
            className="lg:hidden p-2 -mr-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* ── Student card ─────────────────────────────────────── */}
      <div className="px-3 py-3 border-b border-gray-100">
        <div className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-indigo-50">
          {me?.user.picture ? (
            <img src={me.user.picture} alt="" referrerPolicy="no-referrer" className="w-7 h-7 rounded-lg flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {displayName.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-semibold text-gray-700 truncate leading-tight">{displayName}</p>
            <p className="text-[10px] text-gray-400 leading-tight truncate">{subtitle}</p>
          </div>
          <button onClick={signOut} title={`Sign out ${me?.user.email ?? ""}`} aria-label="Sign out"
            className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-white transition-colors">
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Menu</p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 shadow-sm border border-indigo-100"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                  isActive
                    ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-400"
                }`}>
                  <Icon size={14} />
                </span>
                <span className={isActive ? "font-semibold" : ""}>{label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Footer ──────────────────────────────────────────── */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-2 px-2 py-2 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center flex-shrink-0">
            <Zap size={11} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-600 leading-tight">Powered by Gemma 4</p>
            <p className="text-[9px] text-gray-400 leading-tight">Google Vertex AI</p>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
};
