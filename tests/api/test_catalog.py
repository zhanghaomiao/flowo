import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_and_list_catalogs(client: AsyncClient, superuser_token_headers: dict, db, monkeypatch, tmp_path):
    monkeypatch.setattr("app.core.config.settings.CATALOG_DIR", str(tmp_path / "catalog"))
    # Also patch workflow path just in case
    monkeypatch.setattr("app.core.config.settings.FLOWO_WORKING_PATH", str(tmp_path))
    # 1. Create a catalog via API
    create_req = {
        "name": "Test Catalog",
        "description": "A testing catalog",
        "tags": ["test"]
    }
    create_resp = await client.post("/api/v1/catalog", json=create_req, headers=superuser_token_headers)
    assert create_resp.status_code == 201

    slug = create_resp.json()["slug"]
    assert slug == "test-catalog"

    # 2. List catalogs
    list_resp = await client.get("/api/v1/catalog", headers=superuser_token_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1
    assert any(c["slug"] == slug for c in list_resp.json())

    # 3. Get catalog
    get_resp = await client.get(f"/api/v1/catalog/{slug}", headers=superuser_token_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Test Catalog"

    # 4. Update catalog
    update_req = {"description": "Updated description"}
    update_resp = await client.patch(f"/api/v1/catalog/{slug}", json=update_req, headers=superuser_token_headers)
    assert update_resp.status_code == 200
    assert update_resp.json()["description"] == "Updated description"

    # 5. Write a file
    file_req = {"content": "rule all: pass"}
    write_resp = await client.put(f"/api/v1/catalog/{slug}/files/Snakefile", json=file_req, headers=superuser_token_headers)
    assert write_resp.status_code == 200

    # 6. Read a file
    read_resp = await client.get(f"/api/v1/catalog/{slug}/files/Snakefile", headers=superuser_token_headers)
    assert read_resp.status_code == 200
    assert read_resp.json()["content"] == "rule all: pass"

    # 7. Create directory
    dir_resp = await client.post(f"/api/v1/catalog/{slug}/dirs/test_dir", headers=superuser_token_headers)
    assert dir_resp.status_code == 200

    # 8. Delete directory
    del_dir_resp = await client.delete(f"/api/v1/catalog/{slug}/dirs/test_dir", headers=superuser_token_headers)
    assert del_dir_resp.status_code == 200

    # 9. Rename
    await client.put(f"/api/v1/catalog/{slug}/files/test.txt", json={"content": "hello"}, headers=superuser_token_headers)
    rename_resp = await client.post(f"/api/v1/catalog/{slug}/rename", json={"old_path": "test.txt", "new_path": "test2.txt"}, headers=superuser_token_headers)
    assert rename_resp.status_code == 200

    # 10. Delete file
    del_file_resp = await client.delete(f"/api/v1/catalog/{slug}/files/test2.txt", headers=superuser_token_headers)
    assert del_file_resp.status_code == 200

    # 11. Delete catalog
    del_resp = await client.delete(f"/api/v1/catalog/{slug}", headers=superuser_token_headers)
    assert del_resp.status_code == 200
