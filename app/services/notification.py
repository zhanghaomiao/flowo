"""Email notification service for FlowO.

Provides HTML email templates and SMTP sending for:
- Workflow lifecycle: submitted, succeeded, failed
- User lifecycle: registration, password reset, email verification
"""

import asyncio
import logging
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.system_settings import SystemSettings

logger = logging.getLogger("flowo.notification")


# ─── Shared HTML helpers ───────────────────────────────────────────────────────

_BASE_STYLE = """
body { margin: 0; padding: 0; background: #f1f5f9; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }
.container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.06); }
.header { padding: 32px 40px 24px; text-align: center; }
.header h1 { margin: 0 0 4px; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
.header .sub { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; opacity: .55; }
.body { padding: 0 40px 32px; }
.info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.info-label { color: #94a3b8; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; }
.info-value { color: #1e293b; font-weight: 600; }
.btn { display: inline-block; padding: 12px 32px; border-radius: 12px; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; margin-top: 24px; }
.footer { padding: 20px 40px; background: #f8fafc; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
.badge { display: inline-block; padding: 6px 16px; border-radius: 8px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
"""


def _wrap_html(content: str, accent_color: str = "#0ea5e9") -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>{_BASE_STYLE}</style></head>
<body><div class="container">{content}</div></body></html>"""


def _get_absolute_url(site_url: str, path: str) -> str:
    """Safely constructs an absolute URL. Defaults to path if site_url is missing."""
    if not site_url:
        return path
    return f"{site_url.rstrip('/')}/{path.lstrip('/')}"


# ─── Workflow Email Templates ──────────────────────────────────────────────────


def workflow_submitted_html(
    workflow_name: str, user_email: str, submitted_at: str, site_url: str = ""
) -> str:
    link = _get_absolute_url(site_url, "/workflow")
    content = f"""
    <div class="header" style="border-bottom: 3px solid #0ea5e9;">
        <div class="sub" style="color: #0ea5e9;">workflow notification</div>
        <h1 style="color: #0f172a;">Workflow Submitted</h1>
    </div>
    <div class="body">
        <p style="color: #475569; font-size: 14px; line-height: 1.7;">
            A new workflow has been submitted and is now queued for execution.
        </p>
        <div style="background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
            <div class="info-row"><span class="info-label">Workflow</span><span class="info-value">{workflow_name or "Unnamed"}</span></div>
            <div class="info-row"><span class="info-label">Submitted by</span><span class="info-value">{user_email}</span></div>
            <div class="info-row" style="border:none;"><span class="info-label">Time</span><span class="info-value">{submitted_at}</span></div>
        </div>
        <div style="text-align: center;">
            <span class="badge" style="background: #e0f2fe; color: #0284c7;">⏳ Running</span>
        </div>
        <div style="text-align: center;">
            <a href="{link}" class="btn" style="background: #0ea5e9;">View in Dashboard</a>
        </div>
    </div>
    <div class="footer">FlowO Workflow Management System</div>"""
    return _wrap_html(content)


def workflow_success_html(
    workflow_name: str, user_email: str, duration: str, site_url: str = ""
) -> str:
    link = _get_absolute_url(site_url, "/workflow")
    content = f"""
    <div class="header" style="border-bottom: 3px solid #10b981;">
        <div class="sub" style="color: #10b981;">workflow notification</div>
        <h1 style="color: #0f172a;">Workflow Completed ✓</h1>
    </div>
    <div class="body">
        <p style="color: #475569; font-size: 14px; line-height: 1.7;">
            Your workflow has finished successfully. All jobs completed without errors.
        </p>
        <div style="background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
            <div class="info-row"><span class="info-label">Workflow</span><span class="info-value">{workflow_name or "Unnamed"}</span></div>
            <div class="info-row"><span class="info-label">User</span><span class="info-value">{user_email}</span></div>
            <div class="info-row" style="border:none;"><span class="info-label">Duration</span><span class="info-value">{duration}</span></div>
        </div>
        <div style="text-align: center;">
            <span class="badge" style="background: #d1fae5; color: #059669;">✓ Success</span>
        </div>
        <div style="text-align: center;">
            <a href="{link}" class="btn" style="background: #10b981;">View Results</a>
        </div>
    </div>
    <div class="footer">FlowO Workflow Management System</div>"""
    return _wrap_html(content, "#10b981")


def workflow_failure_html(
    workflow_name: str, user_email: str, error_msg: str, site_url: str = ""
) -> str:
    link = _get_absolute_url(site_url, "/workflow")
    content = f"""
    <div class="header" style="border-bottom: 3px solid #f43f5e;">
        <div class="sub" style="color: #f43f5e;">workflow notification</div>
        <h1 style="color: #0f172a;">Workflow Failed ✕</h1>
    </div>
    <div class="body">
        <p style="color: #475569; font-size: 14px; line-height: 1.7;">
            Your workflow encountered an error and could not complete. Please review the error details below.
        </p>
        <div style="background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
            <div class="info-row"><span class="info-label">Workflow</span><span class="info-value">{workflow_name or "Unnamed"}</span></div>
            <div class="info-row"><span class="info-label">User</span><span class="info-value">{user_email}</span></div>
            <div class="info-row" style="border:none;"><span class="info-label">Error</span><span class="info-value" style="color: #e11d48;">{error_msg[:200] if error_msg else "Unknown error"}</span></div>
        </div>
        <div style="text-align: center;">
            <span class="badge" style="background: #ffe4e6; color: #e11d48;">✕ Failed</span>
        </div>
        <div style="text-align: center;">
            <a href="{link}" class="btn" style="background: #f43f5e;">View Error Details</a>
        </div>
    </div>
    <div class="footer">FlowO Workflow Management System</div>"""
    return _wrap_html(content, "#f43f5e")


# ─── User Lifecycle Email Templates ───────────────────────────────────────────


def welcome_html(user_email: str, site_url: str = "") -> str:
    link = _get_absolute_url(site_url, "/login")
    content = f"""
    <div class="header" style="border-bottom: 3px solid #0ea5e9;">
        <div class="sub" style="color: #0ea5e9;">welcome to flowo</div>
        <h1 style="color: #0f172a;">Registration Successful 🎉</h1>
    </div>
    <div class="body">
        <p style="color: #475569; font-size: 14px; line-height: 1.7;">
            Your account has been created successfully. You can now log in and start managing your bioinformatics workflows.
        </p>
        <div style="background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
            <div class="info-row"><span class="info-label">Account</span><span class="info-value">{user_email}</span></div>
            <div class="info-row" style="border:none;"><span class="info-label">Registered</span><span class="info-value">{datetime.now().strftime("%Y-%m-%d %H:%M")}</span></div>
        </div>
        <div style="text-align: center;">
            <a href="{link}" class="btn" style="background: #0ea5e9;">Go to Dashboard</a>
        </div>
    </div>
    <div class="footer">FlowO Workflow Management System</div>"""
    return _wrap_html(content)


def reset_password_html(user_email: str, token: str, site_url: str = "") -> str:
    link = _get_absolute_url(site_url, f"/reset-password?token={token}")
    content = f"""
    <div class="header" style="border-bottom: 3px solid #f59e0b;">
        <div class="sub" style="color: #f59e0b;">security alert</div>
        <h1 style="color: #0f172a;">Password Reset Request</h1>
    </div>
    <div class="body">
        <p style="color: #475569; font-size: 14px; line-height: 1.7;">
            We received a request to reset the password for your account. Click the button below to set a new password.
        </p>
        <div style="background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
            <div class="info-row"><span class="info-label">Account</span><span class="info-value">{user_email}</span></div>
            <div class="info-row" style="border:none;"><span class="info-label">Requested</span><span class="info-value">{datetime.now().strftime("%Y-%m-%d %H:%M")}</span></div>
        </div>
        <div style="text-align: center;">
            <a href="{link}" class="btn" style="background: #f59e0b;">Reset Password</a>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; text-align: center;">
            If you did not make this request, please ignore this email. The link will expire in 1 hour.
        </p>
    </div>
    <div class="footer">FlowO Workflow Management System</div>"""
    return _wrap_html(content, "#f59e0b")


def verify_email_html(user_email: str, token: str, site_url: str = "") -> str:
    link = _get_absolute_url(site_url, f"/verify?token={token}")
    content = f"""
    <div class="header" style="border-bottom: 3px solid #6366f1;">
        <div class="sub" style="color: #6366f1;">account verification</div>
        <h1 style="color: #0f172a;">Verify Your Email</h1>
    </div>
    <div class="body">
        <p style="color: #475569; font-size: 14px; line-height: 1.7;">
            To complete your account setup, please verify your email address by clicking the button below.
        </p>
        <div style="background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
            <div class="info-row" style="border:none;"><span class="info-label">Account</span><span class="info-value">{user_email}</span></div>
        </div>
        <div style="text-align: center;">
            <a href="{link}" class="btn" style="background: #6366f1;">Verify Email</a>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; text-align: center;">
            If you did not create an account, please ignore this email.
        </p>
    </div>
    <div class="footer">FlowO Workflow Management System</div>"""
    return _wrap_html(content, "#6366f1")


# ─── SMTP Send Logic ──────────────────────────────────────────────────────────


def _send_smtp(
    settings: SystemSettings, to_email: str, subject: str, html: str
) -> bool:
    """Synchronous SMTP send. Should be called via asyncio.to_thread."""
    if not all([settings.smtp_host, settings.smtp_port, settings.smtp_from]):
        logger.warning("SMTP not configured — skipping email to %s", to_email)
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = to_email
        msg.attach(MIMEText(html, "html"))

        if settings.smtp_use_tls:
            server = smtplib.SMTP_SSL(
                settings.smtp_host, settings.smtp_port, timeout=15
            )
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
            server.starttls()

        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)

        server.send_message(msg)
        server.quit()
        logger.info("Email sent to %s: %s", to_email, subject)
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to_email)
        return False


async def send_email(
    settings: SystemSettings, to_email: str, subject: str, html: str
) -> bool:
    """Async wrapper around SMTP send."""
    return await asyncio.to_thread(_send_smtp, settings, to_email, subject, html)


# ─── High-level notification functions ─────────────────────────────────────────


def _get_settings(db: Session) -> SystemSettings | None:
    result = db.execute(select(SystemSettings))
    return result.scalar_one_or_none()


def notify_workflow_submitted(db: Session, workflow_name: str, user_email: str) -> None:
    """Fire-and-forget notification for workflow submission."""
    settings = _get_settings(db)
    if not settings or not settings.notify_on_submit:
        return
    html = workflow_submitted_html(
        workflow_name,
        user_email,
        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        settings.site_url or "",
    )
    asyncio.get_event_loop().create_task(
        send_email(
            settings,
            user_email,
            f"[FlowO] Workflow Submitted: {workflow_name or 'Unnamed'}",
            html,
        )
    )


def notify_workflow_success(
    db: Session, workflow_name: str, user_email: str, duration: str
) -> None:
    """Fire-and-forget notification for workflow success."""
    settings = _get_settings(db)
    if not settings or not settings.notify_on_success:
        return
    html = workflow_success_html(
        workflow_name, user_email, duration, settings.site_url or ""
    )
    asyncio.get_event_loop().create_task(
        send_email(
            settings,
            user_email,
            f"[FlowO] Workflow Completed: {workflow_name or 'Unnamed'}",
            html,
        )
    )


def notify_workflow_failure(
    db: Session, workflow_name: str, user_email: str, error_msg: str
) -> None:
    """Fire-and-forget notification for workflow failure."""
    settings = _get_settings(db)
    if not settings or not settings.notify_on_failure:
        return
    html = workflow_failure_html(
        workflow_name, user_email, error_msg, settings.site_url or ""
    )
    asyncio.get_event_loop().create_task(
        send_email(
            settings,
            user_email,
            f"[FlowO] Workflow Failed: {workflow_name or 'Unnamed'}",
            html,
        )
    )


async def notify_user_registered(db_session, user_email: str) -> None:
    """Send welcome email after user registration."""
    result = await db_session.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()
    if not settings or not settings.smtp_host:
        return
    html = welcome_html(user_email, settings.site_url or "")
    await send_email(
        settings, user_email, "[FlowO] Welcome — Registration Successful", html
    )


async def notify_password_reset(db_session, user_email: str, token: str) -> None:
    """Send password reset email."""
    result = await db_session.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()
    if not settings or not settings.smtp_host:
        return
    html = reset_password_html(user_email, token, settings.site_url or "")
    await send_email(settings, user_email, "[FlowO] Password Reset Request", html)


async def notify_verify_email(db_session, user_email: str, token: str) -> None:
    """Send verification email."""
    result = await db_session.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()
    if not settings or not settings.smtp_host:
        return
    html = verify_email_html(user_email, token, settings.site_url or "")
    await send_email(settings, user_email, "[FlowO] Verify Your Email Address", html)
