from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import subprocess
import os
from pathlib import Path

router = APIRouter(prefix="/api/shell", tags=["shell"])


class OpenFolderRequest(BaseModel):
    path: str


@router.post("/open-folder")
async def open_folder(request: OpenFolderRequest):
    """Open a folder or file in Finder (macOS)"""
    path = Path(request.path)

    # Validate path exists
    if not path.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    try:
        # Use 'open' command on macOS
        if path.is_file():
            # Open and select the file in Finder
            subprocess.run(["open", "-R", str(path.absolute())], check=True)
        else:
            # Open the directory in Finder
            subprocess.run(["open", str(path.absolute())], check=True)

        return {"success": True, "message": f"Opened {path}"}
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to open folder: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
