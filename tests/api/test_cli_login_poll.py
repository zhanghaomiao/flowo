"""CLI device login poll returns server FLOWO_WORKING_PATH for the client config."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_cli_poll_returns_working_path_with_token(
    client: AsyncClient,
    register_user,
    login_user,
):
    await register_user("cli-poll-wp@example.com")
    headers = await login_user("cli-poll-wp@example.com")

    start = await client.post("/api/v1/tokens/cli/start", json={"ttl_days": 7})
    assert start.status_code == 200
    device_code = start.json()["device_code"]

    pending = await client.get(f"/api/v1/tokens/cli/poll/{device_code}")
    assert pending.status_code == 200
    assert pending.json()["status"] == "pending"

    approve = await client.post(
        "/api/v1/tokens/cli/approve",
        json={"device_code": device_code},
        headers=headers,
    )
    assert approve.status_code == 200

    final = await client.get(f"/api/v1/tokens/cli/poll/{device_code}")
    assert final.status_code == 200
    body = final.json()
    assert body["status"] == "approved"
    assert body.get("token")
    assert body.get("flowo_working_path")
