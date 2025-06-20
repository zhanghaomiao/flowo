from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.api import api_router
from app.core.config import settings
from app.api.endpoints.sse import get_sse_manager

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
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
