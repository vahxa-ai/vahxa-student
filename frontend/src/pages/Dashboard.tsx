import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, ListChecks, CalendarDays, Sparkles,
  Plus, ArrowRight, Check, Zap, TrendingUp,
} from "lucide-react";
import { useAppStore } from "../store/appStore";
import { memberApi, activityApi, familyApi } from "../services/api";

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { activeFamilyId, setActiveFamilyId, families, setFamilies, setMembers, members } = useAppStore();
  const [activityCount, setActivityCount] = useState(0);
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!activeFamilyId) return;
    memberApi.list(activeFamilyId).then(setMembers);
  }, [activeFamilyId]);

  useEffect(() => {
    if (!members.length) { setActivityCount(0); return; }
    Promise.all(members.map((m) => activityApi.list(m.id))).then((all) =>
      setActivityCount(all.flat().length)
    );
  }, [members]);

  const createFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyName.trim()) return;
    setCreating(true);
    try {
      const fam = await familyApi.create({ name: newFamilyName.trim() });
      setFamilies([...families, fam]);
      setActiveFamilyId(fam.id);
      setMembers([]);
      setNewFamilyName("");
      setShowCreateCard(false);
    } finally {
      setCreating(false);
    }
  };

  const stats = [
    {
      label: "Family Members",
      value: members.length,
      icon: Users,
      gradient: "from-violet-400 to-indigo-500",
      bg: "from-violet-50 to-indigo-50",
      border: "border-violet-100",
      text: "text-violet-600",
      to: "/family",
    },
    {
      label: "Activities",
      value: activityCount,
      icon: ListChecks,
      gradient: "from-indigo-400 to-purple-500",
      bg: "from-indigo-50 to-purple-50",
      border: "border-indigo-100",
      text: "text-indigo-600",
      to: "/activities",
    },
    {
      label: "AI Schedules",
      value: "Generate",
      icon: Sparkles,
      gradient: "from-purple-400 to-violet-500",
      bg: "from-purple-50 to-violet-50",
      border: "border-purple-100",
      text: "text-purple-600",
      to: "/schedule",
    },
    {
      label: "Calendar Sync",
      value: "Connect",
      icon: CalendarDays,
      gradient: "from-sky-400 to-indigo-500",
      bg: "from-sky-50 to-indigo-50",
      border: "border-sky-100",
      text: "text-sky-600",
      to: "/calendar",
    },
  ];

  const activeFamily = families.find((f) => f.id === activeFamilyId);

  /* ── Onboarding ────────────────────────────────────────────── */
  if (!families.length) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-4xl shadow-2xl shadow-indigo-200 mx-auto mb-5">
              🏠
            </div>
            <h1 className="text-3xl font-bold text-gray-800">
              Welcome to{" "}
              <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
                Family AI
              </span>
            </h1>
            <p className="text-gray-500 mt-2 text-sm">Create your first family profile to get started</p>
          </div>
          <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100 border border-indigo-50 p-7">
            <form onSubmit={createFamily}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Family Name</label>
              <input
                required autoFocus
                className="w-full border border-indigo-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-indigo-50/50 mb-5 placeholder-gray-400"
                placeholder='e.g., "The Johnson Family"'
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
              />
              <button
                type="submit" disabled={creating}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-2xl py-3 font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-lg shadow-indigo-200"
              >
                {creating ? "Creating..." : "Create Family →"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main Dashboard ────────────────────────────────────────── */
  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">Good day 👋</p>
          <h1 className="text-3xl font-bold text-gray-800">{activeFamily?.name}</h1>
          <p className="text-gray-400 text-sm mt-1">Here's your family overview for today</p>
        </div>
        <button
          onClick={() => setShowCreateCard(!showCreateCard)}
          className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 bg-white border border-indigo-200 rounded-2xl px-4 py-2 hover:bg-indigo-50 hover:shadow-sm transition-all shadow-sm"
        >
          <Plus size={14} /> New Family
        </button>
      </div>

      {/* Inline create form */}
      {showCreateCard && (
        <div className="bg-white rounded-3xl border border-indigo-100 shadow-lg shadow-indigo-50 p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Create a New Family</h3>
          <form onSubmit={createFamily} className="flex gap-3">
            <input
              required autoFocus
              className="flex-1 border border-indigo-200 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-indigo-50/50"
              placeholder='e.g., "The Smith Family"'
              value={newFamilyName}
              onChange={(e) => setNewFamilyName(e.target.value)}
            />
            <button
              type="submit" disabled={creating}
              className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-2xl px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreateCard(false); setNewFamilyName(""); }}
              className="border border-gray-200 text-gray-500 rounded-2xl px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Family switcher */}
      {families.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {families.map((f) => (
            <button
              key={f.id}
              onClick={() => { setActiveFamilyId(f.id); setMembers([]); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold border transition-all ${
                f.id === activeFamilyId
                  ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-transparent shadow-md shadow-indigo-200"
                  : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              🏠 {f.name}
              {f.id === activeFamilyId && <Check size={13} />}
            </button>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, gradient, bg, border, text, to }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className={`group bg-gradient-to-br ${bg} border ${border} rounded-3xl p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 text-left relative overflow-hidden`}
          >
            <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full bg-gradient-to-br ${gradient} opacity-10`} />
            <div className={`w-11 h-11 bg-gradient-to-br ${gradient} rounded-2xl flex items-center justify-center mb-4 shadow-lg`}>
              <Icon size={20} className="text-white" />
            </div>
            <p className={`text-2xl font-extrabold ${text} mb-0.5`}>{value}</p>
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <div className={`flex items-center gap-1 ${text} text-xs mt-3 opacity-0 group-hover:opacity-100 transition-opacity font-semibold`}>
              <span>Open</span><ArrowRight size={11} />
            </div>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { title: "View Activities",  desc: "See all scheduled tasks and events",       icon: ListChecks,  color: "text-indigo-500",  bg: "bg-indigo-50",  to: "/activities"    },
          { title: "Academic Tracker",  desc: "Track subjects, deadlines & reminders",    icon: TrendingUp,  color: "text-violet-500",  bg: "bg-violet-50",  to: "/study-planner" },
          { title: "Sync Calendar",    desc: "Connect with Google Calendar",             icon: CalendarDays,color: "text-sky-500",     bg: "bg-sky-50",     to: "/calendar"      },
        ].map(({ title, desc, icon: Icon, color, bg, to }) => (
          <button
            key={title}
            onClick={() => navigate(to)}
            className="group flex items-center gap-4 bg-white border border-gray-100 rounded-3xl px-5 py-4 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left"
          >
            <div className={`w-10 h-10 ${bg} rounded-2xl flex items-center justify-center flex-shrink-0`}>
              <Icon size={18} className={color} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{title}</p>
              <p className="text-xs text-gray-400 truncate mt-0.5">{desc}</p>
            </div>
            <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-400 ml-auto flex-shrink-0 transition-colors" />
          </button>
        ))}
      </div>

      {/* AI Schedule CTA */}
      <div
        className="rounded-3xl p-7 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}
      >
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/10 translate-x-16 -translate-y-16" />
        <div className="absolute bottom-0 left-1/2 w-32 h-32 rounded-full bg-white/5 translate-y-10" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Generate Today's Schedule</h2>
              <p className="text-white/70 text-xs">Powered by Llama 3.3 via Groq (free)</p>
            </div>
          </div>
          <p className="text-white/80 text-sm mt-3 mb-5 max-w-lg leading-relaxed">
            Let AI create a personalized schedule for your family based on their activities,
            school timings, and daily routines — in seconds.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/schedule")}
              className="flex items-center gap-2 bg-white text-indigo-700 rounded-2xl px-5 py-2.5 text-sm font-bold hover:bg-indigo-50 transition-colors shadow-lg"
            >
              <Zap size={15} /> Generate Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
