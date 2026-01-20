from fastapi import APIRouter

from app.api.endpoints import jobs, logs, outputs, sse, summary, utils, workflows, files

api_router = APIRouter()
api_router.include_router(summary.router, prefix="/summary", tags=["summary"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["workflow"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(outputs.router, prefix="/outputs", tags=["outputs"])
api_router.include_router(utils.router, prefix="/utils", tags=["utils"])
api_router.include_router(sse.router, prefix="/sse", tags=["sse"])
api_router.include_router(logs.router, prefix="/logs", tags=["logs"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
