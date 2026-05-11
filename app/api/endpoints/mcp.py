import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session import get_async_session
from app.core.users import current_active_user
from app.models import Status, User
from app.services.workflow import WorkflowService

router = APIRouter()


@router.get("/running-count", operation_id="running_workflows_count")
async def get_running_workflows_count(
    db: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """
    Get the number of currently executing (RUNNING) workflows.
    """
    # Removed user filter for now to allow unauthenticated MCP access
    result = await WorkflowService(db).list_all_workflows(
        status=Status.RUNNING,
        limit=1,
    )
    return {"running_count": result.total}


@router.get(
    "/progress", response_model=dict[str, Any], operation_id="workflow_progress"
)
async def get_workflow_progress(
    workflow_id: uuid.UUID | None = Query(None, description="Workflow UUID"),
    name: str | None = Query(None, description="Workflow name"),
    db: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """
    Get the execution progress of a specific workflow by its ID or name.
    """
    service = WorkflowService(db)

    target_id = workflow_id
    if not target_id and name:
        target_id = await service.get_workflow_id_by_name(name)
        if not target_id:
            raise HTTPException(
                status_code=404, detail=f"Workflow with name '{name}' not found"
            )

    if not target_id:
        raise HTTPException(
            status_code=400, detail="Either workflow_id or name must be provided"
        )

    wf = await service.get_workflow(target_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    progress_data = await service.get_progress(target_id)
    total = int(progress_data.get("total") or 0)
    completed = int(progress_data.get("completed") or 0)
    progress = round(completed / total * 100, 2) if total > 0 else 0.0

    return {
        "workflow_id": str(target_id),
        "name": wf.name,
        "status": wf.status.value,
        "progress": f"{progress}%",
        "completed_jobs": completed,
        "total_jobs": total,
    }
