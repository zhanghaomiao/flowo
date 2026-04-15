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


@pytest.mark.asyncio
async def test_workflow_endpoints(client: AsyncClient, superuser_token_headers: dict, db, tmp_path):
    test_data_dir = tmp_path / "test_data"
    test_data_dir.mkdir()

    snakefile_path = test_data_dir / "Snakefile"
    logfile_path = test_data_dir / "test.log"
    configfile_path = test_data_dir / "config.yaml"

    snakefile_path.write_text("rule all: pass")
    logfile_path.write_text("log data")
    configfile_path.write_text("config: ok")

    wf_id = uuid.uuid4()
    wf = Workflow(
        id=wf_id,
        name="Endpoints Workflow",
        status=Status.RUNNING,
        dryrun=False,
        run_info={"total": 10},
        rulegraph_data={"nodes": []},
        snakefile=str(snakefile_path),
        logfile=str(logfile_path),
        configfiles=[str(configfile_path)],
        flowo_working_path=str(test_data_dir)
    )
    db.add(wf)
    await db.commit()

    # Dummy files created above using tmp_path

    endpoints = [
        f"/api/v1/workflows/{wf_id}/jobs",
        f"/api/v1/workflows/{wf_id}/rule_graph",
        f"/api/v1/workflows/{wf_id}/rule_status",
        f"/api/v1/workflows/{wf_id}/rules",
        f"/api/v1/workflows/{wf_id}/snakefile",
        f"/api/v1/workflows/{wf_id}/log",
        f"/api/v1/workflows/{wf_id}/configfiles",
        f"/api/v1/workflows/{wf_id}/progress",
        f"/api/v1/workflows/{wf_id}/timelines",
    ]
    from unittest.mock import patch

    from app.utils.paths import PathContent

    with patch("app.services.workflow.get_file_content", return_value=PathContent(path="mock", content="mock data", type="file", size=10)), \
         patch("app.utils.paths.path_resolver.resolve", return_value="mock_path"):

        for ep in endpoints:
            resp = await client.get(ep, headers=superuser_token_headers)
            assert resp.status_code == 200, f"{ep} failed with {resp.text}"

        resp_by_name = await client.get("/api/v1/workflows/by_name?name=Endpoints%20Workflow", headers=superuser_token_headers)
        assert resp_by_name.status_code == 200
        assert resp_by_name.json() == str(wf_id)
