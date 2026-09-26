import React, { useState } from "react";
import {
  FileText, Loader2, Printer, CalendarDays, BarChart3,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAppStore } from "../store/appStore";
import { scheduleApi } from "../services/api";
import type { Report } from "../types";
import { format, startOfWeek } from "date-fns";

type ReportType = "daily" | "weekly";

export const ReportPage: React.FC = () => {
  const { activeFamilyId, members } = useAppStore();
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [reportDate, setReportDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [memberId, setMemberId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  // For weekly mode, snap to Monday of selected week
  const effectiveDate =
    reportType === "weekly"
      ? format(startOfWeek(new Date(reportDate + "T00:00:00"), { weekStartsOn: 1 }), "yyyy-MM-dd")
      : reportDate;

  const generate = async () => {
    if (!activeFamilyId) return;
    setLoading(true);
    setError("");
    try {
      const result = await scheduleApi.generateReport({
        family_id: activeFamilyId,
        report_date: effectiveDate,
        report_type: reportType,
        member_id: memberId ? parseInt(memberId) : undefined,
      });
      setReport(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  if (!activeFamilyId) {
    return <div className="p-8 text-center text-gray-500">Please create or select a family first.</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Schedule Reports</h1>
          <p className="text-gray-500 text-sm mt-1">AI-generated daily and weekly schedule analysis</p>
        </div>
        {report && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors print:hidden"
          >
            <Printer size={15} />
            Print / Save PDF
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6 print:hidden">

        {/* Report type tabs */}
        <div className="flex gap-2 mb-5">
          <button
            type="button"
            onClick={() => setReportType("daily")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              reportType === "daily"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
            }`}
          >
            <CalendarDays size={14} />
            Daily Report
          </button>
          <button
            type="button"
            onClick={() => setReportType("weekly")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              reportType === "weekly"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
            }`}
          >
            <BarChart3 size={14} />
            Weekly Report
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {reportType === "weekly" ? "Any date in the week" : "Date"}
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
            {reportType === "weekly" && (
              <p className="text-xs text-gray-400 mt-1">
                Week: {format(new Date(effectiveDate + "T00:00:00"), "MMM d")} –{" "}
                {format(
                  new Date(
                    new Date(effectiveDate + "T00:00:00").getTime() + 6 * 86400000
                  ),
                  "MMM d, yyyy"
                )}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Focus On</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
              <option value="">Entire Family</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}

        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 bg-indigo-600 text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Generating Report...</>
          ) : (
            <><FileText size={16} /> Generate Report</>
          )}
        </button>
      </div>

      {/* Report output */}
      {report && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-0">
          {/* Report header */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-indigo-50 print:bg-white">
            <div className="flex items-center gap-2 mb-1">
              {report.report_type === "weekly" ? (
                <BarChart3 size={16} className="text-indigo-500" />
              ) : (
                <CalendarDays size={16} className="text-indigo-500" />
              )}
              <span className="text-xs text-indigo-500 font-medium uppercase tracking-wide">
                {report.report_type === "weekly" ? "Weekly Report" : "Daily Report"}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-gray-800">
              {report.report_type === "weekly"
                ? `Week of ${format(new Date(report.report_date + "T00:00:00"), "MMMM d, yyyy")}`
                : format(new Date(report.report_date + "T00:00:00"), "EEEE, MMMM d, yyyy")}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {report.member_id
                ? `Individual report — ${members.find((m) => m.id === report.member_id)?.name}`
                : "Family-wide report"}
            </p>
          </div>

          {/* Markdown content */}
          <div className="px-6 py-5 prose prose-sm prose-indigo max-w-none">
            <ReactMarkdown>{report.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};
