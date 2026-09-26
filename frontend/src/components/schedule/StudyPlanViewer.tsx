import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { StudyPlan } from "../../types";
import { format } from "date-fns";
import { BookOpen } from "lucide-react";

interface Props {
  plan: StudyPlan;
  studentName?: string;
}

export const StudyPlanViewer: React.FC<Props> = ({ plan, studentName }) => {
  const weekLabel = format(new Date(plan.week_start + "T00:00:00"), "MMMM d, yyyy");

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center gap-2 mb-0.5">
          <BookOpen size={15} className="text-indigo-500" />
          <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">
            Weekly Study Plan{studentName ? ` — ${studentName}` : ""}
          </p>
        </div>
        <h3 className="text-base font-semibold text-gray-800">
          Week of {weekLabel}
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Generated {format(new Date(plan.created_at), "MMM d 'at' h:mm a")}
        </p>
      </div>

      <div className="px-6 py-5 prose prose-sm prose-indigo max-w-none study-plan-content overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {plan.content}
        </ReactMarkdown>
      </div>
    </div>
  );
};
