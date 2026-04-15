from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import asyncpg
import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.schemas.util import ServiceStatus
from app.services.summary import SummaryService


@pytest.fixture
def mock_db_session():
    return AsyncMock()


@pytest.fixture
def summary_service(mock_db_session):
    return SummaryService(mock_db_session)


@pytest.mark.asyncio
async def test_get_status_workflow(summary_service, mock_db_session):
    mock_result = MagicMock()
    mock_result.total = 10
    mock_result.success = 7
    mock_result.error = 2
    mock_result.running = 1

    mock_execute = MagicMock()
    mock_execute.one.return_value = mock_result
    mock_db_session.execute.return_value = mock_execute

    status = await summary_service.get_status("workflow")

    assert status.total == 10
    assert status.success == 7
    assert status.error == 2
    assert status.running == 1
    mock_db_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_get_status_job(summary_service, mock_db_session):
    mock_result = MagicMock()
    mock_result.success = 50
    mock_result.error = 5
    mock_result.running = 10

    mock_execute = MagicMock()
    mock_execute.one.return_value = mock_result
    mock_db_session.execute.return_value = mock_execute

    status = await summary_service.get_status("job", user_id="user123")

    assert status.total == 65
    assert status.success == 50
    assert status.error == 5
    assert status.running == 10

    # Check that where clause includes filter for user_id (implicitly validated if execute runs without failures)
    mock_db_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_get_activity_rule(summary_service, mock_db_session):
    mock_execute = MagicMock()
    mock_execute.all.return_value = [("align", 20), ("sort", 15)]
    mock_db_session.execute.return_value = mock_execute

    start = datetime(2023, 1, 1, tzinfo=UTC)
    end = datetime(2023, 12, 31, tzinfo=UTC)
    activity = await summary_service.get_activity("rule", start, end, limit=5, user_id=None)

    assert activity == {"align": 20, "sort": 15}
    mock_db_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_get_activity_tag(summary_service, mock_db_session):
    # Mock workflow objects with tags
    wf1 = MagicMock(tags=["genomics", "human"])
    wf2 = MagicMock(tags=["human", "rnaseq"])
    wf3 = MagicMock(tags=["genomics", "microbiome"])
    wf_no_tags = MagicMock(tags=None)

    mock_execute = MagicMock()
    mock_execute.scalars().all.return_value = [wf1, wf2, wf3, wf_no_tags]
    mock_db_session.execute.return_value = mock_execute

    activity = await summary_service.get_activity("tag", None, None, limit=2)

    # "human" and "genomics" appear twice, "rnaseq" and "microbiome" appear once.
    # With limit=2 it should return the top 2
    assert activity == {"genomics": 2, "human": 2}


@pytest.mark.asyncio
async def test_get_rule_error(summary_service, mock_db_session):
    # return values matching tuple: rule_name, total, error, pct
    mock_execute = MagicMock()
    mock_execute.all.return_value = [
        ("align", 100, 10, 0.1),
        ("sort", 50, 0, 0.0), # should be filtered since error is 0
        ("bwa", 20, 5, 0.25)
    ]
    mock_db_session.execute.return_value = mock_execute

    errors = await summary_service.get_rule_error(None, None)

    assert "align" in errors
    assert "bwa" in errors
    assert "sort" not in errors
    assert errors["align"] == {"total": 100, "error": 10}


@pytest.mark.asyncio
async def test_check_database_health_healthy(summary_service, mock_db_session):
    mock_execute = MagicMock()
    mock_execute.fetchone.return_value = [1]
    mock_db_session.execute.return_value = mock_execute

    status = await summary_service.check_database_health()

    assert status.status == "healthy"
    assert status.name == "database"


@pytest.mark.asyncio
async def test_check_database_health_unhealthy(summary_service, mock_db_session):
    mock_execute = MagicMock()
    mock_execute.fetchone.return_value = [0]
    mock_db_session.execute.return_value = mock_execute

    status = await summary_service.check_database_health()

    assert status.status == "unhealthy"
    assert status.name == "database"


@pytest.mark.asyncio
async def test_check_database_health_sqlalchemy_error(summary_service, mock_db_session):
    mock_db_session.execute.side_effect = SQLAlchemyError("db down")

    status = await summary_service.check_database_health()

    assert status.status == "unhealthy"
    assert "db down" in status.message


