import math
from collections import Counter, defaultdict
from datetime import datetime
from typing import Literal

import asyncpg
from sqlalchemy import Float, and_, cast, desc, func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.pg_listener import pg_listener
from ..models import Job, Rule, Workflow
from ..schemas import (
    ServiceStatus,
    StatusSummary,
    SystemHealthResponse,
)


class SummaryService:
    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session

    async def get_status(self, item: Literal["job", "workflow"], user_id=None):
        if item == "workflow":
            stmt = select(
                func.count().label("total"),
                func.count().filter(Workflow.status == "SUCCESS").label("success"),
                func.count().filter(Workflow.status == "ERROR").label("error"),
                func.count().filter(Workflow.status == "RUNNING").label("running"),
            ).where(Workflow.run_info.is_not(None))

            if user_id:
                stmt = stmt.where(Workflow.user_id == user_id)

            result = (await self.db_session.execute(stmt)).one()

            return StatusSummary(
                total=result.total or 0,
                success=result.success or 0,
                error=result.error or 0,
                running=result.running or 0,
            )
        if item == "job":
            stmt = select(
                func.count().filter(Job.status == "SUCCESS").label("success"),
                func.count().filter(Job.status == "ERROR").label("error"),
                func.count().filter(Job.status == "RUNNING").label("running"),
            ).join(Workflow, Job.workflow_id == Workflow.id)

            if user_id:
                stmt = stmt.where(Workflow.user_id == user_id)

            result = (await self.db_session.execute(stmt)).one()

            success = result.success or 0
            error = result.error or 0
            running = result.running or 0

            return StatusSummary(
                total=success + error + running,
                success=success,
                error=error,
                running=running,
            )

    async def get_activity(
        self,
        item: Literal["rule", "user", "tag"],
        start_at: datetime | None,
        end_at: datetime | None,
        limit: int = 20,
        user_id=None,
    ):
        if item == "rule":
            stmt = (
                select(Rule.name, func.count(Job.id).label("job_count"))
                .join(Job, Rule.id == Job.rule_id)
                .join(Workflow, Job.workflow_id == Workflow.id)
                .where(Job.status == "SUCCESS", Rule.name != "all")
                .group_by(Rule.name)
                .order_by(desc("job_count"))
            )

            if user_id:
                stmt = stmt.where(Workflow.user_id == user_id)

            conditions = []
            if start_at:
                conditions.append(Job.started_at >= start_at)
            if end_at:
                conditions.append(Job.started_at <= end_at)
            if conditions:
                stmt = stmt.where(and_(*conditions))

            results = (await self.db_session.execute(stmt.limit(limit))).all()

            return dict(results)

        elif item == "user":
            stmt = (
                select(Workflow.user, func.count(Workflow.id).label("workflow_count"))
                .where(Workflow.run_info.is_not(None))
                .group_by(Workflow.user)
                .order_by(desc("workflow_count"))
            )

            if user_id:
                stmt = stmt.where(Workflow.user_id == user_id)

            conditions = []
            if start_at:
                conditions.append(Workflow.started_at >= start_at)
            if end_at:
                conditions.append(Workflow.started_at <= end_at)
            if conditions:
                stmt = stmt.where(and_(*conditions))

            results = (await self.db_session.execute(stmt.limit(limit))).all()

            return dict(results)

        if item == "tag":
            stmt = select(Workflow).where(Workflow.run_info.is_not(None))

            if user_id:
                stmt = stmt.where(Workflow.user_id == user_id)

            if start_at:
                stmt = stmt.where(Workflow.started_at >= start_at)
            if end_at:
                stmt = stmt.where(Workflow.started_at <= end_at)

            workflows = (await self.db_session.execute(stmt)).scalars().all()

            tag_counter = Counter()
            for wf in workflows:
                if wf.tags:
                    tag_counter.update(wf.tags)

            top_tags = tag_counter.most_common(limit)

            return dict(top_tags)

    async def get_rule_error(
        self,
        start_at: datetime | None,
        end_at: datetime | None,
        limit: int = 20,
        user_id=None,
    ):
        # rule_name, total, error, pct
        conditions = []
        if start_at:
            conditions.append(Job.started_at >= start_at)
        if end_at:
            conditions.append(Job.started_at <= end_at)

        stmt = (
            select(
                Rule.name,
                func.count(Job.id).label("total_jobs"),
                func.count().filter(Job.status == "ERROR").label("error_jobs"),
                (
                    cast(func.count().filter(Job.status == "ERROR"), Float)
                    / func.count(Job.id)
                ).label("error_ratio"),
            )
            .join(Job, Rule.id == Job.rule_id)
            .join(Workflow, Job.workflow_id == Workflow.id)
            .group_by(Rule.name)
            .order_by(desc("error_ratio"))
            .limit(limit)
        )

        if user_id:
            stmt = stmt.where(Workflow.user_id == user_id)

        if conditions:
            stmt = stmt.where(and_(*conditions))

        results = (await self.db_session.execute(stmt)).all()

        return {
            rule_name: {"total": total, "error": error}
            for rule_name, total, error, _ in results
            if error
        }

    async def get_rule_duration(
        self,
        start_at: datetime | None,
        end_at: datetime | None,
        limit: int = 20,
        user_id=None,
    ):
        # max, min, q4, q1, media
        conditions = [
            Job.status == "SUCCESS",
            Job.end_time.is_not(None),
            Rule.name != "all",
        ]
        if start_at:
            conditions.append(Job.started_at >= start_at)
        if end_at:
            conditions.append(Job.started_at <= end_at)

        duration_expr = func.extract("epoch", Job.end_time - Job.started_at)
        stmt_avg = (
            select(
                Rule.name, func.avg(cast(duration_expr, Float)).label("avg_duration")
            )
            .join(Job, Rule.id == Job.rule_id)
            .join(Workflow, Job.workflow_id == Workflow.id)
            .where(and_(*conditions))
            .group_by(Rule.name)
            .order_by(func.avg(cast(duration_expr, Float)).desc())
            .limit(limit)
        )

        if user_id:
            stmt_avg = stmt_avg.where(Workflow.user_id == user_id)

        result_avg = await self.db_session.execute(stmt_avg)
        top_rules = [r[0] for r in result_avg.all()]
        if not top_rules:
            return {}
        stmt_details = (
            select(
                Rule.name,
                func.min(cast(duration_expr, Float)).label("min_duration"),
                func.percentile_cont(0.25)
                .within_group(cast(duration_expr, Float))
                .label("q1_duration"),
                func.percentile_cont(0.5)
                .within_group(cast(duration_expr, Float))
                .label("median_duration"),
                func.percentile_cont(0.75)
                .within_group(cast(duration_expr, Float))
                .label("q3_duration"),
                func.max(cast(duration_expr, Float)).label("max_duration"),
            )
            .join(Job, Rule.id == Job.rule_id)
            .join(Workflow, Job.workflow_id == Workflow.id)
            .where(and_(*conditions, Rule.name.in_(top_rules)))
            .group_by(Rule.name)
        )

        if user_id:
            stmt_details = stmt_details.where(Workflow.user_id == user_id)

        result_details = await self.db_session.execute(stmt_details)
        results = result_details.all()

        durations_map = defaultdict(dict)
        for result in results:
            (
                rule_name,
                min_duration,
                q1_duration,
                median_duration,
                q3_duration,
                max_duration,
            ) = result

            iqr_duration = q3_duration - q1_duration
            max_ = q3_duration + 1.5 * iqr_duration
            min_ = q1_duration - 1.5 * iqr_duration

            if max_ < max_duration:
                max_duration = max_

            if min_ > min_duration:
                min_duration = min_

            durations_map[rule_name] = {
                "q1": round(math.log(q1_duration / 60 + 1), 2),
                "median": round(math.log(median_duration / 60 + 1), 2),
                "q3": round(math.log(q3_duration / 60 + 1), 2),
                "max": round(math.log(max_duration / 60 + 1), 2),
                "min": round(math.log(min_duration / 60 + 1), 2),
            }

        sorted_durations_map = dict(
            sorted(
                durations_map.items(),
                key=lambda item: item[1]["median"],
                reverse=True,
            )
        )
        return sorted_durations_map

    async def check_database_health(self) -> ServiceStatus:
        """检查数据库连接状态"""
        try:
            result = (
                await self.db_session.execute(text("SELECT 1 as test"))
            ).fetchone()
            if result and result[0] == 1:
                return ServiceStatus(
                    name="database",
                    status="healthy",
                    message="Database connection is healthy",
                    details={"connection": "ok"},
                )
            else:
                return ServiceStatus(
                    name="database",
                    status="unhealthy",
                    message="Database query failed",
                    details={"connection": "query_failed"},
                )
        except SQLAlchemyError as e:
            return ServiceStatus(
                name="database",
                status="unhealthy",
                message=f"Database connection error: {str(e)}",
                details={"error": str(e)},
            )
        except Exception as e:
            return ServiceStatus(
                name="database",
                status="unknown",
                message=f"Unexpected error: {str(e)}",
                details={"error": str(e)},
            )

    async def check_sse_health(self) -> ServiceStatus:
        """检查SSE服务状态"""
        try:
            # 检查pg_listener是否已经连接
            if pg_listener._connection is None:
                return ServiceStatus(
                    name="sse",
                    status="unhealthy",
                    message="SSE listener is not connected to database",
                    details={"connection": "disconnected"},
                )

            # 尝试执行一个简单的监听测试
            # 这里我们检查连接是否仍然活跃
            try:
                # 执行一个简单的查询来测试连接
                result = await pg_listener._connection.fetchval("SELECT 1")
                if result == 1:
                    return ServiceStatus(
                        name="sse",
                        status="healthy",
                        message="SSE service is healthy and connected",
                        details={
                            "connection": "ok",
                            "listeners": len(pg_listener._listening_channels),
                        },
                    )
                else:
                    return ServiceStatus(
                        name="sse",
                        status="unhealthy",
                        message="SSE connection test failed",
                        details={"connection": "test_failed"},
                    )
            except asyncpg.exceptions.InterfaceError:
                return ServiceStatus(
                    name="sse",
                    status="unhealthy",
                    message="SSE database connection lost",
                    details={"connection": "lost"},
                )
            except Exception as e:
                return ServiceStatus(
                    name="sse",
                    status="unhealthy",
                    message=f"SSE connection error: {str(e)}",
                    details={"error": str(e)},
                )

        except Exception as e:
            return ServiceStatus(
                name="sse",
                status="unknown",
                message=f"SSE check failed: {str(e)}",
                details={"error": str(e)},
            )

    async def get_system_health(self) -> SystemHealthResponse:
        """获取系统整体健康状态"""
        # 异步检查数据库
        db_status = await self.check_database_health()
        sse_status = await self.check_sse_health()

        # 确定整体状态
        services = [db_status, sse_status]
        if all(s.status == "healthy" for s in services):
            overall_status = "healthy"
        elif any(s.status == "unhealthy" for s in services):
            overall_status = "unhealthy"
        else:
            overall_status = "degraded"

        return SystemHealthResponse(
            database=db_status, sse=sse_status, overall_status=overall_status
        )
