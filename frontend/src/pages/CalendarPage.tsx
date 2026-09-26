import React, { useEffect, useState } from "react";
import { CalendarDays, ExternalLink, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { calendarApi } from "../services/api";
import type { CalendarEvent } from "../types";
import { format } from "date-fns";

export const CalendarPage: React.FC = () => {
  const { activeFamilyId, members } = useAppStore();
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(false);

  useEffect(() => {
    if (!activeFamilyId) return;
    calendarApi.status(activeFamilyId).then((s) => {
      setConnected(s.connected);
      if (s.connected) loadEvents();
    });

    // Check if returning from OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setConnected(true);
      loadEvents();
    }
  }, [activeFamilyId]);

  const loadEvents = async () => {
    if (!activeFamilyId) return;
    try {
      const data = await calendarApi.getEvents(activeFamilyId, 14);
      setEvents(data);
    } catch {
      // not connected yet
    }
  };

  const handleConnect = async () => {
    if (!activeFamilyId) return;
    setLoadingAuth(true);
    try {
      const { auth_url } = await calendarApi.startOAuth(activeFamilyId);
      window.location.href = auth_url;
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleSync = async (memberId: number) => {
    if (!activeFamilyId) return;
    setSyncing(memberId);
    try {
      const result = await calendarApi.syncMember(activeFamilyId, memberId);
      alert(`Synced ${result.synced} of ${result.total} activities to Google Calendar!`);
      await loadEvents();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  const formatEventTime = (dateStr: string) => {
    try {
      if (dateStr.includes("T")) return format(new Date(dateStr), "MMM d, h:mm a");
      return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  if (!activeFamilyId) {
    return <div className="p-8 text-center text-gray-500">Please create or select a family first.</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Google Calendar</h1>
        <p className="text-gray-500 text-sm mt-1">Sync family activities to Google Calendar</p>
      </div>

      {/* Connection Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          {connected ? (
            <CheckCircle2 size={20} className="text-indigo-500" />
          ) : (
            <AlertCircle size={20} className="text-amber-500" />
          )}
          <span className="font-medium text-gray-800">
            {connected ? "Google Calendar Connected" : "Google Calendar Not Connected"}
          </span>
        </div>

        {!connected ? (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Connect your Google Calendar to sync family activities and view upcoming events.
            </p>
            <button
              onClick={handleConnect}
              disabled={loadingAuth}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <CalendarDays size={16} />
              {loadingAuth ? "Redirecting..." : "Connect Google Calendar"}
              <ExternalLink size={14} className="text-gray-400" />
            </button>
            <p className="text-xs text-gray-400 mt-2">
              Requires Google OAuth setup in backend .env
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-indigo-600 mb-4">
              Your calendar is connected. Sync individual member activities below.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleSync(m.id)}
                  disabled={syncing === m.id}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition-colors disabled:opacity-50"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.avatar_initials[0]}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{m.name}</span>
                  <RefreshCw
                    size={14}
                    className={`ml-auto text-gray-400 ${syncing === m.id ? "animate-spin" : ""}`}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upcoming Events */}
      {connected && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Upcoming Events (14 days)</h2>
            <button onClick={loadEvents} className="text-indigo-500 hover:text-indigo-700 text-sm">
              Refresh
            </button>
          </div>
          {events.length === 0 ? (
            <p className="text-gray-400 text-sm">No upcoming events found.</p>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-gray-800">{ev.summary}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatEventTime(ev.start)}</p>
                    {ev.location && (
                      <p className="text-xs text-gray-400">{ev.location}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
