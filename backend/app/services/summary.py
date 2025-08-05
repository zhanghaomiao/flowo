from collections import Counter, defaultdict
from datetime import datetime
import math
from datetime import datetime
from typing import Literal


from sqlalchemy import select, func, desc, and_, cast, Float, distinct
from sqlalchemy.orm import Session

from ..models import Job, Workflow, Rule
from ..schemas import (
    StatusSummary,
    UserSummary,
)


class SummaryService:
    def __init__(self, db_session: Session):
        self.db_session = db_session

    def get_user_summary(self):
        stmt_all_users = select(func.count(distinct(Workflow.user))).where(
            Workflow.run_info.is_not(None)
        )
        total_users = self.db_session.execute(stmt_all_users).scalar()

        stmt_running_users = select(func.count(distinct(Workflow.user))).where(
            and_(Workflow.run_info.is_not(None), Workflow.status == "RUNNING")
        )
        running_users = self.db_session.execute(stmt_running_users).scalar()

        return UserSummary(total=total_users or 0, running=running_users or 0)

    def get_status(self, item: Literal["job", "workflow"]):
        if item == "workflow":
            stmt = select(
                func.count().label("total"),
                func.count().filter(Workflow.status == "SUCCESS").label("success"),
                func.count().filter(Workflow.status == "ERROR").label("error"),
                func.count().filter(Workflow.status == "RUNNING").label("running"),
            ).where(Workflow.run_info.is_not(None))

            result = self.db_session.execute(stmt).one()

            return StatusSummary(
                total=result.total or 0,
                success=result.success or 0,
                error=result.error or 0,
                running=result.running or 0,
            )
        if item == "job":
            stmt = select(Workflow).where(Workflow.run_info.is_not(None))
            workflows = self.db_session.execute(stmt).scalars().all()
            total = sum(
                [wf.run_info.get("total", 0) for wf in workflows if wf.run_info]
            )
            stmt = select(
                # func.count().label("total"),
                func.count().filter(Job.status == "SUCCESS").label("success"),
                func.count().filter(Job.status == "ERROR").label("error"),
                func.count().filter(Job.status == "RUNNING").label("running"),
            )
            result = self.db_session.execute(stmt).one()

            success = result.success or 0
            error = result.error or 0
            running = result.running or 0

            return StatusSummary(
                total=success + error + running,
                success=success,
                error=error,
                running=running,
            )

    def get_activity(
        self,
        item: Literal["rule", "user", "tag"],
        start_at: datetime | None,
        end_at: datetime | None,
        limit: int = 20,
    ):
        if item == "rule":
            stmt = (
                select(Rule.name, func.count(Job.id).label("job_count"))
                .join(Job, Rule.id == Job.rule_id)
                .where(Job.status == "SUCCESS", Rule.name != "all")
                .group_by(Rule.name)
                .order_by(desc("job_count"))
            )

            conditions = []
            if start_at:
                conditions.append(Job.started_at >= start_at)
            if end_at:
                conditions.append(Job.started_at <= end_at)
            if conditions:
                stmt = stmt.where(and_(*conditions))

            results = self.db_session.execute(stmt.limit(limit)).all()

            return {name: count for name, count in results}

        elif item == "user":
            stmt = (
                select(Workflow.user, func.count(Workflow.id).label("workflow_count"))
                .where(Workflow.run_info.is_not(None))
                .group_by(Workflow.user)
                .order_by(desc("workflow_count"))
            )
            conditions = []
            if start_at:
                conditions.append(Workflow.started_at >= start_at)
            if end_at:
                conditions.append(Workflow.started_at <= end_at)
            if conditions:
                stmt = stmt.where(and_(*conditions))

            results = self.db_session.execute(stmt.limit(limit)).all()

            return {user: count for user, count in results}

        if item == "tag":
            stmt = select(Workflow).where(Workflow.run_info.is_not(None))
            if start_at:
                stmt = stmt.where(Workflow.started_at >= start_at)
            if end_at:
                stmt = stmt.where(Workflow.started_at <= end_at)

            workflows = self.db_session.execute(stmt).scalars().all()

            tag_counter = Counter()
            for wf in workflows:
                if wf.tags:
                    tag_counter.update(wf.tags)

            top_tags = tag_counter.most_common(limit)

            return {tag: count for tag, count in top_tags}

    def get_rule_error(
        self,
        start_at: datetime | None,
        end_at: datetime | None,
        limit: int = 20,
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
            .group_by(Rule.name)
            .order_by(desc("error_ratio"))
            .limit(limit)
        )

        if conditions:
            stmt = stmt.where(and_(*conditions))

        results = self.db_session.execute(stmt).all()

        return {
            rule_name: {"total": total, "error": error}
            for rule_name, total, error, _ in results
            if error
        }

    def get_rule_duration(
        self,
        start_at: datetime | None,
        end_at: datetime | None,
        limit: int = 20,
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
            .where(and_(*conditions))
            .group_by(Rule.name)
            .order_by(func.avg(cast(duration_expr, Float)).desc())
            .limit(limit)
        )

        top_rules = [r[0] for r in self.db_session.execute(stmt_avg).all()]
        if not top_rules:
            return []
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
            .where(and_(*conditions, Rule.name.in_(top_rules)))
            .group_by(Rule.name)
        )

        results = self.db_session.execute(stmt_details).all()

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

        sorted_durations_map = {
            k: v
            for k, v in sorted(
                durations_map.items(),
                key=lambda item: item[1]["median"],
                reverse=True,
            )
        }
        return sorted_durations_map
