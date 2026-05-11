"""
REST API endpoints for Snakemake workflow catalog management.
"""

import os
import tempfile
import uuid
from typing import Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_active_user_with_token
from app.core.session import get_async_session
from app.models.user import User
from app.schemas import WorkflowListResponse
from app.services.catalog.service import CatalogService
from app.services.catalog.snake_template_storage import (
    materialize_snake_template_workspace,
    pull_snakemake_workflow_template_async,
    read_template_file_async,
    template_overview_async,
)
from app.services.catalog.utils import (
    _detect_language,
    assert_catalog_readable,
    catalog_data_dir,
)
from app.services.third_party.snakevision import (
    SNAKE_TEMPLATE_DAG_REGISTRY_KEY,
    clear_cached_dag_artifacts,
    clear_dag_artifact_files,
    dag_error_path,
    dag_svg_path,
    end_generation,
    find_snakefile,
    generate_snakevision_svg_for_slug,
    generate_snakevision_svg_for_snake_template,
    is_generation_in_progress,
    snake_template_dag_error_path,
    snake_template_dag_svg_path,
    snake_template_workflow_root,
    try_begin_generation,
)
from app.services.workflow import WorkflowService

router = APIRouter()


def _run_dag_svg_job(job_key: str, owner_id: uuid.UUID | None, disk_slug: str) -> None:
    try:
        generate_snakevision_svg_for_slug(disk_slug, owner_id)
    finally:
        end_generation(job_key)


def _run_dag_svg_job_snake_template() -> None:
    try:
        generate_snakevision_svg_for_snake_template()
    finally:
        end_generation(SNAKE_TEMPLATE_DAG_REGISTRY_KEY)


def get_catalog_svc(
    session: AsyncSession = Depends(get_async_session),
) -> CatalogService:
    return CatalogService(session)


# --- Schemas ---


class CatalogUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    version: str | None = None
    tags: list[str] | None = None
    is_public: bool | None = None
    source_url: str | None = None


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
    id: str
    name: str
    slug: str | None = None
    owner_id: str | None = None
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
    has_dag_preview: bool = False
    workspace_ready: bool = False
    workspace_status: str | None = None
    last_exported_at: str | None = None
    last_export_error: str | None = None
    export_revision: int | None = None


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


class SnakeTemplateFileWriteRequest(BaseModel):
    path: str
    content: str


class SnakeTemplateOverview(BaseModel):
    ready: bool
    path: str
    upstream: str
    files: list[dict[str, Any]]


class SnakeTemplatePullResponse(BaseModel):
    status: str
    action: str
    path: str


# --- Snakemake official workflow template (not a catalog ref; must stay above /{catalog_ref}) ---


@router.get("/snake-template", response_model=SnakeTemplateOverview)
async def get_snake_template_overview(
    user: User = Depends(current_active_user_with_token),  # noqa: ARG001
    session: AsyncSession = Depends(get_async_session),
):
    """Status and file tree for the built-in snakemake-workflow-template checkout."""
    data = await template_overview_async(session)
    return SnakeTemplateOverview(
        ready=data["ready"],
        path=data["path"],
        upstream=data["upstream"],
        files=data["files"],
    )


@router.post("/snake-template/pull", response_model=SnakeTemplatePullResponse)
async def pull_snake_template(
    user: User = Depends(current_active_user_with_token),  # noqa: ARG001
    session: AsyncSession = Depends(get_async_session),
):
    """Clone or git-pull the official template into ``SNAKEMAKE_WORKFLOW_TEMPLATE_DIR``."""
    result = await pull_snakemake_workflow_template_async(session)
    await session.commit()
    return SnakeTemplatePullResponse(
        status=result["status"],
        action=result["action"],
        path=result["path"],
    )


@router.get("/snake-template/file", response_model=CatalogFileContent)
async def read_snake_template_file(
    path: str = Query(..., description="Relative path under template root"),
    user: User = Depends(current_active_user_with_token),  # noqa: ARG001
    session: AsyncSession = Depends(get_async_session),
):
    """Read a single file from the template tree."""
    data = await read_template_file_async(session, path)
    return CatalogFileContent(
        path=data["path"],
        name=data["name"],
        content=data["content"],
        language=_detect_language(data["path"]),
        lines=data["lines"],
        size=data["size"],
    )


