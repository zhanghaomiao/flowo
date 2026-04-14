import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models import Job, Status, Workflow


@pytest.mark.asyncio
async def test_report_workflow_started(
    client: AsyncClient, superuser_token_headers: dict, db
):
    # 1. Report workflow_started
    workflow_id = "550e8400-e29b-41d4-a716-446655440000"
    payload = {
        "event": "workflow_started",
        "record": {
            "workflow_id": workflow_id,
            "snakefile": "Snakefile",
            "rules": [
                {"name": "all", "code": None, "language": None},
                {"name": "test_rule", "code": "echo hello", "language": "bash"},
            ],
        },
        "context": {
            "flowo_project_name": "Test Project",
            "flowo_tags": ["tag1", "tag2"],
            "workdir": "/tmp",
        },
    }

    response = await client.post(
        "/api/v1/reports/", json=payload, headers=superuser_token_headers
    )
    assert response.status_code == 200

    # Check if workflow was created in DB
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one()
    assert workflow.name == "Test Project"
    assert "tag1" in workflow.tags


@pytest.mark.asyncio
async def test_report_job_lifecycle(
    client: AsyncClient, superuser_token_headers: dict, db
):
    workflow_id = "660e8400-e29b-41d4-a716-446655440000"

    # 1. Start Workflow
    resp = await client.post(
        "/api/v1/reports/",
        json={
            "event": "workflow_started",
            "record": {"workflow_id": workflow_id, "snakefile": "S", "rules": []},
            "context": {},
        },
        headers=superuser_token_headers,
    )
    context = resp.json()["context"]

    # 2. Add Run Info (total jobs)
    resp = await client.post(
        "/api/v1/reports/",
        json={
            "event": "run_info",
            "record": {"stats": {"test_rule": 1, "total": 1}},
            "context": context,
        },
        headers=superuser_token_headers,
    )
    context = resp.json()["context"]

    # 3. Report Job Started
    resp = await client.post(
        "/api/v1/reports/",
        json={"event": "job_started", "record": {"job_ids": [1]}, "context": context},
        headers=superuser_token_headers,
    )
    context = resp.json()["context"]

    # 4. Report Job Info
    resp = await client.post(
        "/api/v1/reports/",
        json={
            "event": "job_info",
            "record": {
                "job_id": 1,
                "rule_name": "test_rule",
                "threads": 1,
                "rule_msg": "msg",
                "reason": "r",
                "shellcmd": "cmd",
                "priority": 1,
                "input": [],
                "log": [],
                "output": [],
            },
            "context": context,
        },
        headers=superuser_token_headers,
    )
    context = resp.json()["context"]

    # Verify Job is RUNNING in DB
    result = await db.execute(
        select(Job).where(Job.workflow_id == workflow_id, Job.snakemake_id == 1)
    )
    job = result.scalar_one()
    assert job.status == Status.RUNNING

    # 5. Report Job Finished
    await client.post(
        "/api/v1/reports/",
        json={"event": "job_finished", "record": {"job_id": 1}, "context": context},
        headers=superuser_token_headers,
    )

    # Verify Job is SUCCESS in DB
    await db.refresh(job)
    assert job.status == Status.SUCCESS


@pytest.mark.asyncio
async def test_close_workflow(client: AsyncClient, superuser_token_headers: dict, db):
    workflow_id = "770e8400-e29b-41d4-a716-446655440000"

    # Setup workflow and success job
    await client.post(
        "/api/v1/reports/",
        json={
            "event": "workflow_started",
            "record": {"workflow_id": workflow_id, "snakefile": "S", "rules": []},
            "context": {"current_workflow_id": workflow_id},
        },
        headers=superuser_token_headers,
    )

    # Close workflow
    response = await client.post(
        "/api/v1/reports/close",
        params={"workflow_id": workflow_id},
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "SUCCESS"

    # Verify Workflow status in DB
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one()
    assert workflow.status == Status.SUCCESS
