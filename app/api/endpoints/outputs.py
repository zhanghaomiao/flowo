import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session import get_async_session
from app.core.users import current_active_user
from app.models import User
from app.services.workflow import WorkflowService

router = APIRouter()


@router.get("/{workflow_id}/rule_outputs", response_model=list[str])
async def get_job_outputs(
    workflow_id: uuid.UUID,
    rule_name: str,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    # Verify workflow ownership
    service = WorkflowService(db)
    wf = await service.get_workflow(workflow_id)
    if not wf or (wf.user_id != user.id and not user.is_superuser):
        raise HTTPException(status_code=404, detail="Workflow not found")

    return await service.get_rule_outputs(workflow_id=workflow_id, rule_name=rule_name)
