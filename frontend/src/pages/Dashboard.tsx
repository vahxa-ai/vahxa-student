import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, ListChecks, Sparkles,
  ArrowRight, Zap, TrendingUp,
} from "lucide-react";
import { useAppStore } from "../store/appStore";
import { activityApi, subjectApi } from "../services/api";

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { student } = useAppStore();
  const [activityCount, setActivityCount] = useState(0);
  const [subjectCount, setSubjectCount] = useState(0);

  useEffect(() => {
    activityApi.list().then((a) => setActivityCount(a.length));
    subjectApi.list().then((s) => setSubjectCount(s.length));
  }, []);

  const stats = [
    {
      label: "Subjects",
      value: subjectCount,
      icon: BookOpen,
      gradient: "from-violet-400 to-indigo-500",
      bg: "from-violet-50 to-indigo-50",
      border: "border-violet-100",
      text: "text-violet-600",
      to: "/study-planner",
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
  ];

  /* ── Main Dashboard ────────────────────────────────────────── */
  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">Good day 👋</p>
          <h1 className="text-3xl font-bold text-gray-800">{student?.name}</h1>
          <p className="text-gray-400 text-sm mt-1">Here's your overview for today</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {[
          { title: "View Activities",  desc: "See all scheduled tasks and events",       icon: ListChecks,  color: "text-indigo-500",  bg: "bg-indigo-50",  to: "/activities"    },
          { title: "Academic Tracker",  desc: "Track subjects, deadlines & reminders",    icon: TrendingUp,  color: "text-violet-500",  bg: "bg-violet-50",  to: "/study-planner" },
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
              <p className="text-white/70 text-xs">Powered by Gemma 4 on Google Vertex AI</p>
            </div>
          </div>
          <p className="text-white/80 text-sm mt-3 mb-5 max-w-lg leading-relaxed">
            Let AI create a personalized schedule based on your activities, subjects,
            school timings, and daily routine — in seconds.
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
