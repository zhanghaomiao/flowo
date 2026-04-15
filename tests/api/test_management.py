import smtplib
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.invitation import Invitation
from app.models.system_settings import SystemSettings
from app.models.user import User
from app.models.user_settings import UserSettings
from app.models.user_token import UserToken


async def create_user_and_headers(register_user, login_user, email: str, *, is_superuser: bool = False):
    await register_user(email, is_superuser=is_superuser)
    return await login_user(email)


@pytest.mark.asyncio
async def test_api_token_can_call_reports_endpoint(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    headers = await create_user_and_headers(
        register_user, login_user, "token-reports@example.com"
    )
    token_response = await client.post(
        "/api/v1/tokens/",
        json={"name": "cli-token", "ttl_days": 7},
        headers=headers,
    )
    api_token = token_response.json()["token"]

    response = await client.post(
        "/api/v1/reports/",
        json={
            "event": "workflow_started",
            "record": {
                "workflow_id": "880e8400-e29b-41d4-a716-446655440000",
                "snakefile": "Snakefile",
                "rules": [],
            },
            "context": {"flowo_project_name": "API token workflow"},
        },
        headers={"Authorization": f"Bearer {api_token}"},
    )

    assert response.status_code == 200
    assert response.json()["context"]["flowo_user"] == "token-reports@example.com"


@pytest.mark.asyncio
async def test_non_flw_bearer_token_is_rejected_for_catalog(client: AsyncClient):
    response = await client.get(
        "/api/v1/catalog",
        headers={"Authorization": "Bearer not-an-api-token"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"


@pytest.mark.asyncio
async def test_token_api_lifecycle_and_user_isolation(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    user1_headers = await create_user_and_headers(
        register_user, login_user, "tokens-a@example.com"
    )
    user2_headers = await create_user_and_headers(
        register_user, login_user, "tokens-b@example.com"
    )

    user1_create = await client.post(
        "/api/v1/tokens/",
        json={"name": "user1-token", "ttl_days": 3},
        headers=user1_headers,
    )
    user2_create = await client.post(
        "/api/v1/tokens/",
        json={"name": "user2-token"},
        headers=user2_headers,
    )

    assert user1_create.status_code == 200
    assert user2_create.status_code == 200
    assert user1_create.json()["token"].startswith("flw_")
    assert user1_create.json()["expires_at"] is not None

    list_response = await client.get("/api/v1/tokens/", headers=user1_headers)
    assert list_response.status_code == 200
    assert [token["name"] for token in list_response.json()["tokens"]] == ["user1-token"]

    other_token_id = user2_create.json()["id"]
    delete_other_response = await client.delete(
        f"/api/v1/tokens/{other_token_id}",
        headers=user1_headers,
    )
    assert delete_other_response.status_code == 200

    user2_tokens = await client.get("/api/v1/tokens/", headers=user2_headers)
    assert [token["name"] for token in user2_tokens.json()["tokens"]] == ["user2-token"]

    delete_own_response = await client.delete(
        f"/api/v1/tokens/{user1_create.json()['id']}",
        headers=user1_headers,
    )
    assert delete_own_response.status_code == 200

    remaining = (
        await db.execute(select(UserToken).where(UserToken.name == "user1-token"))
    ).scalar_one_or_none()
    assert remaining is None


@pytest.mark.asyncio
async def test_settings_get_creates_default_row_and_update_persists(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    headers = await create_user_and_headers(
        register_user, login_user, "settings-user@example.com"
    )

    get_response = await client.get("/api/v1/settings", headers=headers)

    assert get_response.status_code == 200
    assert get_response.json() == {
        "git_remote_url": None,
        "git_token": None,
        "extra": None,
    }

    update_response = await client.put(
        "/api/v1/settings",
        json={
            "git_remote_url": "https://github.com/example/repo.git",
            "git_token": "secret",
            "extra": {"team": "platform"},
        },
        headers=headers,
    )

    assert update_response.status_code == 200
    assert update_response.json()["extra"] == {"team": "platform"}

    persisted = (await db.execute(select(UserSettings))).scalar_one()
    assert persisted.git_remote_url == "https://github.com/example/repo.git"
    assert persisted.git_token == "secret"


@pytest.mark.asyncio
async def test_settings_test_git_connection(client: AsyncClient, register_user, login_user):
    headers = await create_user_and_headers(
        register_user, login_user, "git-user@example.com"
    )

    with patch(
        "app.api.endpoints.settings.git_service.test_connection",
        return_value=(True, "ok"),
    ) as mocked:
        response = await client.post(
            "/api/v1/settings/test/git",
            json={"remote_url": "https://github.com/example/repo.git", "token": "abc"},
            headers=headers,
        )

    assert response.status_code == 200
    assert response.json() == {"success": True, "message": "ok"}
    mocked.assert_called_once_with("https://github.com/example/repo.git", "abc")


@pytest.mark.asyncio
async def test_non_admin_cannot_access_admin_endpoints(
    client: AsyncClient,
    register_user,
    login_user,
):
    headers = await create_user_and_headers(
        register_user, login_user, "plain-user@example.com"
    )

    response = await client.get("/api/v1/admin/users", headers=headers)

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_settings_initialize_and_update(
    client: AsyncClient,
    db,
    superuser_token_headers: dict,
):
    get_response = await client.get(
        "/api/v1/admin/settings",
        headers=superuser_token_headers,
    )

    assert get_response.status_code == 200
    assert get_response.json()["allow_public_registration"] is True

    patch_response = await client.patch(
        "/api/v1/admin/settings",
        json={
            "allow_public_registration": False,
            "smtp_host": "smtp.example.com",
            "smtp_port": 465,
            "smtp_use_tls": True,
            "site_url": "https://flowo.example.com",
        },
        headers=superuser_token_headers,
    )

    assert patch_response.status_code == 200
    assert patch_response.json()["allow_public_registration"] is False

    persisted = (await db.execute(select(SystemSettings))).scalar_one()
    assert persisted.smtp_host == "smtp.example.com"
    assert persisted.site_url == "https://flowo.example.com"


@pytest.mark.asyncio
async def test_admin_invitation_lifecycle_without_smtp(
    client: AsyncClient,
    db,
    superuser_token_headers: dict,
):
    create_response = await client.post(
        "/api/v1/admin/invitations",
        json={
            "email": "invitee@example.com",
            "expires_at": (datetime.now(UTC) + timedelta(days=7)).isoformat(),
        },
        headers=superuser_token_headers,
    )

    assert create_response.status_code == 200
    assert create_response.json()["email_sent"] is False

    list_response = await client.get(
        "/api/v1/admin/invitations",
        headers=superuser_token_headers,
    )
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    invitation_id = create_response.json()["id"]
    delete_response = await client.delete(
        f"/api/v1/admin/invitations/{invitation_id}",
        headers=superuser_token_headers,
    )

    assert delete_response.status_code == 200
    remaining = (await db.execute(select(Invitation))).scalar_one_or_none()
    assert remaining is None


@pytest.mark.asyncio
async def test_admin_invitation_reports_email_sent_when_smtp_send_succeeds(
    client: AsyncClient,
    db,
    superuser_token_headers: dict,
):
    db.add(
        SystemSettings(
            smtp_host="smtp.example.com",
            smtp_port=465,
            smtp_from="noreply@example.com",
            smtp_use_tls=True,
            site_url="https://flowo.example.com",
        )
    )
    await db.commit()

    with patch(
        "app.api.endpoints.admin.send_invitation_email",
        new=AsyncMock(return_value=True),
    ):
        response = await client.post(
            "/api/v1/admin/invitations",
            json={
                "email": "mail-user@example.com",
                "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            },
            headers=superuser_token_headers,
        )

    assert response.status_code == 200
    assert response.json()["email_sent"] is True


@pytest.mark.asyncio
async def test_admin_delete_user_behaviors(
    client: AsyncClient,
    db,
    superuser_token_headers: dict,
    register_user,
):
    superuser = (await db.execute(select(User).where(User.is_superuser.is_(True)))).scalar_one()

    self_delete_response = await client.delete(
        f"/api/v1/admin/users/{superuser.id}",
        headers=superuser_token_headers,
    )
    assert self_delete_response.status_code == 400

    missing_response = await client.delete(
        "/api/v1/admin/users/00000000-0000-0000-0000-000000000000",
        headers=superuser_token_headers,
    )
    assert missing_response.status_code == 404

    await register_user("delete-me@example.com")
    target_user = (
        await db.execute(select(User).where(User.email == "delete-me@example.com"))
    ).scalar_one()
    delete_response = await client.delete(
        f"/api/v1/admin/users/{target_user.id}",
        headers=superuser_token_headers,
    )

    assert delete_response.status_code == 200
    deleted_user = (
        await db.execute(select(User).where(User.id == target_user.id))
    ).scalar_one_or_none()
    assert deleted_user is None


@pytest.mark.asyncio
async def test_admin_test_smtp_success_for_tls(client: AsyncClient, superuser_token_headers: dict):
    smtp_client = MagicMock()
    with patch("app.api.endpoints.admin.smtplib.SMTP_SSL", return_value=smtp_client) as mocked_ssl:
        response = await client.post(
            "/api/v1/admin/settings/test-smtp",
            json={
                "smtp_host": "smtp.example.com",
                "smtp_port": 465,
                "smtp_user": "user",
                "smtp_password": "pass",
                "smtp_use_tls": True,
            },
            headers=superuser_token_headers,
        )

    assert response.status_code == 200
    assert response.json()["success"] is True
    mocked_ssl.assert_called_once_with("smtp.example.com", 465, timeout=10)
    smtp_client.login.assert_called_once_with("user", "pass")
    smtp_client.quit.assert_called_once()


@pytest.mark.asyncio
async def test_admin_test_smtp_success_for_starttls(client: AsyncClient, superuser_token_headers: dict):
    smtp_client = MagicMock()
    with patch("app.api.endpoints.admin.smtplib.SMTP", return_value=smtp_client) as mocked_smtp:
        response = await client.post(
            "/api/v1/admin/settings/test-smtp",
            json={
                "smtp_host": "smtp.example.com",
                "smtp_port": 587,
                "smtp_use_tls": False,
            },
            headers=superuser_token_headers,
        )

    assert response.status_code == 200
    assert response.json()["success"] is True
    mocked_smtp.assert_called_once_with("smtp.example.com", 587, timeout=10)
    smtp_client.starttls.assert_called_once()
    smtp_client.quit.assert_called_once()


@pytest.mark.asyncio
async def test_admin_test_smtp_error_responses(client: AsyncClient, superuser_token_headers: dict):
    with patch(
        "app.api.endpoints.admin.smtplib.SMTP_SSL",
        side_effect=smtplib.SMTPAuthenticationError(535, b"bad auth"),
    ):
        auth_response = await client.post(
            "/api/v1/admin/settings/test-smtp",
            json={
                "smtp_host": "smtp.example.com",
                "smtp_port": 465,
                "smtp_use_tls": True,
            },
            headers=superuser_token_headers,
        )

    with patch(
        "app.api.endpoints.admin.smtplib.SMTP",
        side_effect=smtplib.SMTPConnectError(421, "down"),
    ):
        connect_response = await client.post(
            "/api/v1/admin/settings/test-smtp",
            json={
                "smtp_host": "smtp.example.com",
                "smtp_port": 587,
                "smtp_use_tls": False,
            },
            headers=superuser_token_headers,
        )

    assert auth_response.status_code == 200
    assert auth_response.json()["success"] is False
    assert "Authentication failed" in auth_response.json()["message"]
    assert connect_response.status_code == 200
    assert connect_response.json()["success"] is False
    assert "Cannot connect" in connect_response.json()["message"]
