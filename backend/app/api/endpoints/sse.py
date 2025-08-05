import asyncio
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from app.core.logger import logger
from app.core.sse_connection_manager import (
    SSEConnectionManager,
)

router = APIRouter()

_sse_manager_instance: SSEConnectionManager | None = None


async def get_sse_manager() -> SSEConnectionManager:
    global _sse_manager_instance
    if _sse_manager_instance is None:
        _sse_manager_instance = await SSEConnectionManager.get_instance()
    return _sse_manager_instance


@router.get("/events")
async def stream_events(
    request: Request,
    filters: str | None = Query(
        None,
        description="Comma-separated list of table names to filter (e.g., 'workflows,jobs'). Use 'all' for all tables.",
    ),
    workflow_id: str | None = Query(
        None, description="Workflow ID to filter events for a specific workflow."
    ),
):
    """
    Server-Sent Events endpoint for real-time database notifications.

    客户端可以连接此端点接收实时通知:
    - GET /api/v1/sse/events - 接收所有表变化
    - GET /api/v1/sse/events?filters=workflows - 只接收workflows表变化
    - GET /api/v1/sse/events?filters=jobs&workflow_id=123 - 接收workflows和jobs表变化
    """

    sse_manager = await get_sse_manager()
    client_id = f"client_{uuid.uuid4()}"
    filter_set = set()
    if filters:
        filter_set = {f.strip() for f in filters.split(",")}
    else:
        filter_set = {"all"}

    client_queue = await sse_manager.add_client(client_id, filter_set, workflow_id)

    async def event_generator():
        try:
            welcome_message = {
                "type": "connected",
                "client_id": client_id,
                "filters": list(filter_set),
                "timestamp": datetime.now().isoformat(),
                "message": "Successfully connected to SSE stream",
            }
            yield f"event: connection\ndata: {json.dumps(welcome_message)}\n\n"

            while True:
                if await request.is_disconnected():
                    logger.info(f"SSE: Client {client_id} disconnected")
                    break
                try:
                    message = await asyncio.wait_for(client_queue.get(), timeout=30.0)
                    yield f"event: {message['type']}\ndata: {json.dumps(message['data'])}\n\n"

                except TimeoutError:
                    heartbeat = {
                        "type": "heartbeat",
                        "timestamp": datetime.now().isoformat(),
                        "active_clients": len(sse_manager.active_connections),
                    }
                    yield f"event: heartbeat\ndata: {json.dumps(heartbeat)}\n\n"

        except Exception as e:
            logger.error(f"SSE: Error in event generator for client {client_id}: {e}")
        finally:
            sse_manager.remove_client(client_id)
            logger.info(f"SSE: Cleaned up client {client_id}")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control",
        },
    )


@router.get("/health")
async def sse_health_check():
    sse_manager = await get_sse_manager()
    stats = await sse_manager.get_connection_stats()
    health_status = await sse_manager.health_check()

    return {
        "service": "SSE Notification Service",
        "status": "healthy" if health_status else "unhealthy",
        "database_connected": health_status,
        "stats": stats,
    }


@router.get("/stats")
async def get_sse_stats():
    sse_manager = await get_sse_manager()
    return await sse_manager.get_connection_stats()


@router.post("/test-notification")
async def send_test_notification():
    sse_manager = await get_sse_manager()

    test_event = {
        "type": "test_notification",
        "data": {
            "table": "test",
            "operation": "TEST",
            "record_id": "test-123",
            "timestamp": datetime.now().timestamp(),
            "formatted_timestamp": datetime.now().isoformat(),
            "message": "This is a test notification",
        },
    }

    sse_manager.broadcast_to_clients(test_event)

    return {
        "message": "Test notification sent",
        "clients_notified": len(sse_manager.active_connections),
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/debug/connections")
async def debug_connections():
    import subprocess

    sse_manager = await get_sse_manager()

    try:
        result = subprocess.run(
            [
                "sudo",
                "-u",
                "postgres",
                "psql",
                "-t",
                "-c",
                "SELECT count(*) FROM pg_stat_activity WHERE usename='snakemake' AND query LIKE 'LISTEN%';",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )

        listen_count = (
            int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
        )

        detailed_result = subprocess.run(
            [
                "sudo",
                "-u",
                "postgres",
                "psql",
                "-c",
                "SELECT pid, client_addr, backend_start, state, query FROM pg_stat_activity WHERE usename='snakemake' AND query LIKE 'LISTEN%' ORDER BY backend_start DESC;",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )

        return {
            "listen_connections_count": listen_count,
            "listen_connections_detail": detailed_result.stdout,
            "sse_manager_connected": sse_manager.connection is not None
            and not sse_manager.connection.is_closed(),
            "active_sse_clients": len(sse_manager.active_connections),
            "manager_stats": await sse_manager.get_connection_stats(),
        }
    except Exception as e:
        return {"error": str(e)}


@router.post("/cleanup-connections")
async def cleanup_connections():
    import subprocess

    try:
        # 获取当前 LISTEN 连接数
        count_result = subprocess.run(
            [
                "sudo",
                "-u",
                "postgres",
                "psql",
                "-t",
                "-c",
                "SELECT count(*) FROM pg_stat_activity WHERE usename='snakemake' AND query LIKE 'LISTEN%';",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )

        listen_count = (
            int(count_result.stdout.strip())
            if count_result.stdout.strip().isdigit()
            else 0
        )

        if listen_count > 1:
            # 保留最新的连接，终止其他的
            cleanup_result = subprocess.run(
                [
                    "sudo",
                    "-u",
                    "postgres",
                    "psql",
                    "-c",
                    """
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE usename = 'snakemake'
                  AND query LIKE 'LISTEN%'
                  AND pid != (
                    SELECT pid
                    FROM pg_stat_activity
                    WHERE usename = 'snakemake'
                      AND query LIKE 'LISTEN%'
                    ORDER BY backend_start DESC
                    LIMIT 1
                  );
                """,
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )

            return {
                "message": f"Cleaned up {listen_count - 1} extra LISTEN connections",
                "before_count": listen_count,
                "cleanup_result": cleanup_result.stdout,
            }
        else:
            return {"message": "No cleanup needed", "listen_connections": listen_count}

    except Exception as e:
        return {"error": str(e)}


@router.post("/reconnect")
async def force_reconnect():
    try:
        sse_manager = await get_sse_manager()
        await sse_manager.reconnect_database()

        return {
            "message": "Database reconnection initiated",
            "timestamp": datetime.now().isoformat(),
            "connected": await sse_manager.health_check(),
        }
    except Exception as e:
        return {"error": str(e)}
