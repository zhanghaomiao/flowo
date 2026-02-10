import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session import get_async_session
from app.core.users import current_active_user
from app.models import User
from app.services.workflow import WorkflowService
from app.utils.paths import PathContent, get_file_content


class FileNode(BaseModel):
    title: str  # 文件名
    key: str  # 核心：相对路径作为 Key
    isLeaf: bool  # True=文件, False=文件夹
    fileSize: int | None = None
    icon: str
    url: str | None = None


router = APIRouter()


@router.get("/list", response_model=list[FileNode])
async def list_files(
    workflow_id: uuid.UUID,
    path: str = Query("./", description="Parent directory path (relative)"),
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = WorkflowService(db)
    wf = await service.get_workflow(workflow_id)
    if not wf or (wf.user_id != user.id and not user.is_superuser):
        raise HTTPException(status_code=404, detail="Workflow not found")

    flowo_dir = await service.get_flowo_directory(workflow_id)
    root_dir = Path(flowo_dir)
    target_path = (root_dir / path).resolve()
    nodes = []
    try:
        with os.scandir(target_path) as entries:
            for entry in entries:
                if entry.name.startswith("."):
                    continue

                is_dir = entry.is_dir()

                if not is_dir:
                    ext = os.path.splitext(entry.name)[1].lower()

                relative_key = f"{path}/{entry.name}" if path else entry.name
                if relative_key.startswith("/"):
                    relative_key = relative_key[1:]

                nodes.append(
                    {
                        "title": entry.name,
                        "key": relative_key,
                        "isLeaf": not is_dir,
                        "fileSize": entry.stat().st_size if not is_dir else None,
                        "icon": "folder" if is_dir else "file",
                        "url": None if is_dir else f"{target_path}/{entry.name}",
                    }
                )

    except PermissionError as e:
        raise HTTPException(status_code=403, detail="Permission denied") from e

    nodes.sort(key=lambda x: (x["isLeaf"], x["title"].lower()))
    return nodes


@router.get("/files/{file_path:path}", response_model=PathContent)
def read_file(
    file_path: str,
    user: User = Depends(current_active_user),
):
    try:
        result = get_file_content(file_path)
        return result

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail="File does not exist") from e

    except IsADirectoryError as e:
        raise HTTPException(status_code=400, detail="Target is a directory") from e

    except ValueError as e:
        raise HTTPException(
            status_code=403, detail="Access to this path is forbidden"
        ) from e

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Internal Server Error: {str(e)}"
        ) from e
