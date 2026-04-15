import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.user import User
from app.schemas.util import ServiceStatus, StatusSummary, SystemHealthResponse


async def create_user_and_headers(register_user, login_user, email: str, *, is_superuser: bool = False):
    await register_user(email, is_superuser=is_superuser)
    return await login_user(email)


@pytest.mark.asyncio
async def test_summary_resources_uses_cpu_fallback(
    client: AsyncClient,
    superuser_token_headers: dict,
    monkeypatch,
):
    monkeypatch.setattr("app.api.endpoints.summary.psutil.cpu_count", lambda logical=True: 0)
    monkeypatch.setattr(
        "app.api.endpoints.summary.psutil.cpu_times_percent",
        lambda interval=0.1: type("CpuTimes", (), {"idle": 25.0})(),
    )
    monkeypatch.setattr(
        "app.api.endpoints.summary.psutil.virtual_memory",
        lambda: type(
            "Memory",
            (),
            {
                "total": 8 * 1024 * 1024 * 1024,
                "available": 3 * 1024 * 1024 * 1024,
            },
        )(),
    )

    response = await client.get(
        "/api/v1/summary/resources",
        headers=superuser_token_headers,
    )

    assert response.status_code == 200
    assert response.json() == {
        "cpu_idle_cores": 0.25,
        "cpu_total_cores": 1,
        "mem_total_GB": 8.0,
        "mem_available_GB": 3.0,
    }


@pytest.mark.asyncio
async def test_summary_status_uses_current_user_filter_for_non_admin(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    headers = await create_user_and_headers(
        register_user, login_user, "summary-user@example.com"
    )
    user = (
        await db.execute(
            select(User).where(User.email == "summary-user@example.com")
        )
    ).scalar_one()

    with patch(
        "app.api.endpoints.summary.SummaryService.get_status",
        new=AsyncMock(return_value=StatusSummary(total=4, success=2, running=1, error=1)),
    ) as mocked:
        response = await client.get(
            f"/api/v1/summary/status?item=workflow&target_user_id={uuid.uuid4()}",
            headers=headers,
        )

    assert response.status_code == 200
    assert response.json()["total"] == 4
    mocked.assert_awaited_once_with("workflow", user_id=user.id)


@pytest.mark.asyncio
async def test_summary_status_honors_target_user_for_admin(
    client: AsyncClient,
    superuser_token_headers: dict,
):
    target_user_id = uuid.uuid4()
    with patch(
        "app.api.endpoints.summary.SummaryService.get_status",
        new=AsyncMock(return_value=StatusSummary(total=2, success=1, running=1, error=0)),
    ) as mocked:
        response = await client.get(
            f"/api/v1/summary/status?item=job&target_user_id={target_user_id}",
            headers=superuser_token_headers,
        )

    assert response.status_code == 200
    mocked.assert_awaited_once_with("job", user_id=target_user_id)


@pytest.mark.asyncio
async def test_summary_activity_uses_current_user_filter_for_non_admin(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    headers = await create_user_and_headers(
        register_user, login_user, "activity-user@example.com"
    )
    user = (
        await db.execute(
            select(User).where(User.email == "activity-user@example.com")
        )
    ).scalar_one()

    with patch(
        "app.api.endpoints.summary.SummaryService.get_activity",
        new=AsyncMock(return_value={"align": 5}),
    ) as mocked:
        response = await client.get(
            f"/api/v1/summary/activity?item=rule&target_user_id={uuid.uuid4()}&limit=5",
            headers=headers,
        )

    assert response.status_code == 200
    assert response.json() == {"align": 5}
    mocked.assert_awaited_once()
    assert mocked.await_args.kwargs["user_id"] == user.id
    assert mocked.await_args.kwargs["item"] == "rule"
    assert mocked.await_args.kwargs["limit"] == 5


@pytest.mark.asyncio
async def test_summary_rule_endpoints_honor_admin_target_user(
    client: AsyncClient,
    superuser_token_headers: dict,
):
    target_user_id = uuid.uuid4()
    with patch(
        "app.api.endpoints.summary.SummaryService.get_rule_error",
        new=AsyncMock(return_value={"align": {"total": 10, "error": 2}}),
    ) as mocked_error:
        response_error = await client.get(
            f"/api/v1/summary/rule_error?target_user_id={target_user_id}",
            headers=superuser_token_headers,
        )

    with patch(
        "app.api.endpoints.summary.SummaryService.get_rule_duration",
        new=AsyncMock(return_value={"align": {"median": 1.2}}),
    ) as mocked_duration:
        response_duration = await client.get(
            f"/api/v1/summary/rule_duration?target_user_id={target_user_id}",
            headers=superuser_token_headers,
        )

    assert response_error.status_code == 200
    assert response_duration.status_code == 200
    assert mocked_error.await_args.kwargs["user_id"] == target_user_id
    assert mocked_duration.await_args.kwargs["user_id"] == target_user_id


@pytest.mark.asyncio
async def test_summary_pruning_uses_current_user_for_non_admin(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    headers = await create_user_and_headers(
        register_user, login_user, "pruning-user@example.com"
    )
    user = (
        await db.execute(
            select(User).where(User.email == "pruning-user@example.com")
        )
    ).scalar_one()

    with patch(
        "app.api.endpoints.summary.WorkflowService.pruning",
        new=AsyncMock(return_value={"deleted": 3}),
    ) as mocked:
        response = await client.post("/api/v1/summary/pruning", headers=headers)

    assert response.status_code == 200
    assert response.json() == {"deleted": 3}
    mocked.assert_awaited_once_with(user_id=user.id)


@pytest.mark.asyncio
async def test_summary_pruning_uses_none_for_admin(
    client: AsyncClient,
    superuser_token_headers: dict,
):
    with patch(
        "app.api.endpoints.summary.WorkflowService.pruning",
        new=AsyncMock(return_value={"deleted": 7}),
    ) as mocked:
        response = await client.post("/api/v1/summary/pruning", headers=superuser_token_headers)

    assert response.status_code == 200
    mocked.assert_awaited_once_with(user_id=None)


@pytest.mark.asyncio
async def test_summary_health_returns_service_aggregate(
    client: AsyncClient,
    superuser_token_headers: dict,
):
    payload = SystemHealthResponse(
        database=ServiceStatus(
            name="database",
            status="healthy",
            message="ok",
            details={"connection": "ok"},
        ),
        sse=ServiceStatus(
            name="sse",
            status="unhealthy",
            message="down",
            details={"connection": "lost"},
        ),
        overall_status="unhealthy",
    )

    with patch(
        "app.api.endpoints.summary.SummaryService.get_system_health",
        new=AsyncMock(return_value=payload),
    ):
        response = await client.get("/api/v1/summary/health", headers=superuser_token_headers)

    assert response.status_code == 200
    assert response.json()["overall_status"] == "unhealthy"
