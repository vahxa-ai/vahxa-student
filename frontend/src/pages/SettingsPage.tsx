import React from "react";
import { ExternalLink } from "lucide-react";

export const SettingsPage: React.FC = () => {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings & Setup</h1>

      <div className="space-y-6">
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-3">🤖 AI (Groq — Free)</h2>
          <p className="text-sm text-gray-600 mb-3">
            This app uses Groq's free API to run <strong>Llama 3.3-70b</strong>, a powerful open-source LLM.
            No credit card required.
          </p>
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
            <li>Go to <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1">console.groq.com <ExternalLink size={12} /></a></li>
            <li>Sign up for free and create an API key</li>
            <li>Add <code className="bg-gray-100 px-1 rounded">GROQ_API_KEY=your-key</code> to <code className="bg-gray-100 px-1 rounded">backend/.env</code></li>
            <li>Restart the backend server</li>
          </ol>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-3">📅 Google Calendar</h2>
          <p className="text-sm text-gray-600 mb-3">
            Sync activities to Google Calendar using OAuth 2.0.
          </p>
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
            <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1">Google Cloud Console <ExternalLink size={12} /></a></li>
            <li>Create a new project → Enable "Google Calendar API"</li>
            <li>Create OAuth 2.0 credentials (Web Application)</li>
            <li>Add <code className="bg-gray-100 px-1 rounded">http://localhost:8000/api/calendar/oauth/callback</code> as redirect URI</li>
            <li>Copy Client ID and Secret to <code className="bg-gray-100 px-1 rounded">backend/.env</code></li>
          </ol>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-3">🗄️ Database Migration</h2>
          <p className="text-sm text-gray-600 mb-3">
            Currently using SQLite (zero setup). To migrate to PostgreSQL:
          </p>
          <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono">
            <p className="text-gray-400"># In backend/.env, change:</p>
            <p>DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/family_aid</p>
            <p className="text-gray-400 mt-2"># Then run:</p>
            <p>pip install asyncpg</p>
            <p>python -m alembic upgrade head</p>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-3">🚀 Running the App</h2>
          <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono space-y-1">
            <p className="text-gray-400"># Backend</p>
            <p>cd backend && pip install -r requirements.txt</p>
            <p>cp .env.example .env  # Fill in your keys</p>
            <p>uvicorn app.main:app --reload</p>
            <p className="text-gray-400 mt-2"># Frontend</p>
            <p>cd frontend && npm install && npm start</p>
          </div>
        </section>
      </div>
    </div>
  );
};
