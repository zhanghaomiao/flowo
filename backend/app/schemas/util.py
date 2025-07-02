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
