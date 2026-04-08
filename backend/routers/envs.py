from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from backend.database import get_session
from backend.models import EnvVar
from datetime import datetime
import base64
from pydantic import BaseModel

router = APIRouter(prefix="/api/envs", tags=["envs"])


class EnvVarResponse(BaseModel):
    """Response model that hides the actual value"""
    id: int
    key: str
    description: str | None
    created_at: datetime
    has_value: bool = True


class EnvVarCreate(BaseModel):
    key: str
    value: str
    description: str | None = None


@router.get("", response_model=List[EnvVarResponse])
def list_env_vars(session: Session = Depends(get_session)):
    """List all environment variables (values hidden)"""
    statement = select(EnvVar).order_by(EnvVar.key)
    env_vars = session.exec(statement).all()

    return [
        EnvVarResponse(
            id=env.id,
            key=env.key,
            description=env.description,
            created_at=env.created_at,
            has_value=bool(env.value)
        )
        for env in env_vars
    ]


@router.get("/{env_id}/reveal")
def reveal_env_var(env_id: int, session: Session = Depends(get_session)):
    """Reveal the actual value of an environment variable (decoded)"""
    env_var = session.get(EnvVar, env_id)
    if not env_var:
        raise HTTPException(status_code=404, detail="Environment variable not found")

    try:
        decoded_value = base64.b64decode(env_var.value).decode('utf-8')
    except Exception:
        decoded_value = env_var.value

    return {"key": env_var.key, "value": decoded_value}


@router.post("", response_model=EnvVarResponse)
def create_env_var(env_create: EnvVarCreate, session: Session = Depends(get_session)):
    """Create a new environment variable"""
    # Check if key already exists
    statement = select(EnvVar).where(EnvVar.key == env_create.key)
    existing = session.exec(statement).first()
    if existing:
        raise HTTPException(status_code=400, detail="Environment variable with this key already exists")

    # Encode value with base64
    encoded_value = base64.b64encode(env_create.value.encode('utf-8')).decode('utf-8')

    env_var = EnvVar(
        key=env_create.key,
        value=encoded_value,
        description=env_create.description,
        created_at=datetime.utcnow()
    )

    session.add(env_var)
    session.commit()
    session.refresh(env_var)

    return EnvVarResponse(
        id=env_var.id,
        key=env_var.key,
        description=env_var.description,
        created_at=env_var.created_at,
        has_value=True
    )


@router.put("/{env_id}", response_model=EnvVarResponse)
def update_env_var(
    env_id: int,
    env_update: EnvVarCreate,
    session: Session = Depends(get_session)
):
    """Update an existing environment variable"""
    env_var = session.get(EnvVar, env_id)
    if not env_var:
        raise HTTPException(status_code=404, detail="Environment variable not found")

    # Encode new value
    encoded_value = base64.b64encode(env_update.value.encode('utf-8')).decode('utf-8')

    env_var.key = env_update.key
    env_var.value = encoded_value
    env_var.description = env_update.description

    session.add(env_var)
    session.commit()
    session.refresh(env_var)

    return EnvVarResponse(
        id=env_var.id,
        key=env_var.key,
        description=env_var.description,
        created_at=env_var.created_at,
        has_value=True
    )


@router.delete("/{env_id}")
def delete_env_var(env_id: int, session: Session = Depends(get_session)):
    """Delete an environment variable"""
    env_var = session.get(EnvVar, env_id)
    if not env_var:
        raise HTTPException(status_code=404, detail="Environment variable not found")

    session.delete(env_var)
    session.commit()
    return {"message": "Environment variable deleted successfully"}
