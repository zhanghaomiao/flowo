import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models import Status, Workflow
from app.models.user import User
from app.utils.paths import PathContent


async def create_user_and_headers(register_user, login_user, email: str, *, is_superuser: bool = False):
    await register_user(email, is_superuser=is_superuser)
    return await login_user(email)


@pytest.mark.asyncio
async def test_files_list_returns_sorted_nodes_and_skips_hidden_files(
    client: AsyncClient,
    db,
    register_user,
    login_user,
    monkeypatch,
    tmp_path,
):
    headers = await create_user_and_headers(
        register_user, login_user, "files-owner@example.com"
    )
    owner = (
        await db.execute(select(User).where(User.email == "files-owner@example.com"))
    ).scalar_one()

    (tmp_path / "configs").mkdir()
    (tmp_path / ".secret").write_text("skip")
    (tmp_path / "logs.txt").write_text("hello")

    workflow = Workflow(
        id=uuid.uuid4(),
        name="Files Workflow",
        status=Status.SUCCESS,
        dryrun=False,
        directory=str(tmp_path),
        user_id=owner.id,
    )
    db.add(workflow)
    await db.commit()

    monkeypatch.setattr(
        "app.services.workflow.path_resolver.resolve",
        lambda _path: Path(tmp_path),
    )

    response = await client.get(
        f"/api/v1/files/list?workflow_id={workflow.id}",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() == [
        {
            "title": "configs",
            "key": ".//configs",
            "isLeaf": False,
            "fileSize": None,
            "icon": "folder",
            "url": None,
        },
        {
            "title": "logs.txt",
            "key": ".//logs.txt",
            "isLeaf": True,
            "fileSize": 5,
            "icon": "file",
            "url": f"{tmp_path}/logs.txt",
        },
    ]


@pytest.mark.asyncio
async def test_files_list_rejects_non_owner(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    owner_headers = await create_user_and_headers(
        register_user, login_user, "wf-owner@example.com"
    )
    _ = owner_headers
    other_headers = await create_user_and_headers(
        register_user, login_user, "wf-other@example.com"
    )
    owner = (
        await db.execute(select(User).where(User.email == "wf-owner@example.com"))
    ).scalar_one()

    workflow = Workflow(
        id=uuid.uuid4(),
        name="Private Workflow",
        status=Status.RUNNING,
        dryrun=False,
        directory="/tmp/private",
        user_id=owner.id,
    )
    db.add(workflow)
    await db.commit()

    response = await client.get(
        f"/api/v1/files/list?workflow_id={workflow.id}",
        headers=other_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Workflow not found"


@pytest.mark.asyncio
async def test_files_list_maps_permission_error_to_403(
    client: AsyncClient,
    db,
    register_user,
    login_user,
    monkeypatch,
):
    headers = await create_user_and_headers(
        register_user, login_user, "files-perm@example.com"
    )
    owner = (
        await db.execute(select(User).where(User.email == "files-perm@example.com"))
    ).scalar_one()

    workflow = Workflow(
        id=uuid.uuid4(),
        name="Restricted Workflow",
        status=Status.RUNNING,
        dryrun=False,
        directory="/tmp/restricted",
        user_id=owner.id,
    )
    db.add(workflow)
    await db.commit()

    monkeypatch.setattr(
        "app.services.workflow.path_resolver.resolve",
        lambda _path: Path("/tmp/restricted"),
    )

    fake_os = type(
        "FakeOS",
        (),
        {"scandir": staticmethod(lambda _path: (_ for _ in ()).throw(PermissionError("denied")))},
    )()

    with patch("app.api.endpoints.files.os", fake_os):
        response = await client.get(
            f"/api/v1/files/list?workflow_id={workflow.id}",
            headers=headers,
        )

    assert response.status_code == 403
    assert response.json()["detail"] == "Permission denied"


@pytest.mark.asyncio
async def test_file_read_maps_expected_exceptions(
    client: AsyncClient,
    superuser_token_headers: dict,
):
    cases = [
        (FileNotFoundError("missing"), 404, "File does not exist"),
        (IsADirectoryError("dir"), 400, "Target is a directory"),
        (ValueError("forbidden"), 403, "Access to this path is forbidden"),
        (RuntimeError("boom"), 500, "Internal Server Error: boom"),
    ]

    for exc, status_code, detail in cases:
        with patch("app.api.endpoints.files.get_file_content", side_effect=exc):
            response = await client.get(
                "/api/v1/files/files/tmp/test.txt",
                headers=superuser_token_headers,
            )

        assert response.status_code == status_code
        assert response.json()["detail"] == detail


@pytest.mark.asyncio
async def test_workflow_progress_returns_total_or_percentage(
    client: AsyncClient,
    db,
    superuser_token_headers: dict,
):
    workflow = Workflow(
        id=uuid.uuid4(),
        name="Progress Workflow",
        status=Status.RUNNING,
        dryrun=False,
    )
    db.add(workflow)
    await db.commit()

    with patch(
        "app.api.endpoints.workflows.WorkflowService.get_progress",
        new=AsyncMock(return_value={"total": 10, "completed": 4, "running": 1}),
    ):
        total_response = await client.get(
            f"/api/v1/workflows/{workflow.id}/progress?return_total_jobs_number=true",
            headers=superuser_token_headers,
        )
        percentage_response = await client.get(
            f"/api/v1/workflows/{workflow.id}/progress",
            headers=superuser_token_headers,
        )

    assert total_response.status_code == 200
    assert total_response.json() == {"total": 10}
    assert percentage_response.status_code == 200
    assert percentage_response.json() == {"completed": 4, "running": 1, "progress": 40.0}


@pytest.mark.asyncio
async def test_workflow_detail_rejects_non_owner(
    client: AsyncClient,
    db,
    register_user,
    login_user,
):
    await create_user_and_headers(register_user, login_user, "detail-owner@example.com")
    other_headers = await create_user_and_headers(
        register_user, login_user, "detail-other@example.com"
    )
    owner = (
        await db.execute(select(User).where(User.email == "detail-owner@example.com"))
    ).scalar_one()

    workflow = Workflow(
        id=uuid.uuid4(),
        name="Owner Only Workflow",
        status=Status.RUNNING,
        dryrun=False,
        user_id=owner.id,
    )
    db.add(workflow)
    await db.commit()

    response = await client.get(
        f"/api/v1/workflows/{workflow.id}/detail",
        headers=other_headers,
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_workflow_rolls_back_when_job_delete_fails(
    client: AsyncClient,
    db,
    superuser_token_headers: dict,
    monkeypatch,
):
    workflow = Workflow(
        id=uuid.uuid4(),
        name="Broken Delete Workflow",
        status=Status.ERROR,
        dryrun=False,
    )
    db.add(workflow)
    await db.commit()

    rollback = AsyncMock()
    monkeypatch.setattr(db, "rollback", rollback)

    with patch(
        "app.api.endpoints.workflows.JobService.delete_jobs",
        new=AsyncMock(side_effect=RuntimeError("cannot delete jobs")),
    ):
        response = await client.delete(
            f"/api/v1/workflows/{workflow.id}",
            headers=superuser_token_headers,
        )

    assert response.status_code == 500
    assert response.json()["detail"] == "Failed to delete workflow: cannot delete jobs"
    rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_file_read_returns_content_when_resolved(
    client: AsyncClient,
    superuser_token_headers: dict,
):
    with patch(
        "app.api.endpoints.files.get_file_content",
        return_value=PathContent(path="/tmp/out.txt", content="hello"),
    ):
        response = await client.get(
            "/api/v1/files/files/tmp/out.txt",
            headers=superuser_token_headers,
        )

    assert response.status_code == 200
    assert response.json()["content"] == "hello"
