import React from "react";
import { ExternalLink } from "lucide-react";

export const SettingsPage: React.FC = () => {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings & Setup</h1>

      <div className="space-y-6">
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-3">🤖 AI (Gemma 4 on Vertex AI)</h2>
          <p className="text-sm text-gray-600 mb-3">
            This app uses Google's open <strong>Gemma 4 26B</strong> model, served fully managed (serverless) on Vertex AI.
            Usage is billed to your Google Cloud project.
          </p>
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
            <li>In the <a href="https://console.cloud.google.com/vertex-ai/model-garden" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1">Vertex AI Model Garden <ExternalLink size={12} /></a>, enable the Vertex AI API and the Gemma 4 26B A4B IT (MaaS) model</li>
            <li>Authenticate: <code className="bg-gray-100 px-1 rounded">gcloud auth application-default login</code></li>
            <li>Add <code className="bg-gray-100 px-1 rounded">VERTEX_PROJECT_ID=your-project</code> to <code className="bg-gray-100 px-1 rounded">backend/.env</code></li>
            <li>Restart the backend server</li>
          </ol>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-3">🗄️ Database Migration</h2>
          <p className="text-sm text-gray-600 mb-3">
            Currently using SQLite (zero setup). To migrate to PostgreSQL:
          </p>
          <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono">
            <p className="text-gray-400"># In backend/.env, change:</p>
            <p>DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/student_aid</p>
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
