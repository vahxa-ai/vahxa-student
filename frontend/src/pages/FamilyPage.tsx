import React, { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { memberApi } from "../services/api";
import { MemberCard } from "../components/family/MemberCard";
import { MemberForm } from "../components/family/MemberForm";
import type { FamilyMember } from "../types";

export const FamilyPage: React.FC = () => {
  const { activeFamilyId, members, setMembers } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<FamilyMember | null>(null);

  useEffect(() => {
    if (!activeFamilyId) return;
    memberApi.list(activeFamilyId).then(setMembers);
  }, [activeFamilyId]);

  const handleAdd = async (data: Parameters<typeof memberApi.create>[1]) => {
    if (!activeFamilyId) return;
    const member = await memberApi.create(activeFamilyId, data);
    setMembers([...members, member]);
    setShowForm(false);
  };

  const handleEdit = async (data: Partial<FamilyMember> & { name: string }) => {
    if (!activeFamilyId || !editTarget) return;
    const updated = await memberApi.update(activeFamilyId, editTarget.id, data);
    setMembers(members.map((m) => (m.id === updated.id ? updated : m)));
    setEditTarget(null);
  };

  const handleDelete = async (member: FamilyMember) => {
    if (!activeFamilyId) return;
    if (!window.confirm(`Remove ${member.name} from the family?`)) return;
    await memberApi.delete(activeFamilyId, member.id);
    setMembers(members.filter((m) => m.id !== member.id));
  };

  if (!activeFamilyId) {
    return (
      <div className="p-8 text-center text-gray-500">
        Please create or select a family first.
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Family Members</h1>
          <p className="text-gray-500 text-sm mt-1">{members.length} member{members.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Add Member
        </button>
      </div>

      {(showForm || editTarget) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800">
                {editTarget ? "Edit Member" : "Add Family Member"}
              </h2>
              <button
                onClick={() => { setShowForm(false); setEditTarget(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <MemberForm
              initial={editTarget ?? {}}
              onSubmit={editTarget ? handleEdit : handleAdd}
              onCancel={() => { setShowForm(false); setEditTarget(null); }}
            />
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p>No family members yet. Add your first member!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              onEdit={setEditTarget}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Quick fix for missing import
const Users: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
