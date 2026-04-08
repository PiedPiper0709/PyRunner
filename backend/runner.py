import asyncio
import subprocess
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, AsyncGenerator
import base64
from sqlmodel import Session
from backend.models import TaskRun, TaskStatus, EnvVar, Script


class ScriptRunner:
    """Handles script execution with streaming output"""

    def __init__(self, scripts_dir: Path, session: Session):
        self.scripts_dir = scripts_dir
        self.session = session

    def _get_env_vars(self) -> Dict[str, str]:
        """Load environment variables from database"""
        env_vars = self.session.query(EnvVar).all()
        env = os.environ.copy()

        for var in env_vars:
            # Decode base64 value
            try:
                decoded_value = base64.b64decode(var.value).decode('utf-8')
                env[var.key] = decoded_value
            except Exception:
                # If decoding fails, use as-is
                env[var.key] = var.value

        return env

    async def run_script(
        self,
        task_run: TaskRun,
        script: Script
    ) -> AsyncGenerator[str, None]:
        """
        Execute a script and yield output lines in real-time

        Args:
            task_run: TaskRun instance to update
            script: Script instance to execute

        Yields:
            Output lines from stdout/stderr
        """
        script_path = self.scripts_dir / script.file_path

        if not script_path.exists():
            error_msg = f"Script not found: {script_path}"
            task_run.status = TaskStatus.FAILED
            task_run.stderr = error_msg
            task_run.finished_at = datetime.utcnow()
            self.session.commit()
            yield f"ERROR: {error_msg}\n"
            return

        # Build command with parameters
        cmd = ["python", str(script_path)]

        # Add parameters as command line arguments
        for key, value in task_run.params.items():
            cmd.extend([f"--{key}", str(value)])

        # Update task status
        task_run.status = TaskStatus.RUNNING
        task_run.started_at = datetime.utcnow()
        self.session.commit()

        # Get environment variables
        env = self._get_env_vars()

        try:
            # Start process
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
                cwd=str(self.scripts_dir)
            )

            stdout_lines = []
            stderr_lines = []

            # Read stdout and stderr concurrently
            async def read_stream(stream, is_stderr=False):
                while True:
                    line = await stream.readline()
                    if not line:
                        break

                    decoded_line = line.decode('utf-8', errors='replace')

                    if is_stderr:
                        stderr_lines.append(decoded_line)
                        yield f"STDERR: {decoded_line}"
                    else:
                        stdout_lines.append(decoded_line)
                        yield decoded_line

            # Collect output from both streams
            async for line in self._merge_streams(
                read_stream(process.stdout, False),
                read_stream(process.stderr, True)
            ):
                yield line

            # Wait for process to complete
            await process.wait()

            # Update task run
            task_run.finished_at = datetime.utcnow()
            duration = (task_run.finished_at - task_run.started_at).total_seconds()
            task_run.duration_ms = int(duration * 1000)
            task_run.stdout = ''.join(stdout_lines)
            task_run.stderr = ''.join(stderr_lines)

            if process.returncode == 0:
                task_run.status = TaskStatus.SUCCESS
            else:
                task_run.status = TaskStatus.FAILED

            self.session.commit()

        except Exception as e:
            error_msg = f"Execution error: {str(e)}"
            task_run.status = TaskStatus.FAILED
            task_run.stderr = error_msg
            task_run.finished_at = datetime.utcnow()
            self.session.commit()
            yield f"ERROR: {error_msg}\n"

    async def _merge_streams(self, *streams):
        """Merge multiple async generators"""
        pending = {asyncio.create_task(stream.__anext__()): stream for stream in streams}

        while pending:
            done, _ = await asyncio.wait(pending.keys(), return_when=asyncio.FIRST_COMPLETED)

            for task in done:
                stream = pending.pop(task)

                try:
                    item = task.result()
                    yield item
                    # Schedule next read from same stream
                    pending[asyncio.create_task(stream.__anext__())] = stream
                except StopAsyncIteration:
                    # Stream exhausted
                    pass
