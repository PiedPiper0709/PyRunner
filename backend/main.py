from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from backend.database import init_db
from backend.routers import scripts, tasks, templates, envs, shell


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup: Initialize database
    init_db()
    print("✅ Database initialized")

    # Create uploads directory
    from pathlib import Path
    uploads_dir = Path(__file__).parent.parent / "data" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    print("✅ Uploads directory created")

    # Fix pending tasks (mark as failed since server restarted)
    from backend.database import engine
    from backend.models import TaskRun, TaskStatus
    from sqlmodel import Session, select
    from datetime import datetime

    with Session(engine) as session:
        statement = select(TaskRun).where(TaskRun.status == TaskStatus.PENDING)
        pending_tasks = session.exec(statement).all()

        for task in pending_tasks:
            task.status = TaskStatus.FAILED
            task.stderr = "Server restarted, task was not executed"
            task.finished_at = datetime.utcnow()

        if pending_tasks:
            session.commit()
            print(f"⚠️  Marked {len(pending_tasks)} pending tasks as failed")

    yield
    # Shutdown: cleanup if needed
    print("👋 Shutting down...")


app = FastAPI(
    title="PyRunner API",
    description="Python script management and task execution platform",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(scripts.router)
app.include_router(tasks.router)
app.include_router(templates.router)
app.include_router(envs.router)
app.include_router(shell.router)


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "name": "PyRunner API",
        "version": "0.1.0",
        "status": "running"
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
