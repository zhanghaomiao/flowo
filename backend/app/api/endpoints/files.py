import uuid
from fastapi import APIRouter, HTTPException, Query, Depends
from pathlib import Path
import os
from typing import List, Optional
from pydantic import BaseModel
from app.services.workflow import WorkflowService
from app.core.session import get_db
from sqlalchemy.orm import Session


class FileNode(BaseModel):
    title: str          #文件名
    key: str            # 核心：相对路径作为 Key
    isLeaf: bool        # True=文件, False=文件夹
    fileSize: Optional[int] = None
    icon: str           # 辅助字段，告诉前端用什么图标


router = APIRouter()


@router.get("/list", response_model=List[FileNode])
def list_files(
    workflow_id: uuid.UUID, 
    path: str = Query("./", description="Parent directory path (relative)"),
    db: Session = Depends(get_db)
):
    root_dir = Path(WorkflowService(db).get_flowo_directory(workflow_id))
    target_path = (root_dir / path).resolve()
    
    if not str(target_path).startswith(str(root_dir)):
        raise HTTPException(status_code=403, detail="Access denied")
    if not target_path.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    nodes = []
    
    try:
        with os.scandir(target_path) as entries:
            for entry in entries:
                if entry.name.startswith('.'): continue
                
                is_dir = entry.is_dir()
                
                if not is_dir:
                    ext = os.path.splitext(entry.name)[1].lower()
                
                relative_key = f"{path}/{entry.name}" if path else entry.name
                if relative_key.startswith("/"): relative_key = relative_key[1:]

                nodes.append({
                    "title": entry.name,
                    "key": relative_key,   
                    "isLeaf": not is_dir,  
                    "fileSize": entry.stat().st_size if not is_dir else None,
                    "icon": "folder" if is_dir else "file"
                })
                
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    nodes.sort(key=lambda x: (x['isLeaf'], x['title'].lower()))
    return nodes