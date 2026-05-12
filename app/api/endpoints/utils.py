from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.session import get_async_session
from app.core.users import current_active_user
from app.models import User
from app.models.system_settings import SystemSettings
from app.schemas.system_settings import SystemInfoRead
from app.services.workflow import WorkflowService

router = APIRouter()


@router.get("/info", response_model=SystemInfoRead)
async def get_system_info(
    db: AsyncSession = Depends(get_async_session),
) -> SystemInfoRead:
    """Publicly accessible system information."""
    stmt = select(SystemSettings).limit(1)
    result = await db.execute(stmt)
    system_settings = result.scalar_one_or_none()

    allow_reg = True
    email_verify = False
    email_enabled = False
    if system_settings is not None:
        allow_reg = system_settings.allow_public_registration
        email_enabled = bool(
            system_settings.smtp_host
            and system_settings.smtp_port
            and system_settings.smtp_from
        )
        # Only require verification if SMTP is actually configured
        email_verify = bool(
            system_settings.require_email_verification and email_enabled
        )

    return SystemInfoRead(
        allow_public_registration=allow_reg,
        require_email_verification=email_verify,
        email_enabled=email_enabled,
    )


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
    return {
        "FLOWO_WORKING_PATH": settings.FLOWO_WORKING_PATH,
        "FLOWO_HOST": settings.FLOWO_HOST,
        "API_V1_STR": settings.API_V1_STR,
    }
