"""MCP tool HTTP handlers under ``/api/v1/mcp-tools``.

Handler names and ``operation_id`` both emphasize *runs* (Snakemake executions) vs
*catalog workflows* (stored projects). MCP tools are listed in ``app/main.py``
``include_operations``.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_active_user_with_token
from app.core.session import get_async_session
from app.models import User
from app.services.mcp.catalogs import McpCatalogService
from app.services.mcp.workflows import McpWorkflowService

router = APIRouter()


def _mcp_catalog_service(db: AsyncSession, user: User) -> McpCatalogService:
    return McpCatalogService(db, user)


def _mcp_service(db: AsyncSession, user: User) -> McpWorkflowService:
    return McpWorkflowService(db, user)


@router.get("/workflows", operation_id="list_runs")
async def list_runs(
    status: str | None = Query(
        None, description="Optional workflow status: RUNNING, SUCCESS, ERROR, WAITING."
    ),
    name_query: str | None = Query(
        None, description="Search workflow name, directory, or Snakefile path."
    ),
    catalog_slug: str | None = Query(None, description="Filter by catalog slug."),
    tag: str | None = Query(None, description="Filter by one workflow tag."),
    since_hours: int | None = Query(
        None, ge=1, le=24 * 90, description="Only workflows started in this window."
    ),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    Find workflows before using workflow-specific tools.

    Use this when users say things like "recent workflows", "demo2 runs",
    "my failed workflows", or when they do not know the workflow id.
    """
    return await _mcp_service(db, current_user).list_workflows(
        status=status,
        name_query=name_query,
        catalog_slug=catalog_slug,
        tag=tag,
        since_hours=since_hours,
        limit=limit,
    )


