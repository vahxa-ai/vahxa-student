#!/bin/bash
# Start both backend and frontend in parallel

echo "🎓 Starting Student AI Assistant..."

# Backend
echo "▶ Starting FastAPI backend on http://localhost:8000"
cd backend
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "⚠  Created backend/.env from example — please set VERTEX_PROJECT_ID"
fi
pip install -r requirements.txt -q
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Frontend
echo "▶ Starting React frontend on http://localhost:3000"
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ App running:"
echo "   Frontend → http://localhost:3000"
echo "   Backend  → http://localhost:8000"
echo "   API Docs → http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

wait $BACKEND_PID $FRONTEND_PID
