from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from typing import List, Optional
from backend.database import get_session
from backend.models import Script
from datetime import datetime
from pathlib import Path

router = APIRouter(prefix="/api/scripts", tags=["scripts"])

# Get scripts directory
SCRIPTS_DIR = Path(__file__).parent.parent.parent / "scripts"


@router.get("", response_model=List[Script])
def list_scripts(
    tag: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """List all scripts, optionally filter by tag"""
    statement = select(Script)
    scripts = session.exec(statement).all()

    if tag:
        scripts = [s for s in scripts if tag in s.tags]

    return scripts


@router.get("/{script_id}", response_model=Script)
def get_script(script_id: int, session: Session = Depends(get_session)):
    """Get script by ID"""
    script = session.get(Script, script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    return script


@router.post("", response_model=Script)
def create_script(script: Script, session: Session = Depends(get_session)):
    """Create a new script"""
    script.created_at = datetime.utcnow()
    script.updated_at = datetime.utcnow()
    session.add(script)
    session.commit()
    session.refresh(script)
    return script


@router.put("/{script_id}", response_model=Script)
def update_script(
    script_id: int,
    script_update: Script,
    session: Session = Depends(get_session)
):
    """Update an existing script"""
    script = session.get(Script, script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    # Update fields
    script.name = script_update.name
    script.description = script_update.description
    script.file_path = script_update.file_path
    script.tags = script_update.tags
    script.params_schema = script_update.params_schema
    script.updated_at = datetime.utcnow()

    session.add(script)
    session.commit()
    session.refresh(script)
    return script


@router.delete("/{script_id}")
def delete_script(script_id: int, session: Session = Depends(get_session)):
    """Delete a script"""
    script = session.get(Script, script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    session.delete(script)
    session.commit()
    return {"message": "Script deleted successfully"}


@router.post("/upload")
async def upload_script(file: UploadFile = File(...)):
    """Upload a .py file to the scripts directory"""
    if not file.filename or not file.filename.endswith(".py"):
        raise HTTPException(status_code=400, detail="Only .py files are allowed")

    SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

    # De-duplicate filename: if exists, add _1, _2, ...
    stem = Path(file.filename).stem
    suffix = Path(file.filename).suffix
    target_path = SCRIPTS_DIR / file.filename
    counter = 1
    while target_path.exists():
        target_path = SCRIPTS_DIR / f"{stem}_{counter}{suffix}"
        counter += 1

    content = await file.read()
    target_path.write_bytes(content)

    return {"filename": target_path.name, "file_path": target_path.name}
