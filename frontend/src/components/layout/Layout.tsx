import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ProfileForm } from "../profile/ProfileForm";
import { useAppStore } from "../../store/appStore";
import { studentApi } from "../../services/api";

const Onboarding: React.FC = () => {
  const { setStudent } = useAppStore();
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-indigo-50 via-white to-violet-50/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-4xl shadow-2xl shadow-indigo-200 mx-auto mb-5">
            🎓
          </div>
          <h1 className="text-3xl font-bold text-gray-800">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
              Student AI
            </span>
          </h1>
          <p className="text-gray-500 mt-2 text-sm">Tell us a little about yourself to get started</p>
        </div>
        <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100 border border-indigo-50 p-7">
          <ProfileForm
            submitLabel="Get Started →"
            onSubmit={async (data) => setStudent(await studentApi.save(data))}
          />
        </div>
      </div>
    </div>
  );
};

export const Layout: React.FC = () => {
  const { student, loaded, setStudent } = useAppStore();

  useEffect(() => {
    studentApi.get().then(setStudent);
  }, []); // eslint-disable-line

  if (!loaded) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading…</div>;
  }
  if (!student) return <Onboarding />;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gradient-to-br from-indigo-50 via-white to-violet-50/30 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
};
