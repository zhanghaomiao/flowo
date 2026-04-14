import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.user import User


@pytest.mark.asyncio
async def test_register_user(client: AsyncClient, db):
    # Test registration
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@example.com",
            "password": "testpassword123",
            "is_active": True,
            "is_superuser": False,
            "is_verified": False,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data

    # Verify in DB
    result = await db.execute(select(User).where(User.email == "test@example.com"))
    user = result.scalar_one()
    assert user.email == "test@example.com"
    # Small team simplification forces is_verified=True
    assert user.is_verified is True


@pytest.mark.asyncio
async def test_login_user(client: AsyncClient):
    # 1. Register
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "login@example.com",
            "password": "loginpassword123",
        },
    )

    # 2. Login
    response = await client.post(
        "/api/v1/auth/jwt/login",
        data={
            "username": "login@example.com",
            "password": "loginpassword123",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient):
    # 1. Register & Login
    await client.post(
        "/api/v1/auth/register",
        json={"email": "me@example.com", "password": "mepassword123"},
    )
    login_resp = await client.post(
        "/api/v1/auth/jwt/login",
        data={"username": "me@example.com", "password": "mepassword123"},
    )
    token = login_resp.json()["access_token"]

    # 2. Get Me
    response = await client.get(
        "/api/v1/auth/users/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == "me@example.com"
