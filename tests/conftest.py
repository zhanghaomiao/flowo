import os
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault(
    "SECRET_KEY",
    "flowo-test-secret-key-with-safe-length-1234567890",
)

from app.api.deps import get_async_session
from app.core.config import settings
from app.core.session import get_db
from app.main import app as fastapi_app
from app.models.base import Base

# Use a separate database for testing
TEST_POSTGRES_PORT = os.getenv("TEST_POSTGRES_PORT", "5555")
TEST_POSTGRES_DB = settings.POSTGRES_DB + "_test"

TEST_ASYNC_SQLALCHEMY_DATABASE_URI = (
    f"postgresql+asyncpg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
    f"@{settings.POSTGRES_HOST}:{TEST_POSTGRES_PORT}/{TEST_POSTGRES_DB}"
)

TEST_SYNC_SQLALCHEMY_DATABASE_URI = (
    f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
    f"@{settings.POSTGRES_HOST}:{TEST_POSTGRES_PORT}/{TEST_POSTGRES_DB}"
)


@pytest.fixture
def engine():
    """Provides a fresh async engine for each test."""
    engine = create_async_engine(TEST_ASYNC_SQLALCHEMY_DATABASE_URI, echo=False)
    yield engine


@pytest.fixture
def sync_engine():
    """Provides a fresh sync engine for each test."""
    engine = create_engine(TEST_SYNC_SQLALCHEMY_DATABASE_URI, echo=False)
    yield engine


@pytest.fixture
def TestingSessionLocal(engine):
    """Provides an async sessionmaker for each test."""
    return async_sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )


@pytest.fixture
def SyncTestingSessionLocal(sync_engine):
    """Provides a sync sessionmaker for each test."""
    return sessionmaker(
        bind=sync_engine,
        autocommit=False,
        autoflush=False,
    )


@pytest.fixture(autouse=True)
async def setup_db(engine):
    """Initializes the test database for each test (function scope)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db(TestingSessionLocal) -> AsyncGenerator[AsyncSession, None]:
    """Provides a fresh async database session for each test."""
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
def sync_db(SyncTestingSessionLocal):
    """Provides a fresh sync database session for each test."""
    with SyncTestingSessionLocal() as session:
        yield session
        session.rollback()


@pytest.fixture
async def client(db: AsyncSession, sync_db) -> AsyncGenerator[AsyncClient, None]:
    """Provides an AsyncClient that overrides both sync and async DB dependencies."""

    def override_get_async_session():
        yield db

    def override_get_db():
        yield sync_db

    fastapi_app.dependency_overrides[get_async_session] = override_get_async_session
    fastapi_app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=fastapi_app), base_url="http://test"
    ) as ac:
        yield ac
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
async def superuser_token_headers(client: AsyncClient) -> dict[str, str]:
    """Provides headers for a logged-in superuser."""
    email = "admin@example.com"
    password = "adminpassword"

    # 1. Register superuser
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "is_superuser": True,
        },
    )

    # 2. Login
    resp = await client.post(
        "/api/v1/auth/jwt/login",
        data={"username": email, "password": password},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def register_user(client: AsyncClient):
    async def _register_user(
        email: str,
        password: str = "testpassword123",
        *,
        is_superuser: bool = False,
        is_active: bool = True,
        is_verified: bool = True,
    ):
        return await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": password,
                "is_superuser": is_superuser,
                "is_active": is_active,
                "is_verified": is_verified,
            },
        )

    return _register_user


@pytest.fixture
def login_user(client: AsyncClient):
    async def _login_user(email: str, password: str = "testpassword123") -> dict[str, str]:
        resp = await client.post(
            "/api/v1/auth/jwt/login",
            data={"username": email, "password": password},
        )
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _login_user
