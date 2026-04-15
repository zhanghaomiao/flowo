import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.models.workflow import Workflow
from app.services.workflow import WorkflowService


@pytest.fixture
def mock_db_session():
    return AsyncMock()

@pytest.fixture
def workflow_service(mock_db_session):
    return WorkflowService(mock_db_session)

@pytest.mark.asyncio
async def test_get_detail_not_found(workflow_service, mock_db_session):
    mock_execute = MagicMock()
    mock_execute.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = mock_execute

    with pytest.raises(HTTPException) as exc:
        await workflow_service.get_detail(uuid.uuid4())
    assert exc.value.status_code == 404
    assert "not found" in exc.value.detail


@pytest.mark.asyncio
async def test_get_detail_success(workflow_service, mock_db_session):
    workflow_id = uuid.uuid4()
    mock_wf = Workflow(id=workflow_id, name="Test WF", directory="/path/to/wf", status="SUCCESS", snakefile="Snakefile", started_at=None, end_time=None)

    # Needs two execute calls: one for get_workflow and one for _get_progress
    mock_get_execute = MagicMock()
    mock_get_execute.scalar_one_or_none.return_value = mock_wf

    mock_progress_execute = MagicMock()
    mock_progress_execute.scalar.return_value = 100

    mock_db_session.execute.side_effect = [mock_get_execute, mock_progress_execute]

    # We also mock get_workflow_run_info because _get_progress calls it implicitly
    with patch.object(workflow_service, "get_workflow_run_info", new_callable=AsyncMock) as m_run_info:
        m_run_info.return_value = {"total": 100}
        result = await workflow_service.get_detail(workflow_id)
        assert result.workflow_id == workflow_id
        assert result.name == "Test WF"
        assert result.flowo_directory == "/path/to/wf"


@pytest.mark.asyncio
async def test_delete_workflow(workflow_service, mock_db_session):
    workflow_id = uuid.uuid4()

    # Two execute calls and one commit
    await workflow_service.delete_workflow(workflow_id)

    assert mock_db_session.execute.call_count == 2
    mock_db_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_list_all_workflows(workflow_service, mock_db_session):
    mock_result = MagicMock()
    mock_wf1 = Workflow(id=uuid.uuid4(), name="WF 1", status="SUCCESS", configfiles=[], snakefile="Snakefile")
    mock_wf2 = Workflow(id=uuid.uuid4(), name="WF 2", status="SUCCESS", configfiles=[], snakefile="Snakefile")
    mock_result.scalars().all.return_value = [mock_wf1, mock_wf2]

    mock_count = MagicMock()
    mock_count.scalar.return_value = 2

    # execute calls:
    # 1. count
    # 2. workflows
    # 3. get_progress -> job query
    # 4. _get_progress -> job query
    # It might be very complex to mock all of them by side_effect precisely without knowing the order
    # Let's mock _get_progress and get_workflow_run_info instead
    mock_db_session.execute.side_effect = [mock_count, mock_result]

    with patch.object(workflow_service, "_get_progress", new_callable=AsyncMock) as m_prog, \
         patch.object(workflow_service, "get_workflow_run_info", new_callable=AsyncMock) as m_info:

        m_prog.return_value = 100
        m_info.return_value = {"total": 5}

        response = await workflow_service.list_all_workflows(limit=10, offset=0, user=None)

        assert response.total == 2
        assert len(response.workflows) == 2
        assert response.workflows[0].total_jobs == 5


@pytest.mark.asyncio
async def test_pruning(workflow_service, mock_db_session):
    # pruning executes multiple queries
    user_id = uuid.uuid4()

    # 1. empty workflows query
    mock_empty_wfs = MagicMock()
    mock_empty_wfs.all.return_value = [(uuid.uuid4(),), (uuid.uuid4(),)]

    # 2. jobs to error query
    mock_jobs_error = MagicMock()
    mock_jobs_error.all.return_value = [(1,)]

    # 3. jobs to success query
    mock_jobs_success = MagicMock()
    mock_jobs_success.all.return_value = [(2,)]

    # side_effect: it executes 1, then two deletes per empty wf, then 2, then updates, then 3, then updates
    # Just setting return value for any call, but we need to supply lists back
    mock_db_session.execute.side_effect = [
        mock_empty_wfs, # query empty wfs
        MagicMock(),    # delete Error
        MagicMock(),    # delete Workflow
        MagicMock(),    # delete Error
        MagicMock(),    # delete Workflow
        mock_jobs_error, # query jobs error
        MagicMock(),    # update Job (error)
        mock_jobs_success, # query jobs success
        MagicMock(),    # update Job (success)
    ]

    res = await workflow_service.pruning(user_id)
    assert res["workflow"] == 2
    assert res["job"] == 2
    mock_db_session.commit.assert_awaited_once()

