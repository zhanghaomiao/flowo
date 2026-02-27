"""
REST API endpoints for Snakemake workflow template management.
"""

from fastapi import APIRouter, Depends, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.users import current_active_user
from app.models.user import User
from app.services.workflow_template import TemplateService

router = APIRouter()


def get_template_service() -> TemplateService:
    return TemplateService()


# --- Schemas ---


class TemplateCreateRequest(BaseModel):
    name: str
    description: str = ""
    tags: list[str] = []


class TemplateUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    version: str | None = None
    tags: list[str] | None = None
    is_public: bool | None = None
    source_url: str | None = None


class FileWriteRequest(BaseModel):
    content: str


class TemplateFileInfo(BaseModel):
    name: str
    path: str
    lines: int
    size: int
    modified: str


class TemplateCategoryInfo(BaseModel):
    dir: str
    required: bool
    extensions: list[str]
    count: int


class TemplateSummary(BaseModel):
    name: str
    slug: str
    description: str = ""
    version: str = "0.1.0"
    owner: str = ""
    tags: list[str] = []
    is_public: bool = False
    source_url: str = ""
    created_at: str
    updated_at: str
    file_count: int
    has_snakefile: bool


class TemplateDetail(TemplateSummary):
    files: dict[str, list[TemplateFileInfo]]
    categories: dict[str, TemplateCategoryInfo]


class TemplateFileContent(BaseModel):
    path: str
    name: str
    content: str
    language: str
    lines: int
    size: int


# --- Template CRUD ---


@router.get("", response_model=list[TemplateSummary])
def list_templates(
    search: str | None = Query(None, description="Search by name or description"),
    tags: str | None = Query(None, description="Filter by tags (comma-separated)"),
    user: User = Depends(current_active_user),
    svc: TemplateService = Depends(get_template_service),
):
    """List all workflow templates."""
    return svc.list_templates(search=search, tags=tags)


@router.post("", status_code=201, response_model=TemplateSummary)
def create_template(
    request: TemplateCreateRequest,
    user: User = Depends(current_active_user),
    svc: TemplateService = Depends(get_template_service),
):
    """Create a new workflow template with an empty Snakefile."""
    return svc.create_template(
        name=request.name,
        description=request.description,
        tags=request.tags,
        owner=user.email or str(user.id),
    )


@router.get("/{slug}", response_model=TemplateDetail)
def get_template(
    slug: str,
    user: User = Depends(current_active_user),
    svc: TemplateService = Depends(get_template_service),
):
    """Get template detail with file inventory."""
    return svc.get_template(slug)


@router.patch("/{slug}", response_model=TemplateSummary)
def update_template(
    slug: str,
    request: TemplateUpdateRequest,
    user: User = Depends(current_active_user),
    svc: TemplateService = Depends(get_template_service),
):
    """Update template metadata."""
    data = request.model_dump(exclude_none=True)
    return svc.update_metadata(slug, data)


@router.delete("/{slug}")
def delete_template(
    slug: str,
    user: User = Depends(current_active_user),
    svc: TemplateService = Depends(get_template_service),
):
    """Delete a template and all its files."""
    svc.delete_template(slug)
    return {"message": f"Template '{slug}' deleted"}


# --- File operations ---


@router.get("/{slug}/files/{file_path:path}", response_model=TemplateFileContent)
def read_file(
    slug: str,
    file_path: str,
    user: User = Depends(current_active_user),
    svc: TemplateService = Depends(get_template_service),
):
    """Read a file from a template."""
    return svc.read_file(slug, file_path)


@router.put("/{slug}/files/{file_path:path}", response_model=TemplateFileContent)
def write_file(
    slug: str,
    file_path: str,
    request: FileWriteRequest,
    user: User = Depends(current_active_user),
    svc: TemplateService = Depends(get_template_service),
):
    """Create or update a file in a template."""
    return svc.write_file(slug, file_path, request.content)


@router.delete("/{slug}/files/{file_path:path}")
def delete_file(
    slug: str,
    file_path: str,
    user: User = Depends(current_active_user),
    svc: TemplateService = Depends(get_template_service),
):
    """Delete a file from a template."""
    svc.delete_file(slug, file_path)
    return {"message": f"File '{file_path}' deleted"}


# --- Export / Import ---


@router.get("/{slug}/export")
def export_template(
    slug: str,
    user: User = Depends(current_active_user),
    svc: TemplateService = Depends(get_template_service),
):
    """Download a template as a .tar.gz archive."""
    buffer = svc.export_archive(slug)
    return StreamingResponse(
        buffer,
        media_type="application/gzip",
        headers={"Content-Disposition": f"attachment; filename={slug}.tar.gz"},
    )


@router.post("/upload", status_code=201, response_model=TemplateSummary)
async def upload_template(
    file: UploadFile,
    user: User = Depends(current_active_user),
    svc: TemplateService = Depends(get_template_service),
):
    """Upload a .tar.gz archive as a new template."""
    return await svc.import_archive(file, owner=user.email or str(user.id))


# --- DAG preview ---


@router.get("/{slug}/dag")
def get_template_dag(
    slug: str,
    user: User = Depends(current_active_user),
    svc: TemplateService = Depends(get_template_service),
):
    """Generate DAG preview from the template's Snakefile."""
    return svc.generate_dag(slug)


class GitPushRequest(BaseModel):
    remote_url: str | None = None
    token: str | None = None


class ImportFromGitRequest(BaseModel):
    git_url: str
    token: str | None = None


# --- Git sync ---


@router.post("/git/push")
def git_push(
    request: GitPushRequest,
    user: User = Depends(current_active_user),
    svc: TemplateService = Depends(get_template_service),
):
    """Push all templates to a Git remote (monorepo).

    Accepts an optional remote_url override and access token for private repos.
    Returns the remote URL on success so the frontend can display it as a
    shareable link.
    """
    return svc.git_push(remote_url=request.remote_url, token=request.token)


@router.post("/git/pull")
def git_pull(
    user: User = Depends(current_active_user),
    svc: TemplateService = Depends(get_template_service),
):
    """Pull templates from the configured Git remote."""
    return svc.git_pull()


@router.post("/import/git", status_code=201, response_model=list[TemplateSummary])
def import_from_git(
    request: ImportFromGitRequest,
    user: User = Depends(current_active_user),
    svc: TemplateService = Depends(get_template_service),
):
    """Clone a Git repository and import all templates found inside.

    Accepts the root of a monorepo (multiple template subdirectories) or
    a single-template repo.  Returns the list of imported templates.
    """
    return svc.import_from_git(
        git_url=request.git_url,
        token=request.token,
        owner=user.email or str(user.id),
    )
