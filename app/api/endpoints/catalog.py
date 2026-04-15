"""
REST API endpoints for Snakemake workflow catalog management.
"""

import os
import tempfile
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_active_user_with_token
from app.core.session import get_async_session
from app.models.user import User
from app.services.catalog import CatalogService

router = APIRouter()


def get_catalog_svc(
    session: AsyncSession = Depends(get_async_session),
) -> CatalogService:
    return CatalogService(session)


# --- Schemas ---


class CatalogCreateRequest(BaseModel):
    name: str
    description: str = ""
    tags: list[str] = []


class CatalogUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    version: str | None = None
    tags: list[str] | None = None
    is_public: bool | None = None
    source_url: str | None = None


class FileWriteRequest(BaseModel):
    content: str


class RenameRequest(BaseModel):
    old_path: str
    new_path: str


class CatalogFileInfo(BaseModel):
    name: str
    path: str
    is_dir: bool = False
    lines: int
    size: int
    modified: str


class CatalogCategoryInfo(BaseModel):
    dir: str
    required: bool
    extensions: list[str]
    count: int


class CatalogSummary(BaseModel):
    name: str
    slug: str | None = None
    description: str = ""
    version: str = "0.1.0"
    owner: str | None = None
    tags: list[str] = []
    is_public: bool = False
    source_url: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    file_count: int = 0
    has_snakefile: bool = True
    git_configured: bool = False


class CatalogDetail(CatalogSummary):
    files: list[CatalogFileInfo]
    categories: dict[str, Any] = {}
    rulegraph_data: dict[str, Any] | None = None


class CatalogFileContent(BaseModel):
    path: str
    name: str
    content: str
    language: str
    lines: int
    size: int


# --- Catalog CRUD ---


