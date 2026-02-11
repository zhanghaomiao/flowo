import uuid
from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from itertools import chain, groupby
from operator import itemgetter
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Error, File, Job, Rule, Status, Workflow
from ..models.enums import FileType
from ..schemas import (
    RuleStatusResponse,
    WorkflowDetialResponse,
    WorkflowListResponse,
    WorkflowResponse,
)
from ..utils.paths import PathContent, get_file_content, path_resolver


class WorkflowService:
    """Service class for workflow-related business logic"""

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session

    async def get_workflow(self, workflow_id: uuid.UUID):
        query = select(Workflow).where(Workflow.id == workflow_id)
        result = await self.db_session.execute(query)
        return result.scalar_one_or_none()

    async def get_flowo_directory(self, workflow_id: uuid.UUID):
        workflow = await self.get_workflow(workflow_id=workflow_id)
        if not workflow or not workflow.directory:
            raise HTTPException(status_code=404, detail="Workflow not found")
        return path_resolver.resolve(workflow.directory)

    async def get_detail(self, workflow_id: uuid.UUID):
        workflow = await self.get_workflow(workflow_id=workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        progress = await self._get_progress(workflow.id)
        return WorkflowDetialResponse(
            **{
                **workflow.__dict__,
                "progress": progress,
                "workflow_id": workflow.id,
                "flowo_directory": workflow.directory,
            }
        )

    async def list_all_workflows(
        self,
        limit: int | None = None,
        offset: int | None = 0,
        order_by_started: bool = True,
        descending: bool = True,
        user: str | None = None,
        status: Status | None = None,
        tags: str | None = None,
        name: str | None = None,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
        user_id: uuid.UUID | None = None,
    ) -> WorkflowListResponse:
        base_query = select(Workflow)
        filters = []
        if user:
            filters.append(Workflow.user == user)

        if user_id:
            filters.append(Workflow.user_id == user_id)

        if status:
            filters.append(Workflow.status == status)

        if tags:
            tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
            for tag in tag_list:
                filters.append(func.array_position(Workflow.tags, tag) > 0)
        if name:
            filters.append(Workflow.name.ilike(f"%{name}%"))

        if start_at:
            filters.append(Workflow.started_at >= str(start_at))

        if end_at:
            filters.append(
                or_(
                    Workflow.end_time.is_(None),  # 仍在运行
                    Workflow.end_time <= str(end_at),  # 已结束，且时间早于end_at
                )
            )

        if filters:
            base_query = base_query.where(and_(*filters))

        count_query = select(func.count(Workflow.id))
        if filters:
            count_query = count_query.where(and_(*filters))

        total_count_result = await self.db_session.execute(count_query)
        total_count = total_count_result.scalar()

        data_query = base_query

        if order_by_started:
            order_column = Workflow.started_at
        else:
            order_column = Workflow.id

        if descending:
            data_query = data_query.order_by(order_column.desc())
        else:
            data_query = data_query.order_by(order_column)

        data_query = data_query.offset(offset).limit(limit)

        result = await self.db_session.execute(data_query)
        workflows = result.scalars().all()

        workflow_responses = []
        for workflow in workflows:
            progress = await self._get_progress(workflow.id)
            run_info = await self.get_workflow_run_info(workflow_id=workflow.id)
            workflow_responses.append(
                WorkflowResponse(
                    **{
                        **workflow.__dict__,
                        "progress": progress,
                        "configfiles": bool(workflow.configfiles),
                        "snakefile": bool(workflow.snakefile),
                        "total_jobs": run_info.get("total", 0),
                    }
                )
            )

        return WorkflowListResponse(
            workflows=workflow_responses,
            offset=offset,
            limit=limit,
            total=total_count,
        )

    async def get_all_users(self) -> list[str]:
        query = (
            select(Workflow.user)
            .distinct()
            .where(Workflow.user.is_not(None))
            .order_by(Workflow.user)
        )
        result = await self.db_session.execute(query)
        users = result.scalars().all()
        return [u for u in users if u is not None]

    async def get_snakefile(self, workflow_id: uuid.UUID) -> PathContent:
        workflow = await self.get_workflow(workflow_id=workflow_id)
        if workflow is None or not workflow.snakefile:
            raise HTTPException(
                status_code=404, detail="Workflow or snakefile not found"
            )
        return get_file_content(workflow.snakefile)

    async def get_workflow_log(self, workflow_id: uuid.UUID) -> PathContent:
        workflow = await self.get_workflow(workflow_id=workflow_id)
        if workflow is None or not workflow.logfile:
            raise HTTPException(
                status_code=404, detail="Workflow or log file not found"
            )
        return get_file_content(workflow.logfile)

    async def get_all_tags(self) -> list[str]:
        query = select(Workflow.tags)
        result = await self.db_session.execute(query)
        tags = result.scalars().all()
        flattened = list(chain.from_iterable(tags))
        return list(set(flattened))

    async def get_configfiles(self, workflow_id: uuid.UUID):
        workflow = await self.get_workflow(workflow_id=workflow_id)

        if not workflow or not workflow.configfiles or not workflow.flowo_working_path:
            raise HTTPException(
                status_code=404, detail="configfiles or workflow not found"
            )

        data = {}
        for configfile in workflow.configfiles:
            try:
                configfile_path = str(configfile).replace(
                    workflow.flowo_working_path, "/work_dir/"
                )
                with open(configfile_path) as f:
                    data[configfile] = f.read()
            except Exception as e:
                data[configfile] = f"Failed to open file: {str(e)}"

        return data

    async def get_progress(self, workflow_id: uuid.UUID):
        # get the total number of jobs, completed jobs, running jobs, failed jobs in one query
        query = select(
            func.sum(case((Job.status == Status.SUCCESS, 1), else_=0)).label(
                "completed"
            ),
            func.sum(case((Job.status == Status.RUNNING, 1), else_=0)).label("running"),
        ).where(Job.workflow_id == workflow_id)

        result = await self.db_session.execute(query)
        row = result.first()

        workflow_run_info = await self.get_workflow_run_info(workflow_id=workflow_id)
        total_jobs = workflow_run_info.get("total", 1)

        if not row:
            completed = 0
            running = 0
        else:
            completed = row.completed or 0
            running = row.running or 0

        return {
            "total": total_jobs,
            "completed": completed,
            "running": running,
        }

    async def _get_progress(self, workflow_id: uuid.UUID):
        result = await self.db_session.execute(
            select(func.count(Job.id)).where(
                Job.workflow_id == workflow_id, Job.status == Status.SUCCESS
            )
        )
        success = result.scalar()

        run_info = await self.get_workflow_run_info(workflow_id=workflow_id)
        if not run_info:
            return 100
        else:
            total = run_info.get("total")
            return round((success / total) * 100) if total else 0

    async def get_workflow_rule_graph_data(
        self, workflow_id: uuid.UUID
    ) -> dict[str, Any]:
        workflow = await self.get_workflow(workflow_id=workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        return workflow.rulegraph_data if workflow.rulegraph_data else {}

    async def get_workflow_run_info(self, workflow_id: uuid.UUID) -> dict[str, Any]:
        workflow = await self.get_workflow(workflow_id=workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        return workflow.run_info if workflow.run_info else {}

    async def get_timelines_with_id(self, workflow_id: uuid.UUID):
        from app.services.job import JobService

        results = []
        rule_name_dict = {}

        job_list_resp = await JobService(self.db_session).get_jobs_by_workflow_id(
            workflow_id=workflow_id, descending=False
        )
        jobs = job_list_resp.jobs

        run_info = await self.get_workflow_run_info(workflow_id=workflow_id)
        if not run_info:
            return []

        for job in jobs:
            rule_name_dict[job.rule_name] = rule_name_dict.get(job.rule_name, 0) + 1
            if job.rule_name:
                rule_name_show = f"{job.rule_name} {rule_name_dict[job.rule_name]}/{run_info.get(job.rule_name)}"
            else:
                rule_name_show = f"{rule_name_dict[job.rule_name]}"
            started_at = job.started_at
            end_time = job.end_time if not job.status == "RUNNING" else datetime.now()

            results.append(
                [job.rule_name, rule_name_show, started_at, end_time, job.status]
            )

        results.sort(key=itemgetter(0))
        grouped_results = groupby(results, key=itemgetter(0))
        grouped_results = [[i[0], list(i[1])] for i in grouped_results]

        sorted_grouped_results = sorted(
            grouped_results, key=lambda group: min(group[1], key=itemgetter(2))[2]
        )

        results = {}
        for rule_name, jobs in sorted_grouped_results:
            results[rule_name] = sorted([job[1:] for job in jobs], key=itemgetter(1))

        return results

    async def get_rule_status(self, workflow_id: uuid.UUID):
        # {rule name : [success, running, error, total, status]}
        from app.services.job import JobService

        run_info = await self.get_workflow_run_info(workflow_id=workflow_id)
        job_list_resp = await JobService(self.db_session).get_jobs_by_workflow_id(
            workflow_id=workflow_id, descending=False
        )
        jobs = job_list_resp.jobs

        stats = defaultdict(Counter)

        for record in jobs:
            rule = record.rule_name
            status = record.status
            stats[rule][status] += 1

        def make_response(k):
            success = stats.get(k, {}).get("SUCCESS", 0)
            running = stats.get(k, {}).get("RUNNING", 0)
            error = stats.get(k, {}).get("ERROR", 0)
            total = run_info.get(k)

            if error:
                status = "ERROR"
            elif success == total:
                status = "SUCCESS"
            elif running == 0:
                status = "WAITING"
            else:
                status = "RUNNING"

            return RuleStatusResponse(
                success=str(success),
                running=str(running),
                error=str(error),
                total=str(total),
                status=status,
            )

        return {k: make_response(k) for k, _ in run_info.items() if k != "total"}

    async def pruning(self, user_id: uuid.UUID):
        # Only delete empty workflows started more than 10 minutes ago
        threshold = datetime.now(UTC) - timedelta(minutes=10)

        # 删除没有任何jobs的workflows
        query = (
            select(Workflow.id)
            .outerjoin(Job, Workflow.id == Job.workflow_id)
            .where(
                Job.id.is_(None),
                Workflow.started_at < threshold,
                Workflow.user_id == user_id,
            )
        )
        result = await self.db_session.execute(query)
        workflows_without_jobs = result.all()

        deleted_workflows_count = len(workflows_without_jobs)
        for (workflow_id,) in workflows_without_jobs:
            from sqlalchemy import delete

            await self.db_session.execute(
                delete(Error).where(Error.workflow_id == workflow_id)
            )
            await self.db_session.execute(
                delete(Workflow).where(Workflow.id == workflow_id)
            )

        # 如果workflow为error且已结束，将其所有running的jobs改为error
        query = (
            select(Job.id)
            .join(Workflow, Job.workflow_id == Workflow.id)
            .where(
                Job.status == Status.RUNNING,
                Workflow.status == Status.ERROR,
                Workflow.end_time.is_not(None),
                Workflow.user_id == user_id,
            )
            .distinct()
        )
        result = await self.db_session.execute(query)
        jobs_to_error = result.all()

        updated_error_jobs_count = len(jobs_to_error)
        for (job_id,) in jobs_to_error:
            from sqlalchemy import update

            await self.db_session.execute(
                update(Job).where(Job.id == job_id).values(status=Status.ERROR)
            )

        # 如果workflow为success且已结束，将其所有的running的jobs改为success
        query = (
            select(Job.id)
            .join(Workflow, Job.workflow_id == Workflow.id)
            .where(
                Job.status == Status.RUNNING,
                Workflow.status == Status.SUCCESS,
                Workflow.end_time.is_not(None),
                Workflow.user_id == user_id,
            )
            .distinct()
        )
        result = await self.db_session.execute(query)
        jobs_to_success = result.all()

        updated_success_jobs_count = len(jobs_to_success)
        for (job_id,) in jobs_to_success:
            from sqlalchemy import update

            await self.db_session.execute(
                update(Job).where(Job.id == job_id).values(status=Status.SUCCESS)
            )

        await self.db_session.commit()

        return {
            "workflow": deleted_workflows_count,
            "job": updated_error_jobs_count + updated_success_jobs_count,
        }

    async def get_rule_outputs(self, workflow_id: uuid.UUID, rule_name: str):
        query = (
            select(File.path)
            .join(Job)
            .join(Rule)
            .where(
                Job.workflow_id == workflow_id,
                Rule.name == rule_name,
                File.file_type == FileType.OUTPUT,
            )
        )
        result = await self.db_session.execute(query)
        return result.scalars().all()

    async def delete_workflow(self, workflow_id: uuid.UUID):
        from sqlalchemy import delete

        await self.db_session.execute(
            delete(Error).where(Error.workflow_id == workflow_id)
        )
        await self.db_session.execute(
            delete(Workflow).where(Workflow.id == workflow_id)
        )
        await self.db_session.commit()

    async def get_workflow_id_by_name(self, workflow_name) -> uuid.UUID | None:
        query = select(Workflow.id).where(Workflow.name == workflow_name)
        result = await self.db_session.execute(query)
        return result.scalars().first()
