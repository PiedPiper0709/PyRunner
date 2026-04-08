from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, JSON, Column
from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class Script(SQLModel, table=True):
    """Script model - stores metadata about Python scripts"""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    file_path: str = Field(unique=True)  # Relative path from scripts/ directory
    tags: List[str] = Field(default=[], sa_column=Column(JSON))
    params_schema: dict = Field(default={}, sa_column=Column(JSON))  # JSON schema for parameters
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TaskTemplate(SQLModel, table=True):
    """Task template - saved parameter sets for scripts"""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    script_id: int = Field(foreign_key="script.id")
    params: dict = Field(default={}, sa_column=Column(JSON))  # Saved parameter values
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TaskRun(SQLModel, table=True):
    """Task run - execution history of scripts"""
    id: Optional[int] = Field(default=None, primary_key=True)
    script_id: int = Field(foreign_key="script.id", index=True)
    template_id: Optional[int] = Field(default=None, foreign_key="tasktemplate.id")
    params: dict = Field(default={}, sa_column=Column(JSON))
    status: TaskStatus = Field(default=TaskStatus.PENDING)
    stdout: str = Field(default="")
    stderr: str = Field(default="")
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    duration_ms: Optional[int] = None


class EnvVar(SQLModel, table=True):
    """Environment variable - stored with base64 encoding"""
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(unique=True, index=True)
    value: str  # Base64 encoded
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
