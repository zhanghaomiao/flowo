import hashlib
import io
import json
import tarfile

import pytest
from httpx import AsyncClient


def _build_catalog_archive(*, slug: str, name: str, description: str) -> bytes:
    payload = io.BytesIO()
    with tarfile.open(fileobj=payload, mode="w:gz") as tar:
        meta = {
            "slug": slug,
            "name": name,
            "description": description,
            "tags": ["test"],
        }
        meta_bytes = json.dumps(meta).encode("utf-8")
        meta_info = tarfile.TarInfo(name=f"{slug}/.flowo.json")
        meta_info.size = len(meta_bytes)
        tar.addfile(meta_info, io.BytesIO(meta_bytes))

        snakefile_bytes = b"rule all:\n    input: []\n"
        snakefile_info = tarfile.TarInfo(name=f"{slug}/workflow/Snakefile")
        snakefile_info.size = len(snakefile_bytes)
        tar.addfile(snakefile_info, io.BytesIO(snakefile_bytes))
    payload.seek(0)
    return payload.read()


@pytest.mark.asyncio
async def test_upload_list_get_update_and_delete_catalog(
    client: AsyncClient, superuser_token_headers: dict, monkeypatch, tmp_path
):
    monkeypatch.setattr(
        "app.core.config.settings.CATALOG_DIR", str(tmp_path / "catalog")
    )
    monkeypatch.setattr("app.core.config.settings.FLOWO_WORKING_PATH", str(tmp_path))

    archive_bytes = _build_catalog_archive(
        slug="test-catalog",
        name="Test Catalog",
        description="A testing catalog",
    )

    create_resp = await client.post(
        "/api/v1/catalog/upload",
        headers=superuser_token_headers,
        files={
            "file": (
                "test-catalog.tar.gz",
                io.BytesIO(archive_bytes),
                "application/gzip",
            )
        },
    )
    assert create_resp.status_code == 201

    body = create_resp.json()
    slug = body["slug"]
    assert slug == "test-catalog"
    assert body["workspace_ready"] is True
    assert body["workspace_status"] == "fresh"
    assert body["has_snakefile"] is True

    list_resp = await client.get("/api/v1/catalog", headers=superuser_token_headers)
    assert list_resp.status_code == 200
    rows = list_resp.json()
    hit = next((c for c in rows if c["slug"] == slug), None)
    assert hit is not None
    assert hit["workspace_ready"] is True
    assert hit["workspace_status"] == "fresh"
    assert hit["has_snakefile"] is True

    get_resp = await client.get(
        f"/api/v1/catalog/{slug}", headers=superuser_token_headers
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Test Catalog"

    update_resp = await client.patch(
        f"/api/v1/catalog/{slug}",
        json={"description": "Updated description"},
        headers=superuser_token_headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["description"] == "Updated description"

    read_resp = await client.get(
        f"/api/v1/catalog/{slug}/files/workflow/Snakefile",
        headers=superuser_token_headers,
    )
    assert read_resp.status_code == 200
    assert "rule all" in read_resp.json()["content"]

    updated_snakefile = "rule all:\n    input: ['done.txt']\n"
    snakefile_bytes = updated_snakefile.encode("utf-8")
    batch_resp = await client.post(
        f"/api/v1/catalog/{slug}/batch-import",
        json={
            "mode": "merge",
            "files": [
                {
                    "path": "workflow/Snakefile",
                    "content": updated_snakefile,
                    "sha256": hashlib.sha256(snakefile_bytes).hexdigest(),
                    "size": len(snakefile_bytes),
                    "lines": updated_snakefile.count("\n") + 1,
                }
            ],
            "delete_paths": [],
        },
        headers=superuser_token_headers,
    )
    assert batch_resp.status_code == 200

    read_resp = await client.get(
        f"/api/v1/catalog/{slug}/files/workflow/Snakefile",
        headers=superuser_token_headers,
    )
    assert read_resp.status_code == 200
    assert read_resp.json()["content"] == updated_snakefile

    del_resp = await client.delete(
        f"/api/v1/catalog/{slug}", headers=superuser_token_headers
    )
    assert del_resp.status_code == 200
