import React from "react";
import { GraduationCap, User, Shield, Trash2, Edit2 } from "lucide-react";
import type { FamilyMember } from "../../types";

interface Props {
  member: FamilyMember;
  onEdit?: (member: FamilyMember) => void;
  onDelete?: (member: FamilyMember) => void;
}

const roleIcon = {
  parent: User,
  student: GraduationCap,
  guardian: Shield,
};

const roleLabel = {
  parent: "Parent",
  student: "Student",
  guardian: "Guardian",
};

export const MemberCard: React.FC<Props> = ({ member, onEdit, onDelete }) => {
  const Icon = roleIcon[member.role];
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
        style={{ backgroundColor: member.color }}
      >
        {member.avatar_initials || member.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-800 truncate">{member.name}</h3>
        <div className="flex items-center gap-1 text-gray-500 text-sm mt-0.5">
          <Icon size={14} />
          <span>{roleLabel[member.role]}</span>
          {member.age && <span className="text-gray-400">· Age {member.age}</span>}
        </div>
        {member.school && (
          <p className="text-xs text-indigo-600 mt-1 truncate">
            {member.grade && `${member.grade} · `}{member.school}
          </p>
        )}
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {onEdit && (
          <button
            onClick={() => onEdit(member)}
            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            <Edit2 size={15} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(member)}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
};
