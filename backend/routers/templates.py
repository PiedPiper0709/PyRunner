from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from backend.database import get_session
from backend.models import TaskTemplate
from datetime import datetime

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=List[TaskTemplate])
def list_templates(
    script_id: int = None,
    session: Session = Depends(get_session)
):
    """List all task templates, optionally filter by script"""
    statement = select(TaskTemplate).order_by(TaskTemplate.created_at.desc())

    if script_id:
        statement = statement.where(TaskTemplate.script_id == script_id)

    templates = session.exec(statement).all()
    return templates


@router.get("/{template_id}", response_model=TaskTemplate)
def get_template(template_id: int, session: Session = Depends(get_session)):
    """Get template by ID"""
    template = session.get(TaskTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("", response_model=TaskTemplate)
def create_template(template: TaskTemplate, session: Session = Depends(get_session)):
    """Create a new task template"""
    template.created_at = datetime.utcnow()
    session.add(template)
    session.commit()
    session.refresh(template)
    return template


@router.put("/{template_id}", response_model=TaskTemplate)
def update_template(
    template_id: int,
    template_update: TaskTemplate,
    session: Session = Depends(get_session)
):
    """Update an existing template"""
    template = session.get(TaskTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    template.name = template_update.name
    template.params = template_update.params
    session.add(template)
    session.commit()
    session.refresh(template)
    return template


@router.delete("/{template_id}")
def delete_template(template_id: int, session: Session = Depends(get_session)):
    """Delete a template"""
    template = session.get(TaskTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    session.delete(template)
    session.commit()
    return {"message": "Template deleted successfully"}
