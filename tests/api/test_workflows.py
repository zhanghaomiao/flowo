import uuid

import pytest
from httpx import AsyncClient

from app.models import Status, Workflow


@pytest.mark.asyncio
async def test_list_workflows(client: AsyncClient, superuser_token_headers: dict, db):
    # 1. Create a dummy workflow
    wf_id = uuid.uuid4()
    wf = Workflow(
        id=wf_id,
        name="Test Workflow",
        status=Status.SUCCESS,
        dryrun=False,
        tags=["test"],
    )
    db.add(wf)
    await db.commit()

    # 2. List workflows via API
    response = await client.get("/api/v1/workflows/", headers=superuser_token_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["workflows"]) >= 1
    assert any(str(w["id"]) == str(wf_id) for w in data["workflows"])


@pytest.mark.asyncio
async def test_get_workflow_detail(
    client: AsyncClient, superuser_token_headers: dict, db
):
    # 1. Create a dummy workflow
    wf_id = uuid.uuid4()
    wf = Workflow(id=wf_id, name="Detail Workflow", status=Status.RUNNING, dryrun=False)
    db.add(wf)
    await db.commit()

    # 2. Get detail
    response = await client.get(
        f"/api/v1/workflows/{wf_id}/detail", headers=superuser_token_headers
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Detail Workflow"


@pytest.mark.asyncio
async def test_delete_workflow(client: AsyncClient, superuser_token_headers: dict, db):
    # 1. Create a dummy workflow
    wf_id = uuid.uuid4()
    wf = Workflow(id=wf_id, name="To Delete", status=Status.SUCCESS, dryrun=False)
    db.add(wf)
    await db.commit()

    # 2. Delete
    response = await client.delete(
        f"/api/v1/workflows/{wf_id}", headers=superuser_token_headers
    )
    assert response.status_code == 200

    # 3. Verify gone
    from sqlalchemy import select

    result = await db.execute(select(Workflow).where(Workflow.id == wf_id))
    assert result.scalar_one_or_none() is None
