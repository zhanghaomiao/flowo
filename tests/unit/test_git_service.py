import subprocess
from unittest.mock import MagicMock, patch

import pytest

from app.services.third_party.git import GitService


@pytest.fixture
def git_service():
    return GitService()


def test_prepare_url_inserts_token_correctly(git_service, monkeypatch):
    monkeypatch.setattr("app.services.third_party.git.settings.CATALOG_GIT_TOKEN", "default_token")

    # Custom token takes precedence
    assert git_service._prepare_url("https://github.com/repo.git", "my_token") == "https://my_token@github.com/repo.git"

    # Fallback to default token
    assert git_service._prepare_url("https://github.com/repo.git") == "https://default_token@github.com/repo.git"

    # Do not inject if already has auth
    assert git_service._prepare_url("https://user:pass@github.com/repo.git", "token") == "https://user:pass@github.com/repo.git"

    # Do not inject for ssh
    assert git_service._prepare_url("git@github.com:repo.git", "token") == "git@github.com:repo.git"


def test_test_connection_success(git_service):
    with patch("subprocess.run") as mock_run:
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_run.return_value = mock_result

        success, msg = git_service.test_connection("https://github.com/repo.git", "token")

        assert success is True
        assert "successful" in msg
        mock_run.assert_called_once()
        args = mock_run.call_args[0][0]
        assert "ls-remote" in args


def test_test_connection_auth_failure(git_service):
    with patch("subprocess.run") as mock_run:
        mock_result = MagicMock()
        mock_result.returncode = 128
        mock_result.stderr = "fatal: Authentication failed for 'https://github.com/repo.git'"
        mock_run.return_value = mock_result

        success, msg = git_service.test_connection("https://github.com/repo.git", "token")

        assert success is False
        assert "Authentication failed" in msg


def test_test_connection_timeout(git_service):
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd=["git"], timeout=15)):
        success, msg = git_service.test_connection("https://github.com/repo.git", "token")

        assert success is False
        assert "timed out" in msg


def test_init_repository_success(git_service, tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.third_party.git.settings.CATALOG_GIT_REMOTE", "https://github.com/repo.git")
    monkeypatch.setattr("app.services.third_party.git.settings.CATALOG_GIT_TOKEN", "token")

    with patch.object(git_service, "_run_git") as mock_run_git:
        git_service.init_repository(tmp_path, branch="develop")

        assert mock_run_git.call_count >= 5  # init, remote add, config email, config name, checkout

        calls = [call.args[0] for call in mock_run_git.mock_calls]
        assert ["init"] in calls
        assert ["remote", "add", "origin", "https://token@github.com/repo.git"] in calls
        assert ["config", "user.email", "flowo@iregene.com"] in calls
        assert ["config", "user.name", "FlowO Bot"] in calls
        assert ["checkout", "develop"] in calls

        assert (tmp_path / ".gitignore").exists()
        assert "__pycache__/" in (tmp_path / ".gitignore").read_text()


def test_push_to_monorepo(git_service, tmp_path):
    # Setup mock
    with patch.object(git_service, "init_repository") as mock_init, \
         patch.object(git_service, "_run_git") as mock_run_git:

        # Make _run_git return a status indicating changes
        def side_effect(args, cwd=None):
            result = MagicMock()
            if args[0] == "status":
                result.stdout = " M file.txt"
            return result
        mock_run_git.side_effect = side_effect

        git_service.push_to_monorepo(tmp_path, "https://github.com", "token", "main", "my commit")

        mock_init.assert_called_once()

        calls = [call.args[0] for call in mock_run_git.mock_calls]
        assert ["add", "-A"] in calls
        assert ["status", "--porcelain"] in calls
        assert ["commit", "-m", "my commit"] in calls
        assert ["push", "origin", "main"] in calls


def test_import_catalogs_from_own_monorepo(git_service, tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.third_party.git.settings.CATALOG_GIT_REMOTE", "https://github.com/repo.git")

    with patch.object(git_service, "init_repository"), \
         patch.object(git_service, "_run_git") as mock_run_git, \
         patch.object(git_service, "_scan_catalogs", return_value=["catalog1", "catalog2"]) as mock_scan:

        # When remote_url is the same as the global one
        slugs = git_service.import_catalogs(tmp_path, remote_url=None)

        calls = [call.args[0] for call in mock_run_git.mock_calls]
        assert ["fetch", "origin"] in calls
        assert ["reset", "--hard", "origin/main"] in calls

        assert slugs == ["catalog1", "catalog2"]
        mock_scan.assert_called_once_with(tmp_path)
