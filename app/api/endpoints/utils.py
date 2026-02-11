from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session import get_async_session
from app.core.users import current_active_user
from app.models import User
from app.services.workflow import WorkflowService

router = APIRouter()


@router.get("/tags", response_model=list[str])
async def get_all_tags(
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    return await WorkflowService(db).get_all_tags()


@router.get("/client-config", response_model=dict[str, str | int])
async def get_client_config(
    user: User = Depends(current_active_user),
):
    from app.core.config import settings

    return {
        "FLOWO_WORKING_PATH": settings.FLOWO_WORKING_PATH,
        "FLOWO_HOST": settings.FLOWO_HOST,
        "API_V1_STR": settings.API_V1_STR,
    }