@router.get("/workflows/latest", operation_id="get_latest_run")
async def get_latest_run(
    status: str | None = Query(None),
    name_query: str | None = Query(None),
    catalog_slug: str | None = Query(None),
    tag: str | None = Query(None),
    since_hours: int | None = Query(None, ge=1, le=24 * 90),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    Return the latest workflow matching natural filters.

    Use this when the user says "latest", "just ran", "most recent", or gives
    a catalog/name/tag but no workflow id.
    """
    return await _mcp_service(db, current_user).get_latest_workflow(
        status=status,
        name_query=name_query,
        catalog_slug=catalog_slug,
        tag=tag,
        since_hours=since_hours,
    )


@router.get("/workflows/latest/summary", operation_id="summarize_latest_run")
async def summarize_latest_run(
    status: str | None = Query(None),
    name_query: str | None = Query(None),
    catalog_slug: str | None = Query(None),
    tag: str | None = Query(None),
    since_hours: int | None = Query(None, ge=1, le=24 * 90),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    Find the latest matching workflow and summarize it.

    Use this for questions like "summarize my latest demo2 workflow".
    """
    return await _mcp_service(db, current_user).summarize_latest_workflow(
        status=status,
        name_query=name_query,
        catalog_slug=catalog_slug,
        tag=tag,
        since_hours=since_hours,
    )


@router.get(
    "/workflows/latest/failure-diagnosis",
    operation_id="diagnose_latest_failed_run",
)
async def diagnose_latest_failed_run(
    name_query: str | None = Query(None),
    catalog_slug: str | None = Query(None),
    tag: str | None = Query(None),
    since_hours: int | None = Query(None, ge=1, le=24 * 90),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    Find the latest failed workflow and gather diagnosis context.

    Use this for questions like "why did the latest failed workflow fail?".
    """
    return await _mcp_service(db, current_user).diagnose_latest_failed_workflow(
        name_query=name_query,
        catalog_slug=catalog_slug,
        tag=tag,
        since_hours=since_hours,
    )


@router.get("/workflows/{workflow_id}/timeline", operation_id="get_run_timeline")
async def get_run_timeline(
    workflow_id: uuid.UUID,
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    Return job timeline and slowest jobs for one workflow.

    Use this when users ask what took longest or where the workflow spent time.
    """
    return await _mcp_service(db, current_user).get_workflow_timeline(
        workflow_id,
        limit=limit,
    )


@router.get("/workflows/{workflow_id}/outputs", operation_id="list_run_outputs")
async def list_run_outputs(
    workflow_id: uuid.UUID,
    suffix: str | None = Query(
        None, description="Optional suffix such as bam, vcf, tsv, html, or h5ad."
    ),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    List output files recorded for a workflow.

    Use this when users ask what BAM/VCF/TSV/HTML/H5AD files were produced.
    """
    return await _mcp_service(db, current_user).list_workflow_outputs(
        workflow_id,
        suffix=suffix,
        limit=limit,
    )


@router.get("/running-count", operation_id="list_running_runs")
async def list_running_runs(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    Get the details of currently executing (RUNNING) workflows.

    INSTRUCTION FOR AI:
    When presenting the results to the user:
    1. Use a clean Markdown table.
    2. Include columns for Name, Progress, Status, and Jobs (Completed/Total).
    3. Visualize the 'progress' using a text-based progress bar (e.g., [####------]).
    4. If no workflows are running, tell the user clearly.
    """
    result = await _mcp_service(db, current_user).list_workflows(
        status="RUNNING",
        limit=50,
    )
    return {"running_count": result["total_matches"], "workflows": result["workflows"]}


@router.get("/failed-workflows", operation_id="list_recent_failed_runs")
async def list_recent_failed_runs(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    List recently failed workflows with their latest recorded errors.

    Use this before diagnosing failures across a project or when the user asks
    "what failed recently?".
    """
    result = await _mcp_service(db, current_user).list_workflows(
        status="ERROR",
        limit=limit,
    )
    return {"failed_count": result["total_matches"], "workflows": result["workflows"]}


@router.get("/workflows/{workflow_id}/summary", operation_id="summarize_run")
async def summarize_run(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    Summarize one workflow for AI reporting.

    Includes status, progress, job counts, rules, errors, and file availability signals.
    """
    return await _mcp_service(db, current_user).summarize_workflow(workflow_id)


@router.get(
    "/workflows/{workflow_id}/failure-diagnosis",
    operation_id="diagnose_run_failure",
)
async def diagnose_run_failure(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    Gather failed jobs and errors for AI failure diagnosis.

    This tool returns structured context only; the AI should explain likely causes
    and next checks to the user.
    """
    return await _mcp_service(db, current_user).diagnose_workflow_failure(workflow_id)


@router.get("/workflows/{workflow_id}/trace-output", operation_id="trace_run_output")
async def trace_run_output(
    workflow_id: uuid.UUID,
    path: str = Query(..., description="Output path to trace, exact or suffix match."),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    Trace an output path back to the job, rule, inputs, logs, command, and wildcards.
    """
    return await _mcp_service(db, current_user).trace_output(workflow_id, path)


@router.get("/catalogs", operation_id="list_catalog_workflows")
async def list_workflows_in_catalog(
    search: str | None = Query(None, description="Search catalog name or description."),
    tags: str | None = Query(
        None, description="Comma-separated tags to filter catalogs."
    ),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    List workflow catalogs readable by the current user.

    Use this before catalog-specific tools when the user gives a catalog name,
    slug, tag, or asks what templates are available.
    """
    return await _mcp_catalog_service(db, current_user).list_catalogs(
        search=search,
        tags=tags,
        limit=limit,
    )


@router.get(
    "/catalogs/{catalog_ref}/overview", operation_id="get_catalog_workflow_overview"
)
async def get_catalog_workflow_overview(
    catalog_ref: str,
    file_limit: int = Query(500, ge=1, le=2000),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    Get catalog metadata, file tree, and workspace materialization state.

    Use this to inspect a catalog before reading specific files or running Snakemake.
    """
    return await _mcp_catalog_service(db, current_user).get_catalog_overview(
        catalog_ref,
        file_limit=file_limit,
    )


@router.get(
    "/catalogs/{catalog_ref}/files/{path:path}",
    operation_id="read_catalog_workflow_file",
)
async def read_catalog_workflow_file(
    catalog_ref: str,
    path: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    Read one text file from the database-backed catalog source.

    Sensitive paths such as .env, token, password, credential, and private-key
    files are not returned through MCP.
    """
    return await _mcp_catalog_service(db, current_user).read_catalog_file(
        catalog_ref,
        path,
    )


@router.get(
    "/catalogs/{catalog_ref}/search", operation_id="search_catalog_workflow_files"
)
async def search_catalog_workflow_files(
    catalog_ref: str,
    query: str = Query(..., min_length=1),
    path_prefix: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    Search catalog file paths and text content from the database.

    Use this to find rules, config keys, sample references, containers, conda
    environments, or script calls without requiring a local workspace cache.
    """
    return await _mcp_catalog_service(db, current_user).search_catalog_files(
        catalog_ref,
        query=query,
        path_prefix=path_prefix,
        limit=limit,
    )


@router.get(
    "/catalogs/{catalog_ref}/summary", operation_id="summarize_catalog_workflow"
)
async def summarize_catalog_workflow(
    catalog_ref: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    Return an AI-friendly catalog summary without invoking an LLM.

    Includes entrypoints, likely config/rule/script/env files, workspace state,
    and missing readiness signals.
    """
    return await _mcp_catalog_service(db, current_user).summarize_catalog(catalog_ref)


@router.get(
    "/catalogs/{catalog_ref}/workflows",
    operation_id="list_runs_for_catalog_workflow",
)
async def list_runs_for_catalog_workflow(
    catalog_ref: str,
    status: str | None = Query(
        None, description="Optional workflow status: RUNNING, SUCCESS, ERROR, WAITING."
    ),
    since_hours: int | None = Query(
        None, ge=1, le=24 * 90, description="Only workflows started in this window."
    ),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    List workflow runs linked to one catalog.

    Use this to connect a template/catalog to recent real executions or failures.
    """
    return await _mcp_catalog_service(db, current_user).list_catalog_workflows(
        catalog_ref,
        status=status,
        since_hours=since_hours,
        limit=limit,
    )


@router.post(
    "/catalogs/{catalog_ref}/materialize",
    operation_id="materialize_catalog_workflow_workspace",
)
async def materialize_catalog_workflow_workspace(
    catalog_ref: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user_with_token),
) -> dict[str, Any]:
    """
    Rebuild the local Snakemake workspace from database-backed catalog files.

    This does not modify catalog source rows; it only recreates the local
    workspace cache needed to run Snakemake.
    """
    return await _mcp_catalog_service(
        db,
        current_user,
    ).materialize_catalog_workspace(catalog_ref)