@router.get("/snake-template/dag/svg")
async def get_snake_template_dag_svg(
    user: User = Depends(current_active_user_with_token),  # noqa: ARG001
    session: AsyncSession = Depends(get_async_session),
):
    """Return cached Snakevision SVG for the official template rulegraph."""
    st = await template_overview_async(session)
    if not st["ready"]:
        raise HTTPException(
            status_code=404,
            detail="Template not available. Pull the template first.",
        )
    await materialize_snake_template_workspace(session)
    await session.commit()
    svg = snake_template_dag_svg_path()
    if svg.is_file() and svg.stat().st_size > 0:
        return FileResponse(svg, media_type="image/svg+xml", filename="dag.svg")
    err_file = snake_template_dag_error_path()
    if err_file.is_file():
        detail = err_file.read_text(encoding="utf-8", errors="replace")[:4000]
        raise HTTPException(status_code=500, detail=detail)
    if is_generation_in_progress(SNAKE_TEMPLATE_DAG_REGISTRY_KEY):
        raise HTTPException(
            status_code=404,
            detail="DAG is still generating. Retry shortly.",
        )
    raise HTTPException(
        status_code=404,
        detail="DAG SVG not available yet. Use POST /snake-template/dag/svg to start generation.",
    )


@router.post("/snake-template/dag/svg")
async def trigger_snake_template_dag_svg(
    background_tasks: BackgroundTasks,
    user: User = Depends(current_active_user_with_token),  # noqa: ARG001
    session: AsyncSession = Depends(get_async_session),
):
    """Queue background Snakevision SVG for the built-in Snakemake workflow template."""
    st = await template_overview_async(session)
    if not st["ready"]:
        raise HTTPException(
            status_code=404,
            detail="Template not available. Pull the template first.",
        )
    await materialize_snake_template_workspace(session)
    await session.commit()
    root = snake_template_workflow_root()
    if not find_snakefile(root):
        raise HTTPException(
            status_code=404,
            detail="Snakefile not found (expected workflow/Snakefile or Snakefile).",
        )
    svg = snake_template_dag_svg_path()
    if svg.is_file() and svg.stat().st_size > 0:
        return Response(status_code=204)
    clear_dag_artifact_files(svg, snake_template_dag_error_path())
    if not try_begin_generation(SNAKE_TEMPLATE_DAG_REGISTRY_KEY):
        return JSONResponse({"status": "generating"}, status_code=202)
    background_tasks.add_task(_run_dag_svg_job_snake_template)
    return JSONResponse({"status": "queued"}, status_code=202)


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


@router.get("/{catalog_ref}/workflows", response_model=WorkflowListResponse)
async def list_catalog_workflows(
    catalog_ref: str,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
    session: AsyncSession = Depends(get_async_session),
    limit: int = Query(50, ge=1, description="Maximum number of workflows to return"),
    offset: int = Query(0, ge=0, description="Number of workflows to skip"),
    order_by_started: bool = Query(
        True, description="Order by start time (True) or ID (False)"
    ),
    descending: bool = Query(
        True, description="Order in descending order (newest first)"
    ),
):
    """List workflow runs linked to this catalog (same user scope as GET /workflows)."""
    cat = await svc._resolve_catalog_ref(catalog_ref, user.id)
    assert_catalog_readable(cat, user.id)
    filter_user_id = user.id if not user.is_superuser else None
    return await WorkflowService(session).list_all_workflows(
        limit=limit,
        offset=offset,
        order_by_started=order_by_started,
        descending=descending,
        user_id=filter_user_id,
        catalog_id=cat.id,
    )


