import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models import Catalog, CatalogFile, Status, User, Workflow


async def _viewer_headers(register_user, login_user, db, email: str):
    await register_user(email)
    user = (await db.execute(select(User).where(User.email == email))).scalar_one()
    user.role = "viewer"
    await db.commit()
    return await login_user(email), user


@pytest.mark.asyncio
async def test_viewer_reads_own_workflows_but_cannot_delete(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    headers, viewer = await _viewer_headers(
        register_user, login_user, db, "demo-viewer-runs@example.com"
    )
    own_id = uuid.uuid4()
    other_id = uuid.uuid4()
    db.add_all(
        [
            Workflow(
                id=own_id,
                name="Demo run",
                status=Status.SUCCESS,
                dryrun=False,
                started_at=datetime.now(UTC),
                user_id=viewer.id,
                user=viewer.email,
            ),
            Workflow(
                id=other_id,
                name="Private run",
                status=Status.SUCCESS,
                dryrun=False,
                started_at=datetime.now(UTC),
            ),
        ]
    )
    await db.commit()

    list_resp = await client.get("/api/v1/workflows/", headers=headers)
    assert list_resp.status_code == 200
    ids = {row["id"] for row in list_resp.json()["workflows"]}
    assert str(own_id) in ids
    assert str(other_id) not in ids

    detail_resp = await client.get(
        f"/api/v1/workflows/{own_id}/detail", headers=headers
    )
    assert detail_resp.status_code == 200

    delete_resp = await client.delete(f"/api/v1/workflows/{own_id}", headers=headers)
    assert delete_resp.status_code == 403
    assert delete_resp.json()["detail"] == "Demo account is read-only."


@pytest.mark.asyncio
async def test_viewer_reads_public_catalog_but_cannot_modify_or_materialize(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    headers, _viewer = await _viewer_headers(
        register_user, login_user, db, "demo-viewer-catalog@example.com"
    )
    public_catalog = Catalog(
        id=uuid.uuid4(),
        slug="public-demo",
        name="Public Demo",
        description="Public demo catalog",
        is_public=True,
    )
    private_catalog = Catalog(
        id=uuid.uuid4(),
        slug="private-demo",
        name="Private Demo",
        description="Private demo catalog",
        is_public=False,
    )
    db.add_all(
        [
            public_catalog,
            private_catalog,
            CatalogFile(
                catalog_id=public_catalog.id,
                path="workflow/Snakefile",
                content="rule all:\n    input: []\n",
                sha256="public-demo-snakefile",
                size=23,
                lines=2,
                language="python",
            ),
        ]
    )
    await db.commit()

    list_resp = await client.get("/api/v1/catalog", headers=headers)
    assert list_resp.status_code == 200
    slugs = {row["slug"] for row in list_resp.json()}
    assert "public-demo" in slugs
    assert "private-demo" not in slugs

    read_resp = await client.get(
        f"/api/v1/catalog/{public_catalog.id}/files/workflow/Snakefile",
        headers=headers,
    )
    assert read_resp.status_code == 200
    assert "rule all" in read_resp.json()["content"]

    patch_resp = await client.patch(
        f"/api/v1/catalog/{public_catalog.id}",
        json={"description": "changed"},
        headers=headers,
    )
    assert patch_resp.status_code == 403
    assert patch_resp.json()["detail"] == "Demo account is read-only."

    materialize_resp = await client.post(
        f"/api/v1/mcp-tools/catalogs/{public_catalog.id}/materialize",
        headers=headers,
    )
    assert materialize_resp.status_code == 403


@pytest.mark.asyncio
async def test_viewer_cannot_create_token_or_approve_cli_login(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    headers, _viewer = await _viewer_headers(
        register_user, login_user, db, "demo-viewer-token@example.com"
    )

    create_resp = await client.post(
        "/api/v1/tokens/",
        json={"name": "demo token", "ttl_days": 7},
        headers=headers,
    )
    assert create_resp.status_code == 403

    start_resp = await client.post("/api/v1/tokens/cli/start", json={"ttl_days": 7})
    assert start_resp.status_code == 200
    approve_resp = await client.post(
        "/api/v1/tokens/cli/approve",
        json={"device_code": start_resp.json()["device_code"]},
        headers=headers,
    )
    assert approve_resp.status_code == 403