@router.get("", response_model=list[CatalogSummary])
async def list_catalogs(
    search: str | None = Query(None, description="Search by name or description"),
    tags: str | None = Query(None, description="Filter by tags (comma-separated)"),
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """List all workflow catalogs."""
    return await svc.list_catalogs(search=search, tags=tags, user_id=user.id)


@router.post("/sync")
async def sync_catalogs(
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Manual sync of filesystem catalogs with the database."""
    # Note: Potentially restrict this to admins or catalog owners
    return await svc.sync_catalogs()


@router.post("", status_code=201, response_model=CatalogSummary)
async def create_catalog(
    request: CatalogCreateRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Create a new workflow catalog with an empty Snakefile."""
    return await svc.create_catalog(
        name=request.name,
        description=request.description,
        tags=request.tags,
        owner=user.email or str(user.id),
        owner_id=user.id,
        background_tasks=background_tasks,
    )


@router.get("/{slug}", response_model=CatalogDetail)
async def get_catalog(
    slug: str,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Get catalog detail and full file list."""
    return await svc.get_catalog(slug, user_id=user.id)


@router.patch("/{slug}", response_model=CatalogSummary)
async def update_catalog(
    slug: str,
    request: CatalogUpdateRequest,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Update catalog metadata."""
    data = request.model_dump(exclude_none=True)
    return await svc.update_metadata(slug, data, user_id=user.id)


@router.delete("/{slug}")
async def delete_catalog(
    slug: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Delete a catalog and all its files."""
    await svc.delete_catalog(slug, user_id=user.id, background_tasks=background_tasks)
    return {"message": f"Catalog '{slug}' deleted"}


# --- File operations ---


@router.get("/{slug}/files/{file_path:path}", response_model=CatalogFileContent)
async def read_file(
    slug: str,
    file_path: str,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Read a file from a catalog."""
    return await svc.read_file(slug, file_path)


@router.put("/{slug}/files/{file_path:path}", response_model=CatalogFileContent)
async def write_file(
    slug: str,
    file_path: str,
    request: FileWriteRequest,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Create or update a file in a catalog."""
    return await svc.write_file(slug, file_path, request.content)


@router.delete("/{slug}/files/{file_path:path}")
async def delete_file(
    slug: str,
    file_path: str,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Delete a file from a catalog."""
    await svc.delete_file(slug, file_path)
    return {"message": f"File '{file_path}' deleted"}


@router.post("/{slug}/dirs/{directory_path:path}")
async def create_directory(
    slug: str,
    directory_path: str,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Create a new directory in the catalog."""
    return await svc.create_directory(slug, directory_path)


@router.delete("/{slug}/dirs/{directory_path:path}")
async def delete_directory(
    slug: str,
    directory_path: str,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Delete a directory and all its contents."""
    await svc.delete_directory(slug, directory_path)
    return {"message": f"Directory '{directory_path}' deleted"}


@router.post("/{slug}/rename")
async def rename_path(
    slug: str,
    request: RenameRequest,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Rename a file or directory in the catalog."""
    return await svc.rename_path(slug, request.old_path, request.new_path)


# --- Export / Import ---


@router.get("/{slug}/download")
async def download_catalog(
    slug: str,
    format: str = "tar.gz",
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Download a catalog as a compressed archive (zip or tar.gz)."""
    if format == "zip":
        zip_path = await svc.download_catalog(slug)
        return FileResponse(
            zip_path, media_type="application/zip", filename=f"{slug}.zip"
        )
    else:
        # Default to tar.gz (export)
        buffer = await svc.export_archive(slug)
        return StreamingResponse(
            buffer,
            media_type="application/gzip",
            headers={"Content-Disposition": f"attachment; filename={slug}.tar.gz"},
        )


@router.post("/upload", status_code=201, response_model=CatalogSummary)
async def upload_catalog(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Upload a .tar.gz archive as a new catalog."""
    return await svc.import_archive(
        file,
        owner=user.email or str(user.id),
        owner_id=user.id,
        background_tasks=background_tasks,
    )


@router.get("/{slug}/export")
async def export_catalog(
    slug: str,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Alias for download_catalog with tar.gz format."""
    return await download_catalog(slug, format="tar.gz", user=user, svc=svc)


@router.post("/{slug}/sync")
async def sync_catalog_zip(
    slug: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Sync a catalog from a .zip archive provided by CLI."""
    # Save uploaded file to a temporary location
    with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        return await svc.sync_catalog(
            slug, tmp_path, user, background_tasks=background_tasks
        )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# --- DAG preview ---


@router.get("/{slug}/dag")
async def get_catalog_dag(
    slug: str,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Generate DAG preview from the catalog's Snakefile."""
    return await svc.generate_dag(slug)


class GitPushRequest(BaseModel):
    remote_url: str | None = None
    token: str | None = None


class ImportFromGitRequest(BaseModel):
    git_url: str
    token: str | None = None


# --- Git sync ---


@router.post("/git/push")
async def git_push(
    request: GitPushRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(current_active_user_with_token),
    session: AsyncSession = Depends(get_async_session),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Push all catalogs to a Git remote (monorepo).

    Accepts an optional remote_url override and access token.
    If not provided, uses the saved settings for the current user.
    """
    from .settings import get_or_create_user_settings

    settings = await get_or_create_user_settings(user, session)
    remote_url = request.remote_url or settings.git_remote_url
    token = request.token or settings.git_token

    return await svc.git_push(
        user_id=user.id,
        background_tasks=background_tasks,
        remote_url=remote_url,
        token=token,
    )


@router.post("/git/pull")
async def git_pull(
    background_tasks: BackgroundTasks,
    user: User = Depends(current_active_user_with_token),
    session: AsyncSession = Depends(get_async_session),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Pull catalogs from the user's configured Git remote."""
    from .settings import get_or_create_user_settings

    settings = await get_or_create_user_settings(user, session)
    return await svc.git_pull(
        user_id=user.id,
        background_tasks=background_tasks,
        remote_url=settings.git_remote_url,
        token=settings.git_token,
    )


@router.post("/import/git", status_code=201)
async def import_from_git(
    request: ImportFromGitRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(current_active_user_with_token),
    session: AsyncSession = Depends(get_async_session),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Clone a Git repository and import all catalogs found inside."""
    from .settings import get_or_create_user_settings

    settings = await get_or_create_user_settings(user, session)
    token = request.token or settings.git_token

    return await svc.import_from_git(
        git_url=request.git_url,
        user_id=user.id,
        background_tasks=background_tasks,
        token=token,
        owner=user.email or str(user.id),
    )
