import React from "react";
import { GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { GoogleSignInButton } from "../components/auth/GoogleSignInButton";
import { useAppStore } from "../store/appStore";

export const SignInPage: React.FC = () => {
  const { setMe } = useAppStore();
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-indigo-50 via-white to-violet-50/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-4xl shadow-2xl shadow-indigo-200 mx-auto mb-5">
            🎓
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Vahxa{" "}
            <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">Student</span>
          </h1>
          <p className="text-gray-500 mt-2 text-sm">Your AI study planner — curriculum, notes, practice and schedules</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100 border border-indigo-50 p-7">
          <GoogleSignInButton onSignedIn={setMe} />
          <ul className="mt-6 space-y-2.5 text-sm text-gray-600">
            <li className="flex gap-2"><GraduationCap size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
              Students: sign in with your Gmail account to sign up.</li>
            <li className="flex gap-2"><ShieldCheck size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
              A parent or guardian must give consent, and an admin approves each account.</li>
            <li className="flex gap-2"><Sparkles size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
              Parents: use the link in your consent email, or sign in to manage consent.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
