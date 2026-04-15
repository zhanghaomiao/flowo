import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.services.catalog.utils import (
    _detect_language,
    _get_catalog_dir,
    _get_file_inventory,
    _is_git_configured,
    _read_metadata,
    _slugify,
    _validate_path,
    _write_metadata,
)


def test_slugify():
    assert _slugify("Hello World") == "hello-world"
    assert _slugify("Test_Project-123") == "test-project-123"
    assert _slugify("  Spaces   And-Dashes_") == "spaces-and-dashes"
    assert _slugify("!@#Invalid%$^Characters&*()") == "invalidcharacters"


def test_get_catalog_dir(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.catalog.utils.settings.CATALOG_DIR", str(tmp_path / "catalog"))
    catalog_dir = _get_catalog_dir()
    assert catalog_dir.exists()
    assert catalog_dir.name == "catalog"


def test_read_and_write_metadata(tmp_path):
    catalog_path = tmp_path / "test_catalog"
    catalog_path.mkdir()

    assert _read_metadata(catalog_path) == {}

    metadata = {"key": "value"}
    _write_metadata(catalog_path, metadata)

    read_back = _read_metadata(catalog_path)
    assert read_back["key"] == "value"
    assert "updated_at" in read_back


def test_get_file_inventory(tmp_path):
    catalog_path = tmp_path / "inventory_test"
    catalog_path.mkdir()

    # Hidden file
    (catalog_path / ".hidden").write_text("hidden")
    # Metadata file
    (catalog_path / ".flowo.json").write_text("{}")

    # Subdir
    subdir = catalog_path / "src"
    subdir.mkdir()

    # Files
    (subdir / "script.py").write_text('var = "hello"\nprint(var)\n')
    (catalog_path / "Snakefile").write_text('rule all:\n  input: []\n')

    inventory = _get_file_inventory(catalog_path)

    assert len(inventory) == 3 # src, src/script.py, Snakefile

    dirs = [item for item in inventory if item["is_dir"]]
    files = [item for item in inventory if not item["is_dir"]]

    assert len(dirs) == 1
    assert dirs[0]["name"] == "src"
    assert dirs[0]["path"] == "src"

    assert len(files) == 2

    script_file = next(f for f in files if f["name"] == "script.py")
    assert script_file["language"] == "python"
    assert script_file["lines"] == 3

    snakefile = next(f for f in files if f["name"] == "Snakefile")
    assert snakefile["language"] == "python"
    assert snakefile["lines"] == 3


def test_detect_language():
    assert _detect_language("Snakefile") == "python"
    assert _detect_language("script.py") == "python"
    assert _detect_language("data.yaml") == "yaml"
    assert _detect_language("README.md") == "markdown"
    assert _detect_language("unknown.ext") == "plaintext"


def test_validate_path_valid(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.catalog.utils._get_catalog_dir", lambda: tmp_path)
    (tmp_path / "test_slug").mkdir()

    valid_path = _validate_path("test_slug", "src/script.py")
    assert valid_path == (tmp_path / "test_slug" / "src" / "script.py").resolve()

    root_path = _validate_path("test_slug", "")
    assert root_path == (tmp_path / "test_slug").resolve()


def test_validate_path_invalid_traversal(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.catalog.utils._get_catalog_dir", lambda: tmp_path)
    (tmp_path / "test_slug").mkdir()

    with pytest.raises(HTTPException) as excinfo:
        _validate_path("test_slug", "../other_dir/file.txt")

    assert excinfo.value.status_code == 400


@pytest.mark.asyncio
async def test_is_git_configured_global(monkeypatch):
    monkeypatch.setattr("app.services.catalog.utils.settings.CATALOG_GIT_REMOTE", "git@github.com:test/repo.git")
    assert await _is_git_configured(AsyncMock(), None) is True


@pytest.mark.asyncio
async def test_is_git_configured_user(monkeypatch):
    monkeypatch.setattr("app.services.catalog.utils.settings.CATALOG_GIT_REMOTE", None)

    mock_session = AsyncMock()
    mock_result = MagicMock()

    class MockUserSettings:
        git_remote_url = "git@github.com:user/repo.git"

    mock_result.scalar_one_or_none.return_value = MockUserSettings()
    mock_session.execute.return_value = mock_result

    assert await _is_git_configured(mock_session, uuid.uuid4()) is True


@pytest.mark.asyncio
async def test_is_git_not_configured(monkeypatch):
    monkeypatch.setattr("app.services.catalog.utils.settings.CATALOG_GIT_REMOTE", None)

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result

    assert await _is_git_configured(mock_session, uuid.uuid4()) is False
