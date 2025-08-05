import asyncio
import json
from datetime import datetime
from typing import Optional

import asyncpg

from app.core.config import settings
from app.core.logger import logger


class SSEConnectionManager:
    """Manages Server-Sent Events connections and PostgreSQL notifications."""

    _instance: Optional["SSEConnectionManager"] = None
    _initialized = False
    _lock = asyncio.Lock()

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.connection: asyncpg.Connection | None = None
        self.workflow_connections: dict[str, set[str]] = {}  # workflow_id -> client_ids
        self.active_connections: dict[str, asyncio.Queue] = {}
        self.client_filters: dict[str, set[str]] = {}
        self._connection_lock = asyncio.Lock()
        self._keep_alive_task: asyncio.Task | None = None
        self._initialized = True
        logger.info("SSE: Connection manager instance created")

    @classmethod
    async def get_instance(cls) -> "SSEConnectionManager":
        async with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    async def connect_to_database(self):
        """Establish database connection for notifications."""
        async with self._connection_lock:
            if self.connection and not self.connection.is_closed():
                logger.info("SSE: Closing existing database connection")
                await self._cleanup_connection()

            try:
                logger.info("SSE: Establishing new database connection")
                self.connection = await asyncpg.connect(
                    settings.SQLALCHEMY_DATABASE_URI
                )

                await self.connection.add_listener(
                    "table_changes", self.handle_database_notification
                )
                await self.connection.add_listener(
                    "table_changes_workflows", self.handle_database_notification
                )
                await self.connection.add_listener(
                    "table_changes_jobs", self.handle_database_notification
                )

                logger.info(
                    "SSE: Connected to database and listening for notifications"
                )

                if self._keep_alive_task:
                    self._keep_alive_task.cancel()
                self._keep_alive_task = asyncio.create_task(
                    self.keep_connection_alive()
                )

            except Exception as e:
                logger.error(f"SSE: Failed to connect to database: {e}")
                self.connection = None
                raise

    async def _cleanup_connection(self):
        try:
            if self._keep_alive_task:
                self._keep_alive_task.cancel()
                self._keep_alive_task = None

            if self.connection and not self.connection.is_closed():
                await self.connection.close()
                logger.info("SSE: Previous database connection closed")
        except Exception as e:
            logger.error(f"SSE: Error cleaning up connection: {e}")
        finally:
            self.connection = None

    async def disconnect_from_database(self):
        async with self._connection_lock:
            await self._cleanup_connection()
            logger.info("SSE: Database connection disconnected")

    async def keep_connection_alive(self):
        """Keep the database connection alive."""
        while True:
            try:
                await asyncio.sleep(30)
                if self.connection and not self.connection.is_closed():
                    await self.connection.fetchval("SELECT 1")
                    logger.debug("SSE: Connection heartbeat successful")
                else:
                    logger.warning("SSE: Connection lost, attempting to reconnect")
                    await self.reconnect_database()
                    break
            except asyncio.CancelledError:
                logger.info("SSE: Keep alive task cancelled")
                break
            except Exception as e:
                logger.error(f"SSE: Database connection error: {e}")
                await self.reconnect_database()
                break

    async def reconnect_database(self):
        """Reconnect to database if connection is lost."""
        try:
            logger.info("SSE: Attempting to reconnect to database")
            await self.connect_to_database()
        except Exception as e:
            logger.error(f"SSE: Failed to reconnect to database: {e}")

    def handle_database_notification(self, connection, pid, channel, payload):
        """Handle database notifications and broadcast to appropriate SSE clients."""
        try:
            data = json.loads(payload)
            data["formatted_timestamp"] = datetime.fromtimestamp(
                data["timestamp"]
            ).isoformat()
            data["channel"] = channel

            workflow_id = data.get("workflow_id")
            table_name = data.get("table")
            operation = data.get("operation")

            logger.info(
                f"SSE: Processing notification - {channel}: {table_name} {operation}"
            )

            # Handle specific workflow-targeted broadcasts first
            if workflow_id and table_name == "jobs":
                job_event = {"type": f"jobs.{workflow_id}", "data": data}
                self.broadcast(job_event, workflow_id=workflow_id)
            elif table_name == "workflows" and workflow_id:
                workflow_event = {"type": f"workflow.{workflow_id}", "data": data}
                self.broadcast(workflow_event, workflow_id=workflow_id)

            self.broadcast({"type": "database_change", "data": data})

        except Exception as e:
            logger.error(f"SSE: Error handling database notification: {e}")

    def broadcast(self, event: dict, workflow_id: str | None = None):
        """
        Broadcast function for SSE events.

        Args:
            event: The event to broadcast
            workflow_id: Optional workflow ID. If provided, broadcasts to clients subscribed to this workflow.
                        If None, broadcasts globally to clients not subscribed to any specific workflow.
        """
        broadcast_count = 0
        table_name = event.get("data", {}).get("table", "")

        if workflow_id:
            # Workflow-specific broadcast
            target_clients = self.workflow_connections.get(workflow_id, set())
            broadcast_type = f"workflow-{workflow_id}"
        else:
            # Global broadcast - find clients not subscribed to any specific workflow
            subscribed_clients = set()
            for clients in self.workflow_connections.values():
                subscribed_clients.update(clients)
            target_clients = set(self.active_connections.keys()) - subscribed_clients
            broadcast_type = "global"

        # Broadcast to target clients with filter checking
        for client_id in list(target_clients):
            if client_id not in self.active_connections:
                continue

            # Check if client's filters allow this event
            client_filters = self.client_filters.get(client_id, {"all"})
            should_send = False

            if "all" in client_filters:
                should_send = True
            elif table_name and table_name in client_filters:
                should_send = True
            elif not table_name and "workflows" in client_filters:
                should_send = True

            if not should_send:
                continue

            try:
                self.active_connections[client_id].put_nowait(event)
                broadcast_count += 1
            except asyncio.QueueFull:
                logger.warning(
                    f"SSE: Queue full for client {client_id}, dropping event"
                )
            except Exception as e:
                logger.error(f"SSE: Error broadcasting to client {client_id}: {e}")

        logger.debug(
            f"SSE: Event broadcasted to {broadcast_type} clients: {broadcast_count}/{len(target_clients)} (filtered)"
        )

    async def add_client(
        self, client_id: str, filters: set[str], workflow_id: str | None = None
    ):
        """Add a new SSE client connection with optional workflow subscription."""
        queue = asyncio.Queue(maxsize=200)
        self.active_connections[client_id] = queue
        self.client_filters[client_id] = filters or {"all"}

        if workflow_id:
            if workflow_id not in self.workflow_connections:
                self.workflow_connections[workflow_id] = set()
            self.workflow_connections[workflow_id].add(client_id)

        total_clients = len(self.active_connections)
        workflow_info = f", workflow: {workflow_id}" if workflow_id else ""
        logger.info(
            f"SSE: Added client {client_id} with filters: {filters}{workflow_info} (Total: {total_clients})"
        )

        return queue

    async def remove_client(self, client_id: str):
        """Remove an SSE client connection and clean up subscriptions."""
        self.active_connections.pop(client_id, None)
        self.client_filters.pop(client_id, None)

        # Remove from all workflow subscriptions
        for workflow_id in list(self.workflow_connections.keys()):
            if client_id in self.workflow_connections[workflow_id]:
                self.workflow_connections[workflow_id].discard(client_id)
                if not self.workflow_connections[workflow_id]:
                    del self.workflow_connections[workflow_id]

        remaining_clients = len(self.active_connections)
        logger.info(f"SSE: Removed client {client_id} (Remaining: {remaining_clients})")

    async def get_connection_stats(self):
        """Get comprehensive connection statistics."""
        workflow_stats = {
            workflow_id: len(clients)
            for workflow_id, clients in self.workflow_connections.items()
        }

        return {
            "connected_clients": len(self.active_connections),
            "database_connected": self.connection is not None
            and not self.connection.is_closed(),
            "client_filters": {
                client_id: list(filters)
                for client_id, filters in self.client_filters.items()
            },
            "workflow_subscriptions": workflow_stats,
            "keep_alive_task_running": self._keep_alive_task is not None
            and not self._keep_alive_task.done(),
            "timestamp": datetime.now().isoformat(),
        }

    async def health_check(self):
        try:
            if self.connection and not self.connection.is_closed():
                await self.connection.fetchval("SELECT 1")
                return True
            else:
                return False
        except Exception as e:
            logger.error(f"SSE: Health check failed: {e}")
            return False
