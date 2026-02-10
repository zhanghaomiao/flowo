from fastapi import APIRouter

from app.api.endpoints import (
    auth,
    files,
    jobs,
    outputs,
    reports,
    sse,
    summary,
    tokens,
    utils,
    workflows,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth")
api_router.include_router(summary.router, prefix="/summary", tags=["summary"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["workflow"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(outputs.router, prefix="/outputs", tags=["outputs"])
api_router.include_router(utils.router, prefix="/utils", tags=["utils"])
api_router.include_router(sse.router, prefix="/sse", tags=["sse"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(tokens.router, prefix="/tokens", tags=["tokens"])
