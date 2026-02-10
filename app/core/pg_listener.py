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

    async def connect(self):
        """建立监听专用连接"""
        try:
            # 1. 建立连接
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

    def _on_notification(self, conn, pid, channel, payload):
        """
        数据库回调：收到消息，分发给订阅了该 channel 的所有队列
        """
        # logger.info(f"SSE: Received notification on channel '{channel}': {payload}")
        if channel in self._subscribers:
            # 复制一份 list 进行遍历，防止遍历期间 set 被修改
            for queue in list(self._subscribers[channel]):
                try:
                    queue.put_nowait({"channel": channel, "payload": payload})
                except asyncio.QueueFull:
                    # 队列满保护：简单丢弃最新消息（背压保护）
                    pass

    async def listen(self, channels: list[str], request: Request) -> AsyncGenerator:
        """
        供 API 调用的核心生成器 (支持批量订阅)
        """
        queue = asyncio.Queue(maxsize=100)

        if not self._connection or self._connection.is_closed():
            logger.error("SSE: Database connection is missing or closed")
            raise Exception("Database connection unavailable")

        unique_channels = set(channels)

        async with self._lock:
            for channel in unique_channels:
                # 1. 注册订阅 (Python 内存路由表)
                self._subscribers[channel].add(queue)

                # 只有当这个频道从未被监听过时，才向 asyncpg 和 数据库 注册
                # 必须检查连接是否存在且未关闭
                if (
                    channel not in self._listening_channels
                    and self._connection
                    and not self._connection.is_closed()
                ):
                    try:
                        # A. 向 asyncpg 注册回调 (Python 侧)
                        # 告诉 asyncpg: 如果收到这个 channel 的消息，请调用 _on_notification
                        await self._connection.add_listener(
                            channel, self._on_notification
                        )
                        self._listening_channels.add(channel)
                        logger.debug(f"SSE: Started listening on DB channel: {channel}")
                    except Exception as e:
                        logger.error(f"SSE: Failed to LISTEN {channel}: {e}")
                        raise e

        try:
            # 发送连接成功消息
            yield ServerSentEvent(event="connected", data="ok")

            while True:
                if await request.is_disconnected():
                    break

                try:
                    # 等待消息，设置超时用于心跳
                    # 任何一个订阅频道的消息都会进入这个 queue
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)

                    # 解析 JSON
                    payload_obj = json.loads(data["payload"])
                    yield ServerSentEvent(
                        event="message",
                        data=json.dumps(payload_obj),
                        id=str(payload_obj.get("timestamp")),
                    )
                except TimeoutError:
                    yield ServerSentEvent(comment="heartbeat")
                except Exception as e:
                    logger.error(f"SSE: Error yielding data: {e}")

        finally:
            # 清理逻辑
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
                                    # await self._connection.execute(f'UNLISTEN "{channel}"') # 保持注释
                                except Exception:
                                    pass

            logger.debug(f"SSE: Client disconnected from channels: {unique_channels}")


# 全局单例
pg_listener = PGListener()
