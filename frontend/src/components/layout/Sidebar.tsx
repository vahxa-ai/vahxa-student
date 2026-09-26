import React, { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  CalendarDays, Users, ListChecks, Sparkles, Home,
  Settings, ChevronDown, Plus, Check,
  GraduationCap, ShoppingCart, Zap, UtensilsCrossed,
} from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { familyApi } from "../../services/api";

const navItems = [
  { to: "/",              icon: Home,         label: "Dashboard"     },
  { to: "/family",        icon: Users,        label: "Family"        },
  { to: "/activities",    icon: ListChecks,   label: "Activities"    },
  { to: "/study-planner", icon: GraduationCap,label: "Academic Tracker" },
  { to: "/schedule",      icon: Sparkles,     label: "AI Schedule"   },
  { to: "/meal-planner",  icon: UtensilsCrossed, label: "Meal Planner" },
  { to: "/shopping",      icon: ShoppingCart, label: "Shopping List" },
  { to: "/calendar",      icon: CalendarDays, label: "Calendar"      },
  { to: "/settings",      icon: Settings,     label: "Settings"      },
];

export const Sidebar: React.FC = () => {
  const { activeFamilyId, setActiveFamilyId, families, setFamilies, setMembers } = useAppStore();
  const [open, setOpen]           = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]     = useState("");
  const [creating, setCreating]   = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeFamily = families.find((f) => f.id === activeFamilyId);

  useEffect(() => {
    familyApi.list().then((data) => {
      setFamilies(data);
      if (!activeFamilyId && data.length > 0) setActiveFamilyId(data[0].id);
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false); setShowCreate(false); setNewName("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const switchFamily = (id: number) => {
    setActiveFamilyId(id); setMembers([]);
    setOpen(false); setShowCreate(false); setNewName("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const fam = await familyApi.create({ name: newName.trim() });
      setFamilies([...families, fam]);
      switchFamily(fam.id);
    } finally {
      setCreating(false); setNewName("");
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col min-h-screen shadow-sm">

      {/* ── Brand header ────────────────────────────────────── */}
      <div
        className="p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}
      >
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
        <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-xl shadow">
            🏠
          </div>
          <div>
            <p className="font-bold text-white text-sm tracking-wide">Vahxa-Family</p>
            <p className="text-white/60 text-xs">Smart Family Planner</p>
          </div>
        </div>
      </div>

      {/* ── Family switcher ─────────────────────────────────── */}
      <div className="px-3 py-3 border-b border-gray-100 relative" ref={dropdownRef}>
        <button
          onClick={() => { setOpen(!open); setShowCreate(false); }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 transition-colors"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {activeFamily ? activeFamily.name.charAt(0).toUpperCase() : "?"}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-semibold text-gray-700 truncate leading-tight">
              {activeFamily ? activeFamily.name : "Select a family"}
            </p>
            <p className="text-[10px] text-gray-400 leading-tight">Active workspace</p>
          </div>
          <ChevronDown
            size={13}
            className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="absolute top-full left-3 right-3 mt-1.5 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
            {families.length > 0 && (
              <div className="py-1.5">
                <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Your Families
                </p>
                {families.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => switchFamily(f.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-indigo-50 text-left transition-colors"
                  >
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {f.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm text-gray-700 truncate font-medium">{f.name}</span>
                    {f.id === activeFamilyId && <Check size={13} className="text-indigo-500 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
            {families.length > 0 && <div className="border-t border-gray-100" />}
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-indigo-50 text-indigo-600 text-sm font-medium transition-colors"
              >
                <Plus size={15} /> Create New Family
              </button>
            ) : (
              <form onSubmit={handleCreate} className="p-3">
                <input
                  autoFocus required
                  className="w-full border border-indigo-200 rounded-xl px-2.5 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-2 bg-indigo-50/50"
                  placeholder='e.g., "The Johnsons"'
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="submit" disabled={creating}
                    className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setNewName(""); }}
                    className="flex-1 border border-gray-200 text-gray-500 rounded-xl py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* ── Navigation ──────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Menu</p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
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
            <p className="text-[10px] font-semibold text-gray-600 leading-tight">Powered by Groq</p>
            <p className="text-[9px] text-gray-400 leading-tight">Llama 3.3 · Free tier</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
