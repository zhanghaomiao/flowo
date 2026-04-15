from pathlib import Path

import pytest

from app.utils.paths import PathContent, PathResolver, get_file_content


@pytest.fixture
def path_resolver(monkeypatch):
    """Fixture for creating a PathResolver with mocked settings."""
    # Settings are imported in the module. We should patch them.
    monkeypatch.setattr("app.core.config.settings.FLOWO_WORKING_PATH", "/src/root")
    monkeypatch.setattr("app.core.config.settings.CONTAINER_MOUNT_PATH", "/app/current")
    # Need to reload or just instantiate since it reads from settings, but
    # path_resolver has already been instantiated in paths.py. We will create a new instance.
    return PathResolver()


def test_resolve_empty_path(path_resolver):
    with pytest.raises(ValueError, match="Path cannot be empty"):
        path_resolver.resolve("")


def test_resolve_relative_path(path_resolver):
    # db_path_str is relative
    resolved = path_resolver.resolve("my_folder/my_file.txt")
    assert str(resolved) == "/app/current/my_folder/my_file.txt"


def test_resolve_absolute_path_within_root(path_resolver, monkeypatch):
    # Resolve typically calls .resolve() which accesses filesystem for real path,
    # so we mock resolving the base path and original path
    monkeypatch.setattr(Path, "resolve", lambda self: self)

    # db_path_str is absolute and inside source_root
    resolved = path_resolver.resolve("/src/root/my_folder/my_file.txt")
    assert str(resolved) == "/app/current/my_folder/my_file.txt"


def test_resolve_absolute_path_outside_root(path_resolver, monkeypatch, capsys):
    monkeypatch.setattr(Path, "resolve", lambda self: self)

    # db_path_str is absolute but outside source_root
    resolved = path_resolver.resolve("/other/root/my_folder.txt")

    # It should log warning and return original
    assert str(resolved) == "/other/root/my_folder.txt"
    captured = capsys.readouterr()
    assert "CRITICAL: Path /other/root/my_folder.txt is outside configured source root" in captured.out


def test_resolve_absolute_path_no_source_root(monkeypatch):
    monkeypatch.setattr("app.core.config.settings.FLOWO_WORKING_PATH", None)
    monkeypatch.setattr("app.core.config.settings.CONTAINER_MOUNT_PATH", "/app/current")

    resolver = PathResolver()

    resolved = resolver.resolve("/absolute/path/file.txt")
    assert str(resolved) == "/absolute/path/file.txt"


def test_get_file_content_success(tmp_path, monkeypatch):
    test_file = tmp_path / "test.txt"
    test_file.write_text("hello world", encoding="utf-8")

    # Patch path_resolver.resolve to just return the tmp_path
    monkeypatch.setattr("app.utils.paths.path_resolver.resolve", lambda x: Path(x))

    result = get_file_content(str(test_file))

    assert isinstance(result, PathContent)
    assert result.content == "hello world"
    assert result.path == str(test_file)


def test_get_file_content_not_found(monkeypatch):
    monkeypatch.setattr("app.utils.paths.path_resolver.resolve", lambda x: Path("/non_existent_file.txt"))

    with pytest.raises(FileNotFoundError, match="File not found: "):
        get_file_content("test.txt")


def test_get_file_content_is_directory(tmp_path, monkeypatch):
    monkeypatch.setattr("app.utils.paths.path_resolver.resolve", lambda x: tmp_path)

    with pytest.raises(IsADirectoryError, match="Path is a directory, not a file: "):
        get_file_content("test_dir")
