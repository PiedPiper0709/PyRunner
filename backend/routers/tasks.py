from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from sqlmodel import Session, select
from typing import List, Optional
from pathlib import Path
from datetime import datetime
import asyncio
from backend.database import get_session, engine
from backend.models import TaskRun, Script, TaskStatus
from backend.runner import ScriptRunner
from pydantic import BaseModel

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

# Get scripts directory
SCRIPTS_DIR = Path(__file__).parent.parent.parent / "scripts"
# Get uploads directory
UPLOADS_DIR = Path(__file__).parent.parent.parent / "data" / "uploads"


class TaskRunRequest(BaseModel):
    script_id: int
    template_id: Optional[int] = None
    params: dict = {}


@router.get("", response_model=List[TaskRun])
def list_tasks(
    script_id: Optional[int] = None,
    status: Optional[TaskStatus] = None,
    limit: int = 100,
    session: Session = Depends(get_session)
):
    """List task execution history"""
    statement = select(TaskRun).order_by(TaskRun.started_at.desc()).limit(limit)

    if script_id:
        statement = statement.where(TaskRun.script_id == script_id)
    if status:
        statement = statement.where(TaskRun.status == status)

    tasks = session.exec(statement).all()
    return tasks


@router.get("/{task_id}", response_model=TaskRun)
def get_task(task_id: int, session: Session = Depends(get_session)):
    """Get task details by ID"""
    task = session.get(TaskRun, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


async def _execute_task(task_id: int):
    """Execute a task in the background"""
    with Session(engine) as session:
        task_run = session.get(TaskRun, task_id)
        if not task_run:
            return

        script = session.get(Script, task_run.script_id)
        if not script:
            task_run.status = TaskStatus.FAILED
            task_run.stderr = "Script not found"
            task_run.finished_at = datetime.utcnow()
            session.commit()
            return

        # Create runner and execute
        runner = ScriptRunner(SCRIPTS_DIR, session)

        # Consume the entire generator and accumulate output
        stdout_lines = []
        stderr_lines = []

        try:
            async for line in runner.run_script(task_run, script):
                # Accumulate output (runner already updates DB at the end)
                if line.startswith("STDERR:"):
                    stderr_lines.append(line[8:])  # Remove "STDERR: " prefix
                else:
                    stdout_lines.append(line)
        except Exception as e:
            # Error handling is already done in runner, but catch any unexpected issues
            print(f"Unexpected error executing task {task_id}: {e}")


@router.post("/run")
async def run_task(request: TaskRunRequest, session: Session = Depends(get_session)):
    """Create a new task run and start execution in background"""
    # Verify script exists
    script = session.get(Script, request.script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    # Create task run
    task_run = TaskRun(
        script_id=request.script_id,
        template_id=request.template_id,
        params=request.params,
        status=TaskStatus.PENDING
    )
    session.add(task_run)
    session.commit()
    session.refresh(task_run)

    # Start execution in background (don't wait)
    asyncio.create_task(_execute_task(task_run.id))

    return {"task_id": task_run.id, "status": "running"}


@router.websocket("/ws/{task_id}/logs")
async def task_logs_websocket(websocket: WebSocket, task_id: int):
    """WebSocket endpoint for streaming task logs (polls database for results)"""
    await websocket.accept()

    try:
        # Track last sent line count to only send new lines
        last_stdout_line_count = 0
        last_stderr_line_count = 0

        while True:
            # Get task from database
            with Session(engine) as session:
                task = session.get(TaskRun, task_id)
                if not task:
                    await websocket.send_json({"error": "Task not found"})
                    await websocket.close()
                    return

                # Split stdout/stderr into lines
                stdout_lines = task.stdout.splitlines() if task.stdout else []
                stderr_lines = task.stderr.splitlines() if task.stderr else []

                # Send new stdout lines
                for i in range(last_stdout_line_count, len(stdout_lines)):
                    line = stdout_lines[i]
                    await websocket.send_json({"type": "log", "data": line + "\n"})

                # Send new stderr lines
                for i in range(last_stderr_line_count, len(stderr_lines)):
                    line = stderr_lines[i]
                    await websocket.send_json({"type": "log", "data": f"STDERR: {line}\n"})

                last_stdout_line_count = len(stdout_lines)
                last_stderr_line_count = len(stderr_lines)

                # Check if task is complete
                if task.status in [TaskStatus.SUCCESS, TaskStatus.FAILED]:
                    await websocket.send_json({
                        "type": "complete",
                        "status": task.status,
                        "duration_ms": task.duration_ms
                    })
                    await websocket.close()
                    return

            # Poll every 500ms
            await asyncio.sleep(0.5)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"error": str(e)})
    finally:
        await websocket.close()


@router.delete("/{task_id}")
def delete_task(task_id: int, session: Session = Depends(get_session)):
    """Delete a task run"""
    task = session.get(TaskRun, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    session.delete(task)
    session.commit()
    return {"message": "Task deleted successfully"}


@router.post("/upload-file")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file (Excel/CSV/JSON etc.) to data/uploads directory"""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    # Add timestamp prefix to avoid conflicts
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_{file.filename}"
    target_path = UPLOADS_DIR / filename

    content = await file.read()
    target_path.write_bytes(content)

    return {"file_path": str(target_path.absolute())}
