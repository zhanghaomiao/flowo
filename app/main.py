import asyncio
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_mcp import FastApiMCP

from .api import api_router
from .core.config import settings
from .core.pg_listener import pg_listener
from .core.session import AsyncSessionLocal
from .services.catalog.snake_template import (
    ensure_snakemake_workflow_template_on_startup,
)
from .services.catalog.snake_template_storage import (
    seed_snake_template_from_disk_if_empty,
)

# 配置日志 - 放在所有导入之前
# 在所有导入之后，配置日志
logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(ensure_snakemake_workflow_template_on_startup)
    async with AsyncSessionLocal() as session:
        await seed_snake_template_from_disk_if_empty(session)
        await session.commit()
    await pg_listener.connect()
    yield
    await pg_listener.disconnect()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

mcp = FastApiMCP(
    app,
    include_operations=[
        "list_runs",
        "get_latest_run",
        "list_running_runs",
        "list_recent_failed_runs",
        "summarize_run",
        "summarize_latest_run",
        "diagnose_run_failure",
        "diagnose_latest_failed_run",
        "get_run_timeline",
        "list_run_outputs",
        "trace_run_output",
        "list_catalog_workflows",
        "get_catalog_workflow_overview",
        "read_catalog_workflow_file",
        "search_catalog_workflow_files",
        "summarize_catalog_workflow",
        "list_runs_for_catalog_workflow",
        "materialize_catalog_workflow_workspace",
    ],
)

mcp.mount_http()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(api_router, prefix=settings.API_V1_STR)

mcp.setup_server()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="debug")
