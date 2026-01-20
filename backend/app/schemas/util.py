from pydantic import BaseModel


class Message(BaseModel):
    message: str


class StatusSummary(BaseModel):
    total: int
    success: int
    running: int
    error: int


class UserSummary(BaseModel):
    total: int
    running: int


class ResourcesSummary(BaseModel):
    cpu_idle_cores: float
    cpu_total_cores: int | None
    mem_total_GB: float
    mem_available_GB: float


class ServiceStatus(BaseModel):
    name: str
    status: str  # "healthy", "unhealthy", "unknown"
    message: str
    details: dict | None = None


class SystemHealthResponse(BaseModel):
    database: ServiceStatus
    sse: ServiceStatus
    overall_status: str  # "healthy", "degraded", "unhealthy"
