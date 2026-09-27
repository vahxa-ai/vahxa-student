import React, { useState } from "react";
import { Edit2, GraduationCap, MapPin, School } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { studentApi } from "../services/api";
import { ProfileForm } from "../components/profile/ProfileForm";

export const ProfilePage: React.FC = () => {
  const { student, setStudent } = useAppStore();
  const [editing, setEditing] = useState(false);

  if (!student) return null;

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
          <p className="text-gray-500 text-sm mt-1">Used to personalise your AI plans and reminders</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Edit2 size={15} /> Edit
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {editing ? (
          <ProfileForm
            initial={student}
            submitLabel="Save Profile"
            onSubmit={async (data) => {
              setStudent(await studentApi.save(data));
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-lg font-semibold text-gray-800">{student.name}</h2>
              {student.age && <p className="text-sm text-gray-500">Age {student.age}</p>}
              {student.grade && (
                <p className="text-sm text-gray-600 flex items-center gap-1.5">
                  <GraduationCap size={14} className="text-indigo-500" /> {student.grade}
                </p>
              )}
              {student.school && (
                <p className="text-sm text-gray-600 flex items-center gap-1.5">
                  <School size={14} className="text-indigo-500" /> {student.school}
                </p>
              )}
              {(student.county || student.state || student.country) && (
                <p className="text-sm text-gray-600 flex items-center gap-1.5">
                  <MapPin size={14} className="text-indigo-500" />
                  {[student.county, student.state, student.country].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
