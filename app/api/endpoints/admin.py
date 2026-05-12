import secrets
import smtplib
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session import get_async_session
from app.core.users import current_superuser
from app.models.invitation import Invitation
from app.models.system_settings import SystemSettings
from app.models.user import User
from app.schemas.invitation import (
    InvitationCreate,
    InvitationCreateResponse,
    InvitationRead,
)
from app.schemas.system_settings import (
    ConnectionTestResult,
    SystemSettingsRead,
    SystemSettingsUpdate,
    TestSmtpRequest,
)
from app.schemas.user import UserRead

router = APIRouter()


async def send_invitation_email(
    settings: SystemSettings, target_email: str, token: str
) -> bool:
    """Sends an invitation email using system SMTP settings."""
    if not all(
        [
            settings.smtp_host,
            settings.smtp_port,
            settings.smtp_from,
            settings.site_url,
        ]
    ):
        return False

    try:
        # Construct absolute registration link
        base_url = settings.site_url.rstrip("/")
        reg_link = f"{base_url}/register?token={token}"

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "You are invited to join FlowO"
        msg["From"] = settings.smtp_from
        msg["To"] = target_email

        html = f"""
        <html>
            <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #00A2FF;">Welcome to FlowO</h2>
                    <p>You have been invited to join the FlowO platform. Click the button below to complete your registration:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{reg_link}" style="background-color: #00A2FF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Join Now</a>
                    </div>
                    <p style="font-size: 12px; color: #777;">If you did not expect this invitation, you can safely ignore this email.</p>
                </div>
            </body>
        </html>
        """
        msg.attach(MIMEText(html, "html"))

        def sync_send():
            if settings.smtp_use_tls:
                server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port)
            else:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
                server.starttls()

            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)

            server.send_message(msg)
            server.quit()

        import asyncio

        await asyncio.to_thread(sync_send)
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False


@router.get("/users", response_model=list[UserRead])
async def list_users(
    db: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_superuser),
):
    """List all registered users."""
    result = await db.execute(select(User).order_by(User.email))
    return result.scalars().all()


@router.get("/settings", response_model=SystemSettingsRead)
async def get_system_settings(
    db: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_superuser),
):
    result = await db.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()
    if not settings:
        # Create default settings if not exist
        settings = SystemSettings()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


@router.patch("/settings", response_model=SystemSettingsRead)
async def update_system_settings(
    payload: SystemSettingsUpdate,
    db: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_superuser),
):
    result = await db.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = SystemSettings()
        db.add(settings)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)

    await db.commit()
    await db.refresh(settings)
    return settings


@router.post("/invitations", response_model=InvitationCreateResponse)
async def create_invitation(
    payload: InvitationCreate,
    db: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_superuser),
):
    token = secrets.token_urlsafe(16)
    invitation = Invitation(
        token=token,
        email=payload.email,
        expires_at=payload.expires_at,
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    # Check if SMTP is configured and send email if possible
    email_sent = False
    if payload.email:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()
        if settings:
            email_sent = await send_invitation_email(settings, payload.email, token)

    return {
        "id": invitation.id,
        "token": invitation.token,
        "email": invitation.email,
        "expires_at": invitation.expires_at,
        "is_used": invitation.is_used,
        "created_at": invitation.created_at,
        "email_sent": email_sent,
    }


@router.get("/invitations", response_model=list[InvitationRead])
async def list_invitations(
    db: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_superuser),
):
    result = await db.execute(select(Invitation).order_by(Invitation.created_at.desc()))
    return result.scalars().all()


@router.delete("/invitations/{invitation_id}")
async def delete_invitation(
    invitation_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_superuser),
):
    """Revoke an invitation."""
    result = await db.execute(select(Invitation).where(Invitation.id == invitation_id))
    invitation = result.scalar_one_or_none()
    if not invitation:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Invitation not found")

    await db.delete(invitation)
    await db.commit()
    return {"message": "Invitation revoked"}


@router.post("/settings/test-smtp", response_model=ConnectionTestResult)
async def test_admin_smtp_connection(
    body: TestSmtpRequest,
    admin: User = Depends(current_superuser),
) -> ConnectionTestResult:
    """Test SMTP connectivity for system settings."""
    try:
        if body.smtp_use_tls:
            server = smtplib.SMTP_SSL(body.smtp_host, body.smtp_port, timeout=10)
        else:
            server = smtplib.SMTP(body.smtp_host, body.smtp_port, timeout=10)
            server.starttls()

        if body.smtp_user and body.smtp_password:
            server.login(body.smtp_user, body.smtp_password)

        server.quit()
        return ConnectionTestResult(success=True, message="SMTP connection successful.")
    except smtplib.SMTPAuthenticationError:
        return ConnectionTestResult(
            success=False, message="Authentication failed — check username/password."
        )
    except smtplib.SMTPConnectError as e:
        return ConnectionTestResult(success=False, message=f"Cannot connect: {e}")
    except Exception as e:
        return ConnectionTestResult(success=False, message=str(e))


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_superuser),
):
    """Delete a user. Prevents self-deletion."""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot delete themselves.",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    await db.delete(user)
    await db.commit()
    return {"message": f"User {user.email} successfully deleted."}
