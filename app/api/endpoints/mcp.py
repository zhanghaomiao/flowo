import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_active_user_with_token
from app.core.session import get_async_session
from app.models import Status, User
from app.services.workflow import WorkflowService

router = APIRouter()


@router.get("/running-count", operation_id="list_running_workflows")
async def get_running_workflows(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    Get the details of currently executing (RUNNING) workflows.

    INSTRUCTION FOR AI:
    When presenting the results to the user:
    1. Use a clean Markdown table.
    2. Include columns for Name, Progress, Status, and Jobs (Completed/Total).
    3. Visualize the 'progress' using a text-based progress bar (e.g., [####------]).
    4. If no workflows are running, tell the user clearly.
    """
    # Only show current user's workflows unless superuser
    filter_user_id = current_user.id if not current_user.is_superuser else None

    result = await WorkflowService(db).list_all_workflows(
        status=Status.RUNNING,
        user_id=filter_user_id,
    )
    workflows = [
        {
            "id": str(w.id),
            "name": w.name,
            "progress": w.progress,
            "status": w.status,
            "completed_jobs": w.completed_jobs,
            "total_jobs": w.total_jobs,
        }
        for w in result.workflows
    ]
    return {"running_count": result.total, "workflows": workflows}
