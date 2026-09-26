import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { GeneratedSchedule } from "../../types";
import { format } from "date-fns";
import { Clock, MapPin } from "lucide-react";

interface Props {
  schedule: GeneratedSchedule;
}

export const ScheduleViewer: React.FC<Props> = ({ schedule }) => {
  const startLabel = format(new Date(schedule.schedule_date + "T00:00:00"), "EEEE, MMMM d, yyyy");
  const endLabel =
    schedule.schedule_end_date && schedule.schedule_end_date !== schedule.schedule_date
      ? format(new Date(schedule.schedule_end_date + "T00:00:00"), "EEEE, MMMM d, yyyy")
      : null;

  const fmtTime = (t: string | null) =>
    t ? t.slice(0, 5).replace(/^0/, "") : null;
  const startTimeLabel = fmtTime(schedule.schedule_start_time);
  const endTimeLabel = fmtTime(schedule.schedule_end_time);
  const timeLabel = startTimeLabel && endTimeLabel
    ? `${startTimeLabel} – ${endTimeLabel}`
    : startTimeLabel ?? endTimeLabel;

  return (
    <div className="bg-white rounded-3xl shadow-sm shadow-indigo-50 border border-indigo-100 overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-5 border-b border-indigo-100"
        style={{ background: "linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
            schedule.is_family_wide
              ? "bg-indigo-100 text-indigo-700"
              : "bg-violet-100 text-violet-700"
          }`}>
            {schedule.is_family_wide ? "Family Schedule" : "Individual Schedule"}
          </span>
        </div>
        <h2 className="text-base font-bold text-gray-800 mt-1.5">
          {endLabel ? `${startLabel} – ${endLabel}` : startLabel}
        </h2>
        <div className="flex flex-wrap gap-3 mt-2">
          {timeLabel && (
            <span className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 rounded-full px-2.5 py-1">
              <Clock size={11} />
              {startTimeLabel && endTimeLabel ? timeLabel : `Starts ${timeLabel}`}
            </span>
          )}
          {schedule.location && (
            <span className="flex items-center gap-1.5 text-xs text-violet-600 bg-violet-50 rounded-full px-2.5 py-1">
              <MapPin size={11} /> {schedule.location}
            </span>
          )}
          <span className="text-xs text-gray-400 self-center">
            Generated {format(new Date(schedule.created_at), "MMM d 'at' h:mm a")}
          </span>
        </div>
      </div>

      <div className="px-6 py-5 prose prose-sm max-w-none overflow-x-auto">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ children }) => (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border border-gray-200 rounded-lg text-sm">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }}>
                {children}
              </thead>
            ),
            th: ({ children }) => (
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-4 py-2.5 text-gray-700 border-b border-indigo-50 align-top text-sm">
                {children}
              </td>
            ),
            tr: ({ children }) => (
              <tr className="even:bg-indigo-50/40 hover:bg-indigo-50/70 transition-colors">
                {children}
              </tr>
            ),
          }}
        >
          {schedule.content}
        </ReactMarkdown>
      </div>
    </div>
  );
};
