from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db.database import init_db
from app.api.routes import student, activities, schedule, subjects, deadlines, curriculum


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(student.router, prefix="/api")
app.include_router(activities.router, prefix="/api")
app.include_router(subjects.router, prefix="/api")
app.include_router(schedule.router, prefix="/api")
app.include_router(deadlines.router, prefix="/api")
app.include_router(curriculum.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.app_name}


# ─── Built frontend (production) ──────────────────────────────────────────────
# When FRONTEND_DIST points at the React build, serve it from this same service.
# Unknown non-API paths return index.html so client-side routes work on refresh.
_dist = Path(settings.frontend_dist).resolve() if settings.frontend_dist else None
if _dist and (_dist / "index.html").is_file():
    app.mount("/static", StaticFiles(directory=_dist / "static"), name="static")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        file = (_dist / path).resolve()
        if path and file.is_file() and file.is_relative_to(_dist):
            return FileResponse(file)
        return FileResponse(_dist / "index.html")
