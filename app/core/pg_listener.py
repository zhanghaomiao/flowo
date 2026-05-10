import asyncio
import json
from collections import defaultdict
from collections.abc import AsyncGenerator

import asyncpg
from fastapi import Request
from fastapi.logger import logger
from sse_starlette.event import ServerSentEvent

from ..core.config import settings


class PGListener:
    def __init__(self):
        self.db_url = str(settings.SQLALCHEMY_DATABASE_URI)
        self._connection: asyncpg.Connection | None = None
        self._lock = asyncio.Lock()
        self._stop_event = asyncio.Event()

        self._subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)
        self._listening_channels: set[str] = set()

        self._reconnect_count = 0
        self._dropped_notifications_total = 0
        self._dropped_by_channel: dict[str, int] = defaultdict(int)

    def stats(self) -> dict:
        """Read-only metrics for health checks and ops."""
        subscriber_queues: set[asyncio.Queue] = set()
        for qs in self._subscribers.values():
            subscriber_queues.update(qs)
        return {
            "reconnect_count": self._reconnect_count,
            "dropped_notifications_total": self._dropped_notifications_total,
            "dropped_by_channel": dict(self._dropped_by_channel),
            "listening_channel_count": len(self._listening_channels),
            "active_subscriber_queues": len(subscriber_queues),
        }

    async def connect(self):
        """建立监听专用连接"""
        try:
            self._connection = await asyncpg.connect(self.db_url)
            logger.info("SSE: PGListener connected to database")
        except Exception as e:
            logger.error(f"SSE: Connection failed: {e}")
            raise

    async def disconnect(self):
        """清理资源"""
        self._stop_event.set()
        if self._connection:
            try:
                await self._connection.close()
                logger.info("SSE: PGListener disconnected")
            except Exception as e:
                logger.error(f"SSE: Error closing connection: {e}")
            finally:
                self._connection = None
                self._listening_channels.clear()

    async def _reconnect_unlocked(self) -> None:
        """Replace dead connection and re-LISTEN all channels that still have subscribers."""
        if self._connection and not self._connection.is_closed():
            try:
                await self._connection.close()
            except Exception:
                pass
        self._connection = None
        self._listening_channels.clear()

        delay = 1.0
        last_err: Exception | None = None
        for attempt in range(10):
            try:
                self._connection = await asyncpg.connect(self.db_url)
                self._reconnect_count += 1
                logger.info(
                    "SSE: PGListener reconnected (attempt %s, total_reconnects=%s)",
                    attempt + 1,
                    self._reconnect_count,
                )
                for channel in list(self._subscribers.keys()):
                    if not self._subscribers[channel]:
                        continue
                    await self._connection.add_listener(channel, self._on_notification)
                    self._listening_channels.add(channel)
                return
            except Exception as e:
                last_err = e
                logger.warning(
                    "SSE: reconnect attempt %s failed: %s; retry in %.1fs",
                    attempt + 1,
                    e,
                    delay,
                )
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30.0)

        logger.error("SSE: PGListener reconnect exhausted: %s", last_err)
        raise last_err or RuntimeError("PGListener reconnect failed")

    async def _ensure_live_connection_unlocked(self) -> None:
        """Verify ``SELECT 1`` on current connection; reconnect + restore LISTEN if needed."""
        healthy = False
        if self._connection and not self._connection.is_closed():
            try:
                r = await asyncio.wait_for(
                    self._connection.fetchval("SELECT 1"), timeout=2.0
                )
                healthy = r == 1
            except Exception as e:
                logger.warning("SSE: listener connection probe failed: %s", e)
                healthy = False
        if healthy:
            return
        await self._reconnect_unlocked()

    async def refresh_connection_for_health(self) -> bool:
        """Best-effort reconnect when health check sees a dead connection."""
        async with self._lock:
            try:
                await self._ensure_live_connection_unlocked()
                return True
            except Exception as e:
                logger.error("SSE: health-triggered reconnect failed: %s", e)
                return False

    def _on_notification(self, conn, pid, channel, payload):
        """
        数据库回调：收到消息，分发给订阅了该 channel 的所有队列
        """
        if channel in self._subscribers:
            for queue in list(self._subscribers[channel]):
                try:
                    queue.put_nowait({"channel": channel, "payload": payload})
                except asyncio.QueueFull:
                    self._dropped_notifications_total += 1
                    self._dropped_by_channel[channel] += 1
                    logger.warning(
                        "SSE: dropped NOTIFY (queue full) channel=%s total_dropped=%s",
                        channel,
                        self._dropped_notifications_total,
                    )

    async def listen(self, channels: list[str], request: Request) -> AsyncGenerator:
        """
        供 API 调用的核心生成器 (支持批量订阅)
        """
        queue = asyncio.Queue(maxsize=100)

        unique_channels = set(channels)

        async with self._lock:
            await self._ensure_live_connection_unlocked()

            if not self._connection or self._connection.is_closed():
                logger.error("SSE: Database connection is missing or closed")
                raise Exception("Database connection unavailable")

            for channel in unique_channels:
                self._subscribers[channel].add(queue)

                if (
                    channel not in self._listening_channels
                    and self._connection
                    and not self._connection.is_closed()
                ):
                    try:
                        await self._connection.add_listener(
                            channel, self._on_notification
                        )
                        self._listening_channels.add(channel)
                        logger.debug(f"SSE: Started listening on DB channel: {channel}")
                    except Exception as e:
                        logger.error(f"SSE: Failed to LISTEN {channel}: {e}")
                        raise e

        try:
            yield ServerSentEvent(event="connected", data="ok")

            while True:
                if await request.is_disconnected():
                    break

                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)

                    payload_obj = json.loads(data["payload"])
                    yield ServerSentEvent(
                        event="message",
                        data=json.dumps(payload_obj),
                        id=str(payload_obj.get("timestamp")),
                    )
                except TimeoutError:
                    try:
                        async with self._lock:
                            await self._ensure_live_connection_unlocked()
                    except Exception as e:
                        logger.error("SSE: heartbeat reconnect failed: %s", e)
                    yield ServerSentEvent(comment="heartbeat")
                except Exception as e:
                    logger.error(f"SSE: Error yielding data: {e}")

        finally:
            async with self._lock:
                for channel in unique_channels:
                    if channel in self._subscribers:
                        self._subscribers[channel].discard(queue)

                        if not self._subscribers[channel]:
                            if self._connection and channel in self._listening_channels:
                                try:
                                    await self._connection.remove_listener(
                                        channel, self._on_notification
                                    )
                                    self._listening_channels.discard(channel)
                                except Exception:
                                    pass

            logger.debug(f"SSE: Client disconnected from channels: {unique_channels}")


# 全局单例
pg_listener = PGListener()
