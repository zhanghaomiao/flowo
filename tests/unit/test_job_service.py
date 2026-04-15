import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.models import File, Job, Rule, Workflow
from app.schemas import JobDetailResponse
from app.services.job import JobService


@pytest.fixture
def mock_db_session():
    return AsyncMock()


@pytest.fixture
def job_service(mock_db_session):
    return JobService(mock_db_session)


@pytest.mark.asyncio
async def test_get_all_jobs(job_service, mock_db_session):
    mock_execute = MagicMock()
    mock_job1 = Job(id=1, status="SUCCESS")
    mock_job2 = Job(id=2, status="RUNNING")
    mock_execute.scalars().all.return_value = [mock_job1, mock_job2]
    mock_db_session.execute.return_value = mock_execute

    jobs = await job_service.get_all_jobs(limit=10, offset=0)

    assert len(jobs) == 2
    assert jobs[0].status == "SUCCESS"
    assert jobs[1].status == "RUNNING"
    mock_db_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_get_jobs_by_workflow_id(job_service, mock_db_session):
    workflow_id = uuid.uuid4()

    # Needs two db_session.execute calls: one for count, one for roles
    mock_count_execute = MagicMock()
    mock_count_execute.scalar.return_value = 5

    mock_data_execute = MagicMock()
    # returns tuple like (job, rule_name)
    mock_job = Job(id=1, status="RUNNING", workflow_id=workflow_id)
    mock_data_execute.all.return_value = [(mock_job, "align")]

    # Return count execution first, then data execution
    mock_db_session.execute.side_effect = [mock_count_execute, mock_data_execute]

    result = await job_service.get_jobs_by_workflow_id(workflow_id, limit=10, offset=0)

    assert result.total == 5
    assert len(result.jobs) == 1
    assert result.jobs[0].id == 1
    assert result.jobs[0].rule_name == "align"
    assert mock_db_session.execute.call_count == 2


@pytest.mark.asyncio
async def test_get_job_details_with_id_not_found(job_service, mock_db_session):
    mock_execute = MagicMock()
    mock_execute.scalars().one_or_none.return_value = None
    mock_db_session.execute.return_value = mock_execute

    with pytest.raises(HTTPException) as exc:
        await job_service.get_job_details_with_id(999)

    assert exc.value.status_code == 404
    assert "not found" in exc.value.detail


@pytest.mark.asyncio
async def test_get_job_details_with_id_success(job_service, mock_db_session):
    mock_execute = MagicMock()

    workflow_id = uuid.uuid4()
    mock_rule = Rule(name="sort")
    mock_workflow = Workflow(id=workflow_id)
    mock_job = Job(id=1, status="SUCCESS", started_at=datetime.now(UTC), rule=mock_rule, workflow_id=workflow_id, workflow=mock_workflow)

    mock_execute.scalars().one_or_none.return_value = mock_job
    mock_db_session.execute.return_value = mock_execute

    # Mock WorkflowService since it is internally used
    with patch("app.services.job.WorkflowService") as mock_wf_service_cls:
        mock_wf_service = MagicMock()
        mock_wf_detail = MagicMock()
        mock_wf_detail.directory = "/path/to/wf"
        mock_wf_service.get_detail = AsyncMock(return_value=mock_wf_detail)
        mock_wf_service_cls.return_value = mock_wf_service

        detail = await job_service.get_job_details_with_id(1)

        assert isinstance(detail, JobDetailResponse)
        assert detail.rule_name == "sort"
        assert detail.directory == "/path/to/wf"


@pytest.mark.asyncio
async def test_get_job_files_with_id(job_service, mock_db_session):
    mock_execute = MagicMock()
    # File needs a file_type Enum in real life, simulate object having `.value`
    class MockFileType:
        @property
        def value(self): return "LOG"

    class MockFileTypeOutput:
        @property
        def value(self): return "OUTPUT"

    mock_file1 = File(path="test.log", file_type=MockFileType())
    mock_file2 = File(path="out.txt", file_type=MockFileTypeOutput())

    mock_execute.scalars().all.return_value = [mock_file1, mock_file2]
    mock_db_session.execute.return_value = mock_execute

    files_result = await job_service.get_job_files_with_id(1)

    assert "log" in files_result
    assert "output" in files_result
    assert files_result["log"] == ["test.log"]
    assert files_result["output"] == ["out.txt"]


@pytest.mark.asyncio
async def test_delete_jobs(job_service, mock_db_session):
    workflow_id = uuid.uuid4()

    # job ids
    mock_execute_ids = MagicMock()
    mock_execute_ids.scalars().all.return_value = [1, 2]
    mock_db_session.execute.return_value = mock_execute_ids

    await job_service.delete_jobs(workflow_id)

    # Should delete File, Job, Rule and commit
    assert mock_db_session.execute.call_count == 4
    mock_db_session.commit.assert_called_once()
