"""Catalog user-uploaded DAG preview (DB-only; excluded from archive .flowo.json)."""

import io
import json
import tarfile

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models import Catalog, User

# Minimal valid 1x1 PNG
PNG_1X1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c6360000002000154431b76260000000049454e44ae426082"
)


@pytest.mark.asyncio
async def test_dag_preview_upload_get_delete(
    client: AsyncClient, superuser_token_headers: dict, db
):
    res = await db.execute(select(User).where(User.email == "admin@example.com"))
    user = res.scalar_one()
    cat = Catalog(slug="dag-prev-api", name="Dag Prev", owner_id=user.id)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    cid = str(cat.id)

    r = await client.get(
        f"/api/v1/catalog/{cid}/dag/preview", headers=superuser_token_headers
    )
    assert r.status_code == 404

    files = {"file": ("x.png", io.BytesIO(PNG_1X1), "image/png")}
    r = await client.post(
        f"/api/v1/catalog/{cid}/dag/preview",
        headers=superuser_token_headers,
        files=files,
    )
    assert r.status_code == 204

    r = await client.get(
        f"/api/v1/catalog/{cid}/dag/preview", headers=superuser_token_headers
    )
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/png")
    assert r.content == PNG_1X1

    r = await client.delete(
        f"/api/v1/catalog/{cid}/dag/preview", headers=superuser_token_headers
    )
    assert r.status_code == 204

    r = await client.get(
        f"/api/v1/catalog/{cid}/dag/preview", headers=superuser_token_headers
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_list_catalog_includes_has_dag_preview_flag(
    client: AsyncClient, superuser_token_headers: dict, db
):
    res = await db.execute(select(User).where(User.email == "admin@example.com"))
    user = res.scalar_one()
    cat = Catalog(
        slug="dag-flag-list",
        name="Flag",
        owner_id=user.id,
        dag_preview_mime="image/png",
        dag_preview_bytes=PNG_1X1,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)

    r = await client.get("/api/v1/catalog", headers=superuser_token_headers)
    assert r.status_code == 200
    rows = r.json()
    hit = next((x for x in rows if x["id"] == str(cat.id)), None)
    assert hit is not None
    assert hit.get("has_dag_preview") is True


@pytest.mark.asyncio
async def test_export_tar_flowo_json_excludes_dag_preview_fields(
    client: AsyncClient, superuser_token_headers: dict, db, monkeypatch, tmp_path
):
    from app.core.config import settings

    root = tmp_path / "catalog"
    monkeypatch.setattr(settings, "CATALOG_DIR", str(root))

    res = await db.execute(select(User).where(User.email == "admin@example.com"))
    user = res.scalar_one()
    slug = "export-dag-meta"
    ws = root / str(user.id) / slug
    (ws / "workflow").mkdir(parents=True)
    (ws / "workflow" / "Snakefile").write_text(
        "rule all:\n    input: []\n", encoding="utf-8"
    )

    cat = Catalog(
        slug=slug,
        name="Export Meta",
        owner_id=user.id,
        dag_preview_mime="image/png",
        dag_preview_bytes=PNG_1X1,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    cid = str(cat.id)

    r = await client.get(
        f"/api/v1/catalog/{cid}/download",
        headers=superuser_token_headers,
        params={"format": "tar.gz"},
    )
    assert r.status_code == 200
    buf = io.BytesIO(r.content)
    with tarfile.open(fileobj=buf, mode="r:gz") as tar:
        meta_name = f"{slug}/.flowo.json"
        names = tar.getnames()
        assert any(n.endswith(".flowo.json") for n in names)
        m = tar.getmember(meta_name)
        f = tar.extractfile(m)
        assert f is not None
        meta = json.loads(f.read().decode("utf-8"))
    assert "dag_preview_bytes" not in meta
    assert "dag_preview_mime" not in meta
    assert meta.get("slug") == slug
