import code
import os
import uuid
from collections import Counter, defaultdict
from datetime import datetime
from itertools import chain, groupby
from operator import itemgetter
from typing import Any
from datetime import datetime

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from pydantic_core.core_schema import filter_seq_schema
from sqlalchemy import and_, case, func, select, or_
from sqlalchemy.orm import Session

from ..models import Error, Job, Status, Workflow
from ..schemas import (
    RuleStatusResponse,
    TreeDataNode,
    WorkflowDetialResponse,
    WorkflowListResponse,
    WorkflowResponse,
)
from ..services.file_tree import build_tree_with_anytree


class WorkflowService:
    """Service class for workflow-related business logic"""

    def __init__(self, db_session: Session):
        self.db_session = db_session

    def validate_workflow_exists(self, workflow_id: uuid.UUID) -> None:
        """
        Validate that a workflow exists

        Args:
            workflow_id: UUID of the workflow to validate

        Raises:
            HTTPException: If the workflow does not exist
        """
        query = select(Workflow).where(Workflow.id == workflow_id)
        workflow = self.db_session.execute(query).scalars().first()

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

    def get_workflow(self, workflow_id: uuid.UUID):
        query = select(Workflow).where(Workflow.id == workflow_id)
        workflow = self.db_session.execute(query).scalar_one_or_none()
        return workflow

    def get_flowo_directory(self, workflow_id: uuid.UUID):
        workflow = self.get_workflow(workflow_id=workflow_id)
        if workflow and workflow.flowo_working_path and workflow.directory:
            return workflow.directory.replace(workflow.flowo_working_path, "/work_dir")

    def get_detail(self, workflow_id: uuid.UUID):
        workflow = self.get_workflow(workflow_id=workflow_id)
        if not workflow:
            return

        flowo_directory = self.get_flowo_directory(workflow_id=workflow_id)
        if flowo_directory:
            flowo_directory = flowo_directory.replace("/work_dir", "")

        return WorkflowDetialResponse(
            **{
                **workflow.__dict__,
                "progress": self._get_progress(workflow.id),
                "workflow_id": workflow.id,
                "flowo_directory": flowo_directory,
            }
        )

    def list_all_workflows(
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
    ) -> WorkflowListResponse:
        base_query = select(Workflow)
        filters = []
        if user:
            filters.append(Workflow.user == user)

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
                    Workflow.end_time == None,  # 仍在运行
                    Workflow.end_time <= str(end_at),  # 已结束，且时间早于end_at
                )
            )

        if filters:
            base_query = base_query.where(and_(*filters))

        count_query = select(func.count(Workflow.id))
        if filters:
            count_query = count_query.where(and_(*filters))

        total_count = self.db_session.execute(count_query).scalar()

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

        result = self.db_session.execute(data_query)
        workflows = result.scalars().all()

        return WorkflowListResponse(
            workflows=[
                WorkflowResponse(
                    **{
                        **workflow.__dict__,
                        "progress": self._get_progress(workflow.id),
                        "configfiles": bool(workflow.configfiles),
                        "snakefile": bool(workflow.snakefile),
                    }
                )
                for workflow in workflows
            ],
            offset=offset,
            limit=limit,
            total=total_count,
        )

    def get_all_users(self) -> list[str]:
        query = select(Workflow.user).distinct().where(Workflow.user.is_not(None))
        return list(self.db_session.execute(query).scalars())

    def get_snakefile(self, workflow_id: uuid.UUID) -> str | JSONResponse:
        workflow = self.get_workflow(workflow_id=workflow_id)

        if workflow is None:
            return JSONResponse(
                status_code=404,
                content={"error": "Workflow not found"},
            )

        if workflow.flowo_working_path:
            snakefile = str(workflow.snakefile).replace(
                workflow.flowo_working_path, "/work_dir/"
            )
        else:
            snakefile = workflow.snakefile

        if snakefile and os.path.exists(snakefile):
            try:
                with open(snakefile) as f:
                    file_content = f.read()
                return file_content
            except Exception as e:
                return JSONResponse(
                    status_code=500, content={"error": f"Failed to read file: {str(e)}"}
                )
        else:
            return JSONResponse(
                status_code=404,
                content={"error": "Snakefile not found, please set flowo_working_path"},
            )

    def get_all_tags(self) -> list[str]:
        query = select(Workflow.tags)
        tags = self.db_session.execute(query).scalars()
        flattened = list(chain.from_iterable(tags))
        return list(set(flattened))

    def get_configfiles(self, workflow_id: uuid.UUID):
        workflow = self.get_workflow(workflow_id=workflow_id)

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

    def get_progress(self, workflow_id: uuid.UUID):
        # get the total number of jobs, completed jobs, running jobs, failed jobs in one query
        result = self.db_session.execute(
            select(
                func.sum(case((Job.status == Status.SUCCESS, 1), else_=0)).label(
                    "completed"
                ),
                func.sum(case((Job.status == Status.RUNNING, 1), else_=0)).label(
                    "running"
                ),
            ).where(Job.workflow_id == workflow_id)
        ).first()

        workflow_run_info = self.get_workflow_run_info(workflow_id=workflow_id)
        total_jobs = workflow_run_info.get("total", 0)

        if not result:
            completed = 0
            running = 0
        else:
            completed = result.completed or 0
            running = result.running or 0

        return {
            "total": total_jobs,
            "completed": completed,
            "running": running,
        }

    def _get_progress(self, workflow_id: uuid.UUID):
        success = self.db_session.scalar(
            select(func.count(Job.id)).where(
                Job.workflow_id == workflow_id, Job.status == Status.SUCCESS
            )
        )

        if not self.get_workflow_run_info(workflow_id=workflow_id):
            return 100
        else:
            total = self.get_workflow_run_info(workflow_id=workflow_id).get("total")
            return round((success / total) * 100) if total else 0

    def get_workflow_rule_graph_data(self, workflow_id: uuid.UUID) -> dict[str, Any]:

        workflow = self.get_workflow(workflow_id=workflow_id)
        if not workflow:
            return {}

        return workflow.rulegraph_data if workflow.rulegraph_data else {}

    def get_workflow_run_info(self, workflow_id: uuid.UUID) -> dict[str, Any]:

        workflow = self.get_workflow(workflow_id=workflow_id)
        if not workflow:
            return {}

        return workflow.run_info if workflow.run_info else {}

    def get_timelines_with_id(self, workflow_id: uuid.UUID):
        # rule_name: [[rule name show, started at, end time, status] ...]
        from app.services.job import JobService

        results = []
        rule_name_dict = {}

        jobs = (
            JobService(self.db_session)
            .get_jobs_by_workflow_id(workflow_id=workflow_id, descending=False)
            .jobs
        )

        run_info = self.get_workflow_run_info(workflow_id=workflow_id)
        for job in jobs:
            # if job.rule_name == "all":
            #     continue

            rule_name_dict[job.rule_name] = rule_name_dict.get(job.rule_name, 0) + 1
            rule_name_show = f"{job.rule_name} {rule_name_dict[job.rule_name]}/{run_info[job.rule_name]}"

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

    def get_rule_status(self, workflow_id: uuid.UUID):
        # {rule name : [success, running, error, total, status]}
        from app.services.job import JobService

        run_info = self.get_workflow_run_info(workflow_id=workflow_id)
        jobs = (
            JobService(self.db_session)
            .get_jobs_by_workflow_id(workflow_id=workflow_id, descending=False)
            .jobs
        )

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

    def get_outputs(
        self,
        workflow_id: uuid.UUID,
        max_depth: int = 2,
    ) -> list[TreeDataNode]:

        directory = self.get_flowo_directory(workflow_id=workflow_id)
        if not directory:
            raise HTTPException(status_code=404, detail="directory not found")

        return build_tree_with_anytree(directory, max_depth=max_depth)

    def delete_workflow(self, workflow_id: uuid.UUID):
        self.db_session.query(Error).filter(Error.workflow_id == workflow_id).delete()
        self.db_session.query(Workflow).filter(Workflow.id == workflow_id).delete()
        self.db_session.commit()
