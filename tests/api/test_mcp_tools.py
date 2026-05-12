import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models import (
    Catalog,
    CatalogFile,
    Error,
    File,
    FileType,
    Job,
    Rule,
    Status,
    Workflow,
)
from app.models.user import User


async def _headers_and_user(register_user, login_user, db, email: str):
    await register_user(email)
    headers = await login_user(email)
    user = (await db.execute(select(User).where(User.email == email))).scalar_one()
    return headers, user


@pytest.mark.asyncio
async def test_mcp_list_workflows_finds_recent_workflows(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    headers, user = await _headers_and_user(
        register_user, login_user, db, "mcp-list@example.com"
    )
    old_id = uuid.uuid4()
    recent_id = uuid.uuid4()
    db.add_all(
        [
            Workflow(
                id=old_id,
                name="demo2 old",
                status=Status.SUCCESS,
                dryrun=False,
                started_at=datetime.now(UTC) - timedelta(days=2),
                user_id=user.id,
                user=user.email,
            ),
            Workflow(
                id=recent_id,
                name="demo2 recent",
                status=Status.RUNNING,
                dryrun=False,
                started_at=datetime.now(UTC),
                run_info={"total": 4},
                user_id=user.id,
                user=user.email,
            ),
        ]
    )
    await db.commit()

    response = await client.get(
        "/api/v1/mcp-tools/workflows",
        params={"name_query": "demo2", "since_hours": 24},
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total_matches"] == 1
    assert data["workflows"][0]["id"] == str(recent_id)


@pytest.mark.asyncio
async def test_mcp_summarize_latest_workflow_without_id(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    headers, user = await _headers_and_user(
        register_user, login_user, db, "mcp-summary@example.com"
    )
    workflow_id = uuid.uuid4()
    workflow = Workflow(
        id=workflow_id,
        name="demo2 latest",
        status=Status.SUCCESS,
        dryrun=False,
        started_at=datetime.now(UTC),
        run_info={"total": 1},
        user_id=user.id,
        user=user.email,
        configfiles=["config/config.yaml"],
    )
    rule = Rule(
        name="align", code="shell: bwa mem", language="python", workflow=workflow
    )
    job = Job(
        snakemake_id=1,
        workflow=workflow,
        rule=rule,
        status=Status.SUCCESS,
        started_at=datetime.now(UTC) - timedelta(minutes=2),
        end_time=datetime.now(UTC),
    )
    db.add_all([workflow, rule, job])
    await db.commit()

    response = await client.get(
        "/api/v1/mcp-tools/workflows/latest/summary",
        params={"name_query": "demo2"},
        headers=headers,
    )

    assert response.status_code == 200
    summary = response.json()["summary"]
    assert summary["workflow"]["id"] == str(workflow_id)
    assert summary["jobs"]["total"] == 1
    assert summary["rules"][0]["name"] == "align"


@pytest.mark.asyncio
async def test_mcp_diagnose_latest_failed_workflow_without_id(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    headers, user = await _headers_and_user(
        register_user, login_user, db, "mcp-diagnose@example.com"
    )
    workflow = Workflow(
        id=uuid.uuid4(),
        name="variant-calling",
        status=Status.ERROR,
        dryrun=False,
        started_at=datetime.now(UTC),
        user_id=user.id,
        user=user.email,
    )
    rule = Rule(name="call_variants", code="shell: bcftools", workflow=workflow)
    job = Job(
        snakemake_id=3,
        workflow=workflow,
        rule=rule,
        status=Status.ERROR,
        shellcmd="bcftools call sample.bam",
        started_at=datetime.now(UTC) - timedelta(minutes=5),
    )
    error = Error(
        workflow=workflow,
        rule=rule,
        exception="MissingInputException",
        location="Snakefile:42",
        traceback="missing sample.bam",
        file="Snakefile",
        line="42",
    )
    db.add_all([workflow, rule, job, error])
    await db.commit()

    response = await client.get(
        "/api/v1/mcp-tools/workflows/latest/failure-diagnosis",
        params={"name_query": "variant"},
        headers=headers,
    )

    assert response.status_code == 200
    diagnosis = response.json()["diagnosis"]
    assert diagnosis["workflow"]["name"] == "variant-calling"
    assert diagnosis["failed_jobs"][0]["rule"] == "call_variants"
    assert diagnosis["errors"][0]["exception"] == "MissingInputException"


@pytest.mark.asyncio
async def test_mcp_timeline_and_outputs(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    headers, user = await _headers_and_user(
        register_user, login_user, db, "mcp-output@example.com"
    )
    workflow = Workflow(
        id=uuid.uuid4(),
        name="output workflow",
        status=Status.SUCCESS,
        dryrun=False,
        started_at=datetime.now(UTC),
        user_id=user.id,
        user=user.email,
    )
    rule = Rule(name="make_bam", workflow=workflow)
    job = Job(
        snakemake_id=7,
        workflow=workflow,
        rule=rule,
        status=Status.SUCCESS,
        started_at=datetime.now(UTC) - timedelta(minutes=10),
        end_time=datetime.now(UTC) - timedelta(minutes=1),
    )
    file_row = File(path="results/sample.bam", file_type=FileType.OUTPUT, job=job)
    db.add_all([workflow, rule, job, file_row])
    await db.commit()

    timeline_response = await client.get(
        f"/api/v1/mcp-tools/workflows/{workflow.id}/timeline",
        headers=headers,
    )
    outputs_response = await client.get(
        f"/api/v1/mcp-tools/workflows/{workflow.id}/outputs",
        params={"suffix": "bam"},
        headers=headers,
    )

    assert timeline_response.status_code == 200
    assert timeline_response.json()["slowest_jobs"][0]["rule"] == "make_bam"
    assert outputs_response.status_code == 200
    assert outputs_response.json()["outputs"] == [
        {
            "path": "results/sample.bam",
            "rule": "make_bam",
            "job_id": job.id,
            "job_status": "SUCCESS",
        }
    ]


@pytest.mark.asyncio
async def test_mcp_catalog_tools_read_and_search_db_backed_files(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    headers, user = await _headers_and_user(
        register_user, login_user, db, "mcp-catalog@example.com"
    )
    catalog = Catalog(
        id=uuid.uuid4(),
        slug="rna-demo",
        name="RNA Demo",
        description="RNA workflow catalog",
        owner_id=user.id,
        owner=user.email,
        tags=["rna"],
        is_public=False,
    )
    db.add_all(
        [
            catalog,
            CatalogFile(
                catalog_id=catalog.id,
                path="workflow/Snakefile",
                content="rule all:\n    input: 'results/counts.tsv'\ninclude: 'rules/qc.smk'\n",
                sha256="snake",
                size=66,
                lines=3,
                language="python",
            ),
            CatalogFile(
                catalog_id=catalog.id,
                path="config/config.yaml",
                content="samples: samples.tsv\nthreads: 8\n",
                sha256="config",
                size=31,
                lines=2,
                language="yaml",
            ),
            CatalogFile(
                catalog_id=catalog.id,
                path="rules/qc.smk",
                content="rule fastqc:\n    shell: 'fastqc {input}'\n",
                sha256="rule",
                size=40,
                lines=2,
                language="python",
            ),
            CatalogFile(
                catalog_id=catalog.id,
                path=".env",
                content="TOKEN=super-secret\n",
                sha256="env",
                size=19,
                lines=1,
                language="dotenv",
            ),
        ]
    )
    await db.commit()

    list_response = await client.get(
        "/api/v1/mcp-tools/catalogs",
        params={"search": "RNA"},
        headers=headers,
    )
    assert list_response.status_code == 200
    catalogs = list_response.json()["catalogs"]
    assert catalogs[0]["slug"] == "rna-demo"
    assert catalogs[0]["has_snakefile"] is True

    overview_response = await client.get(
        f"/api/v1/mcp-tools/catalogs/{catalog.id}/overview",
        headers=headers,
    )
    assert overview_response.status_code == 200
    overview = overview_response.json()
    assert overview["catalog"]["workspace_status"] == "missing"
    assert overview["catalog"]["file_count"] == 3
    assert overview["files_total"] == 6

    read_response = await client.get(
        f"/api/v1/mcp-tools/catalogs/{catalog.id}/files/workflow/Snakefile",
        headers=headers,
    )
    assert read_response.status_code == 200
    assert "rule all" in read_response.json()["content"]

    sensitive_response = await client.get(
        f"/api/v1/mcp-tools/catalogs/{catalog.id}/files/.env",
        headers=headers,
    )
    assert sensitive_response.status_code == 403

    search_response = await client.get(
        f"/api/v1/mcp-tools/catalogs/{catalog.id}/search",
        params={"query": "fastqc"},
        headers=headers,
    )
    assert search_response.status_code == 200
    matches = search_response.json()["matches"]
    assert matches[0]["path"] == "rules/qc.smk"
    assert matches[0]["matches"][0]["line"] == 1

    summary_response = await client.get(
        f"/api/v1/mcp-tools/catalogs/{catalog.id}/summary",
        headers=headers,
    )
    assert summary_response.status_code == 200
    summary = summary_response.json()
    assert summary["entrypoints"] == ["workflow/Snakefile"]
    assert "config/config.yaml" in summary["configs"]
    assert summary["sensitive_files_omitted"] == 1


@pytest.mark.asyncio
async def test_mcp_materialize_catalog_workspace(
    client: AsyncClient,
    db,
    register_user,
    login_user,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setattr(
        "app.core.config.settings.CATALOG_DIR", str(tmp_path / "catalog")
    )
    monkeypatch.setattr("app.core.config.settings.FLOWO_WORKING_PATH", str(tmp_path))
    headers, user = await _headers_and_user(
        register_user, login_user, db, "mcp-materialize@example.com"
    )
    catalog = Catalog(
        id=uuid.uuid4(),
        slug="materialize-demo",
        name="Materialize Demo",
        owner_id=user.id,
        owner=user.email,
    )
    db.add_all(
        [
            catalog,
            CatalogFile(
                catalog_id=catalog.id,
                path="workflow/Snakefile",
                content="rule all:\n    input: []\n",
                sha256="snake",
                size=23,
                lines=2,
                language="python",
            ),
        ]
    )
    await db.commit()

    response = await client.post(
        f"/api/v1/mcp-tools/catalogs/{catalog.id}/materialize",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["workspace_ready"] is True
    assert body["workspace_status"] == "fresh"
    assert body["file_count"] == 1
    snakefile_path = (
        tmp_path
        / "catalog"
        / str(user.id)
        / "materialize-demo"
        / "workflow"
        / "Snakefile"
    )
    assert snakefile_path.is_file()


@pytest.mark.asyncio
async def test_mcp_catalog_tools_scope_private_catalogs(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    owner_headers, owner = await _headers_and_user(
        register_user, login_user, db, "mcp-owner@example.com"
    )
    other_headers, _other = await _headers_and_user(
        register_user, login_user, db, "mcp-other@example.com"
    )
    catalog = Catalog(
        id=uuid.uuid4(),
        slug="private-demo",
        name="Private Demo",
        owner_id=owner.id,
        owner=owner.email,
        is_public=False,
    )
    db.add(catalog)
    await db.commit()

    owner_response = await client.get(
        f"/api/v1/mcp-tools/catalogs/{catalog.id}/overview",
        headers=owner_headers,
    )
    other_response = await client.get(
        f"/api/v1/mcp-tools/catalogs/{catalog.id}/overview",
        headers=other_headers,
    )
    unauthenticated_response = await client.get(
        f"/api/v1/mcp-tools/catalogs/{catalog.id}/overview",
    )

    assert owner_response.status_code == 200
    assert other_response.status_code == 403
    assert unauthenticated_response.status_code in {401, 403}


@pytest.mark.asyncio
async def test_mcp_list_catalog_workflows(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    headers, user = await _headers_and_user(
        register_user, login_user, db, "mcp-catalog-workflow@example.com"
    )
    catalog = Catalog(
        id=uuid.uuid4(),
        slug="workflow-demo",
        name="Workflow Demo",
        owner_id=user.id,
        owner=user.email,
    )
    workflow = Workflow(
        id=uuid.uuid4(),
        name="workflow demo run",
        status=Status.ERROR,
        dryrun=False,
        started_at=datetime.now(UTC),
        user_id=user.id,
        user=user.email,
        catalog_id=catalog.id,
        run_info={"total": 2},
    )
    db.add_all([catalog, workflow])
    await db.commit()

    response = await client.get(
        f"/api/v1/mcp-tools/catalogs/{catalog.id}/workflows",
        params={"status": "ERROR"},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total_matches"] == 1
    assert body["workflows"][0]["id"] == str(workflow.id)
    assert body["workflows"][0]["status"] == "ERROR"
