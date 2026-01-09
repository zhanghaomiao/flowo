from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from app.api import api_router
from app.api.endpoints.sse import get_sse_manager
from app.core.config import settings


def use_route_names_as_operation_ids(app: FastAPI) -> None:
    """
    Simplify operation IDs so that generated API clients have simpler function
    names.

    Should be called only after all routes have been added.
    """
    for route in app.routes:
        if isinstance(route, APIRoute):
            route.operation_id = route.name  # in this case, 'read_items'


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        sse_manager = await get_sse_manager()
        await sse_manager.connect_to_database()
        print("SSE service initialized successfully")
    except Exception as e:
        print(f"Failed to initialize SSE service: {e}")

    yield

    try:
        sse_manager = await get_sse_manager()
        await sse_manager.disconnect_from_database()
        print("SSE service shut down successfully")
    except Exception as e:
        print(f"Error shutting down SSE service: {e}")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(api_router, prefix=settings.API_V1_STR)
use_route_names_as_operation_ids(app)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