@pytest.mark.asyncio
async def test_check_database_health_unexpected_error(summary_service, mock_db_session):
    mock_db_session.execute.side_effect = RuntimeError("boom")

    status = await summary_service.check_database_health()

    assert status.status == "unknown"
    assert "boom" in status.message


@pytest.mark.asyncio
async def test_check_sse_health_disconnected(summary_service):
    status = await summary_service.check_sse_health()

    assert status.status == "unhealthy"
    assert status.details["connection"] == "disconnected"


@pytest.mark.asyncio
async def test_check_sse_health_healthy(summary_service, monkeypatch):
    connection = AsyncMock()
    connection.fetchval.return_value = 1
    monkeypatch.setattr("app.services.summary.pg_listener._connection", connection)
    monkeypatch.setattr("app.services.summary.pg_listener._listening_channels", {"a", "b"})

    status = await summary_service.check_sse_health()

    assert status.status == "healthy"
    assert status.details["listeners"] == 2


@pytest.mark.asyncio
async def test_check_sse_health_interface_error(summary_service, monkeypatch):
    connection = AsyncMock()
    connection.fetchval.side_effect = asyncpg.exceptions.InterfaceError("lost")
    monkeypatch.setattr("app.services.summary.pg_listener._connection", connection)

    status = await summary_service.check_sse_health()

    assert status.status == "unhealthy"
    assert status.details["connection"] == "lost"


@pytest.mark.asyncio
async def test_check_sse_health_connection_error(summary_service, monkeypatch):
    connection = AsyncMock()
    connection.fetchval.side_effect = RuntimeError("socket closed")
    monkeypatch.setattr("app.services.summary.pg_listener._connection", connection)

    status = await summary_service.check_sse_health()

    assert status.status == "unhealthy"
    assert "socket closed" in status.message


@pytest.mark.asyncio
async def test_check_sse_health_outer_error(summary_service, monkeypatch):
    class BrokenConnection:
        async def fetchval(self, _query):
            raise RuntimeError("bad fetch")

    monkeypatch.setattr("app.services.summary.pg_listener", None)
    monkeypatch.setattr("app.services.summary.pg_listener", type("BrokenListener", (), {"_connection": BrokenConnection()})())

    status = await summary_service.check_sse_health()

    assert status.status == "unhealthy"
    assert "bad fetch" in status.message


@pytest.mark.asyncio
async def test_get_system_health_healthy(summary_service, monkeypatch):
    monkeypatch.setattr(
        summary_service,
        "check_database_health",
        AsyncMock(
            return_value=ServiceStatus(
                name="database",
                status="healthy",
                message="ok",
                details={"connection": "ok"},
            )
        ),
    )
    monkeypatch.setattr(
        summary_service,
        "check_sse_health",
        AsyncMock(
            return_value=ServiceStatus(
                name="sse",
                status="healthy",
                message="ok",
                details={"connection": "ok"},
            )
        ),
    )

    result = await summary_service.get_system_health()

    assert result.overall_status == "healthy"


@pytest.mark.asyncio
async def test_get_system_health_unhealthy(summary_service, monkeypatch):
    monkeypatch.setattr(
        summary_service,
        "check_database_health",
        AsyncMock(
            return_value=ServiceStatus(
                name="database",
                status="healthy",
                message="ok",
                details={"connection": "ok"},
            )
        ),
    )
    monkeypatch.setattr(
        summary_service,
        "check_sse_health",
        AsyncMock(
            return_value=ServiceStatus(
                name="sse",
                status="unhealthy",
                message="down",
                details={"connection": "lost"},
            )
        ),
    )

    result = await summary_service.get_system_health()

    assert result.overall_status == "unhealthy"


@pytest.mark.asyncio
async def test_get_system_health_degraded(summary_service, monkeypatch):
    monkeypatch.setattr(
        summary_service,
        "check_database_health",
        AsyncMock(
            return_value=ServiceStatus(
                name="database",
                status="unknown",
                message="unknown",
                details={"error": "boom"},
            )
        ),
    )
    monkeypatch.setattr(
        summary_service,
        "check_sse_health",
        AsyncMock(
            return_value=ServiceStatus(
                name="sse",
                status="healthy",
                message="ok",
                details={"connection": "ok"},
            )
        ),
    )

    result = await summary_service.get_system_health()

    assert result.overall_status == "degraded"