@router.get("/{catalog_ref}", response_model=CatalogDetail)
async def get_catalog(
    catalog_ref: str,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Get catalog detail and full file list.

    ``catalog_ref`` is the catalog UUID (recommended) or a slug scoped to your account
    (see also 409 when multiple visible catalogs share a slug).
    """
    return await svc.get_catalog(catalog_ref, user_id=user.id)


@router.patch("/{catalog_ref}", response_model=CatalogSummary)
async def update_catalog(
    catalog_ref: str,
    request: CatalogUpdateRequest,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Update catalog metadata."""
    data = request.model_dump(exclude_none=True)
    return await svc.update_metadata(catalog_ref, data, user_id=user.id)


@router.delete("/{catalog_ref}")
async def delete_catalog(
    catalog_ref: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Delete a catalog and all its files."""
    await svc.delete_catalog(
        catalog_ref, user_id=user.id, background_tasks=background_tasks
    )
    return {"message": "Catalog deleted"}


# --- File operations ---


@router.get("/{catalog_ref}/files/{file_path:path}", response_model=CatalogFileContent)
async def read_file(
    catalog_ref: str,
    file_path: str,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Read a file from a catalog."""
    return await svc.read_file(catalog_ref, file_path, user_id=user.id)


# 批量导入接口
class FileImportItem(BaseModel):
    path: str
    content: str
    sha256: str
    size: int | None = None
    lines: int | None = None
    language: str | None = None


class BatchImportRequest(BaseModel):
    mode: str  # "replace" or "merge"
    commit_message: str = "Batch import"
    files: list[FileImportItem]
    delete_paths: list[str] = []


@router.post("/{catalog_ref}/batch-import")
async def batch_import_catalog_files(
    catalog_ref: str,
    request: BatchImportRequest,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """批量导入文件到 catalog"""
    return await svc.batch_import_files(
        catalog_ref=catalog_ref,
        mode=request.mode,
        commit_message=request.commit_message,
        files_data=[f.model_dump() for f in request.files],
        delete_paths=request.delete_paths,
        author=user.email or str(user.id),
        user_id=user.id,
    )


# --- Export / Import ---


@router.get("/{catalog_ref}/download")
async def download_catalog(
    catalog_ref: str,
    format: str = "tar.gz",
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Download a catalog as a compressed archive (zip or tar.gz)."""
    if format == "zip":
        zip_path, disk_slug = await svc.download_catalog(catalog_ref, user_id=user.id)
        return FileResponse(
            zip_path, media_type="application/zip", filename=f"{disk_slug}.zip"
        )
    else:
        # Default to tar.gz (export)
        buffer, disk_slug = await svc.export_archive(catalog_ref, user_id=user.id)
        return StreamingResponse(
            buffer,
            media_type="application/gzip",
            headers={"Content-Disposition": f"attachment; filename={disk_slug}.tar.gz"},
        )


@router.post("/upload", status_code=201, response_model=CatalogSummary)
async def upload_catalog(
    file: UploadFile,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Upload a .tar.gz archive as a new catalog."""
    return await svc.import_archive(
        file,
        owner=user.email or str(user.id),
        owner_id=user.id,
    )


@router.get("/{catalog_ref}/export")
async def export_catalog(
    catalog_ref: str,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Alias for download_catalog with tar.gz format."""
    return await download_catalog(catalog_ref, format="tar.gz", user=user, svc=svc)


@router.post("/{catalog_ref}/sync")
async def sync_catalog_zip(
    catalog_ref: str,
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
        return await svc.sync_catalog(catalog_ref, tmp_path, user)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# --- DAG preview ---


@router.get("/{catalog_ref}/dag/preview")
async def get_catalog_dag_preview(
    catalog_ref: str,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Return DAG visual: user-uploaded image if set, else cached Snakevision SVG."""
    pair = await svc.read_dag_visual_bytes(catalog_ref, user.id)
    if pair is None:
        raise HTTPException(
            status_code=404,
            detail="No DAG preview (upload an image, generate SVG, or run the workflow).",
        )
    data, mime = pair
    return Response(content=data, media_type=mime)


@router.post("/{catalog_ref}/dag/preview", status_code=204)
async def upload_catalog_dag_preview(
    catalog_ref: str,
    file: UploadFile = File(...),
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Upload a PNG/JPEG/SVG/WebP preview image stored in the database only."""
    body = await file.read()
    await svc.set_dag_preview_image(
        catalog_ref,
        user.id,
        body,
        file.content_type,
        file.filename,
    )
    return Response(status_code=204)


@router.delete("/{catalog_ref}/dag/preview", status_code=204)
async def delete_catalog_dag_preview(
    catalog_ref: str,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Remove the user-uploaded DAG preview image."""
    await svc.clear_dag_preview_image(catalog_ref, user.id)
    return Response(status_code=204)


@router.get("/{catalog_ref}/dag")
async def get_catalog_dag(
    catalog_ref: str,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Generate DAG preview from the catalog's Snakefile."""
    return await svc.generate_dag(catalog_ref, user_id=user.id)


@router.get("/{catalog_ref}/dag/svg")
async def get_catalog_dag_svg(
    catalog_ref: str,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Return cached Snakevision SVG for the catalog rulegraph (on-demand generation via POST)."""
    cat = await svc._resolve_catalog_ref(catalog_ref, user.id)
    assert_catalog_readable(cat, user.id)
    owner_id = cat.owner_id
    disk_slug = cat.slug
    job_key = str(cat.id)
    svg = dag_svg_path(owner_id, disk_slug)
    if svg.is_file() and svg.stat().st_size > 0:
        return FileResponse(svg, media_type="image/svg+xml", filename="dag.svg")
    err_file = dag_error_path(owner_id, disk_slug)
    if err_file.is_file():
        detail = err_file.read_text(encoding="utf-8", errors="replace")[:4000]
        raise HTTPException(status_code=500, detail=detail)
    if is_generation_in_progress(job_key):
        raise HTTPException(
            status_code=404,
            detail="DAG is still generating. Retry shortly.",
        )
    raise HTTPException(
        status_code=404,
        detail="DAG SVG not available yet. Use POST /dag/svg to start generation.",
    )


@router.post("/{catalog_ref}/dag/svg")
async def trigger_catalog_dag_svg(
    catalog_ref: str,
    background_tasks: BackgroundTasks,
    force: bool = False,
    user: User = Depends(current_active_user_with_token),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Queue background Snakevision SVG generation. Idempotent unless force=True."""
    cat = await svc._resolve_catalog_ref(catalog_ref, user.id)
    assert_catalog_readable(cat, user.id)
    owner_id = cat.owner_id
    disk_slug = cat.slug
    job_key = str(cat.id)
    await svc.catalog_export_paths_for_dag(catalog_ref, user.id)
    root = catalog_data_dir(owner_id, disk_slug)
    if force:
        clear_cached_dag_artifacts(owner_id, disk_slug)

    if (
        dag_svg_path(owner_id, disk_slug).is_file()
        and dag_svg_path(owner_id, disk_slug).stat().st_size > 0
    ):
        return Response(status_code=204)
    clear_cached_dag_artifacts(owner_id, disk_slug)

    if not root.is_dir():
        raise HTTPException(
            status_code=404,
            detail="Catalog workspace could not be materialized from the database.",
        )
    if not find_snakefile(root):
        raise HTTPException(
            status_code=404,
            detail="Snakefile not found (expected workflow/Snakefile or Snakefile).",
        )

    if not try_begin_generation(job_key):
        return JSONResponse({"status": "generating"}, status_code=202)

    background_tasks.add_task(_run_dag_svg_job, job_key, owner_id, disk_slug)
    return JSONResponse({"status": "queued"}, status_code=202)


class GitPushRequest(BaseModel):
    remote_url: str | None = None
    token: str | None = None


class ImportFromGitRequest(BaseModel):
    git_url: str
    token: str | None = None
    subdirectory: str | None = None
    confirm_overwrite: bool = False
    target_slug: str | None = None


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

    if not remote_url:
        raise HTTPException(status_code=400, detail="Git remote URL is not configured.")

    # Fail fast with a connectivity/auth check so users get immediate feedback.
    from app.services.third_party.git import git_service

    ok, msg = git_service.test_connection(remote_url, token)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    res = await svc.git_push(
        user_id=user.id,
        background_tasks=background_tasks,
        remote_url=remote_url,
        token=token,
    )
    # Best-effort: record "running" status so UI can poll settings.extra.git_backup
    try:
        from datetime import UTC, datetime

        extra = dict(settings.extra or {})
        extra["git_backup"] = {
            "run_id": (res or {}).get("run_id"),
            "status": "running",
            "message": None,
            "updated_at": datetime.now(UTC).isoformat(),
        }
        settings.extra = extra
        await session.commit()
    except Exception:
        pass
    return res


@router.post("/git/pull")
async def git_pull(
    user: User = Depends(current_active_user_with_token),
    session: AsyncSession = Depends(get_async_session),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Pull catalogs from the user's configured Git remote."""
    from .settings import get_or_create_user_settings

    settings = await get_or_create_user_settings(user, session)
    return await svc.git_pull(
        user_id=user.id,
        remote_url=settings.git_remote_url,
        token=settings.git_token,
    )


@router.post("/import/git", status_code=201)
async def import_from_git(
    request: ImportFromGitRequest,
    user: User = Depends(current_active_user_with_token),
    session: AsyncSession = Depends(get_async_session),
    svc: CatalogService = Depends(get_catalog_svc),
):
    """Clone a Git repository and import all catalogs found inside."""
    from .settings import get_or_create_user_settings

    settings = await get_or_create_user_settings(user, session)
    token = request.token or settings.git_token

    # Clean input values
    git_url = request.git_url.strip() if request.git_url else None
    subdirectory = request.subdirectory.strip() if request.subdirectory else None

    if token:
        token = token.strip()

    return await svc.import_from_git(
        git_url=git_url,
        user_id=user.id,
        token=token,
        owner=user.email or str(user.id),
        owner_id=user.id,
        subdirectory=subdirectory,
        confirm_overwrite=request.confirm_overwrite,
        target_slug=request.target_slug,
    )
