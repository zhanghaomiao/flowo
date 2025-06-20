import uuid
from fastapi import HTTPException
from itertools import chain
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import select, func, case
from typing import List, Optional, Dict, Any
import os
from fastapi.responses import JSONResponse
from sqlalchemy import and_
from ..models import Job, Status, Workflow, Error
from ..schemas import (
    WorkflowResponse,
    WorkflowListResponse,
    WorkflowDetialResponse,
    RuleStatusResponse,
    TreeDataNode,
)
from datetime import datetime
from operator import itemgetter
from itertools import groupby
from collections import defaultdict, Counter
from ..core.config import settings
import logging
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

    def get_detail(self, workflow_id):
        query = select(Workflow).where(Workflow.id == workflow_id)
        wf = self.db_session.execute(query).scalar_one_or_none()
        if not wf:
            raise HTTPException(status_code=404, detail="Workflow not found")
        return WorkflowDetialResponse(
            **{
                **wf.__dict__,
                "progress": self._get_progress(wf.id),
                "workflow_id": wf.id,
            }
        )

    def list_all_workflows_dev(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = 0,
        order_by_started: bool = True,
        descending: bool = True,
        user: Optional[str] = None,
        status: Optional[Status] = None,
        tags: Optional[str] = None,
        name: Optional[str] = None,
        start_at: Optional[str] = None,
        end_at: Optional[str] = None,
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
            filters.append(Workflow.started_at >= start_at)

        if end_at:
            filters.append(Workflow.end_time <= end_at)

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
                        **wf.__dict__,
                        "progress": self._get_progress(wf.id),
                        "configfiles": bool(wf.configfiles),
                        "snakefile": bool(wf.snakefile),
                    }
                )
                for wf in workflows
            ],
            offset=offset,
            limit=limit,
            total=total_count,
        )

    # def list_all_workflows(
    #     self,
    #     limit: Optional[int] = None,
    #     offset: Optional[int] = 0,
    #     order_by_started: bool = True,
    #     descending: bool = True,
    #     user: Optional[str] = None,
    #     status: Optional[Status] = None,
    #     tags: Optional[str] = None,
    #     start_at: Optional[str] = None,
    #     end_at: Optional[str] = None,
    # ) -> WorkflowListResponse:

    #     # Build the query for fetching workflows
    #     query = select(Workflow)
    #     filters = []

    #     if order_by_started:
    #         order_column = Workflow.started_at
    #     else:
    #         order_column = Workflow.id  # type: ignore

    #     if descending:
    #         query = query.order_by(order_column.desc())
    #     else:
    #         query = query.order_by(order_column)

    #     if user:
    #         filters.append(Workflow.user == user)

    #     if status:
    #         filters.append(Workflow.status == status)

    #     if start_at:
    #         filters.append(Workflow.started_at >= start_at)

    #     if end_at:
    #         filters.append(Workflow.end_time <= end_at)

    #     if filters:
    #         query = query.filter(and_(*filters))

    #     # if has filter, count the number of workflow has been filtered
    #     count_query = select(func.count()).select_from(Workflow)
    #     if user:
    #         count_query = count_query.filter(Workflow.user == user)
    #     if status:
    #         count_query = count_query.filter(Workflow.status == status)
    #     total_workflows = self.db_session.execute(count_query).scalar() or 0

    #     # Apply pagination to the main query
    #     if offset:
    #         query = query.offset(offset)

    #     if limit is not None:
    #         query = query.limit(limit)

    #     # Execute the query
    #     workflows = list(self.db_session.execute(query).scalars())

    #     # Convert to Pydantic models for serialization
    #     workflow_responses = [
    #         WorkflowResponse(
    #             id=str(wf.id),
    #             snakefile=bool(wf.snakefile),
    #             started_at=wf.started_at.isoformat() if wf.started_at else None,
    #             end_time=wf.end_time.isoformat() if wf.end_time else None,
    #             status=wf.status.value if hasattr(wf.status, "value") else wf.status,
    #             command_line=wf.command_line,
    #             dryrun=wf.dryrun,
    #             user=wf.user,
    #             name=wf.name,
    #             configfiles=bool(wf.configfiles),
    #             directory=wf.directory,
    #             run_info=wf.run_info,
    #             logfile=wf.logfile,
    #             tags=wf.tags,
    #             progress=self._get_progress(wf.id),
    #         )
    #         for wf in workflows
    #     ]

    #     # Return the response with workflows and pagination info
    #     return WorkflowListResponse(
    #         workflows=workflow_responses,
    #         total=total_workflows,
    #         limit=limit or 0,
    #         offset=offset,
    #     )

    def get_all_users(self) -> list[str]:
        query = select(Workflow.user).distinct().where(Workflow.user.is_not(None))
        return list(self.db_session.execute(query).scalars())

    def get_snakefile(self, workflow_id: uuid.UUID) -> str:
        wf = self.db_session.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        ).scalar_one_or_none()

        if wf.flowo_working_path:
            snakefile = str(wf.snakefile).replace(wf.flowo_working_path, "/work_dir/")
        else:
            snakefile = wf.snakefile

        if os.path.exists(snakefile):
            try:
                with open(snakefile, "r") as f:
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
        wf = self.db_session.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        ).scalar_one_or_none()
        if not wf.configfiles or not wf.flowo_working_path:
            raise HTTPException(status_code=404, detail="configfiles not found")

        data = {}
        for configfile in wf.configfiles:
            try:
                configfile_path = str(configfile).replace(wf.flowo_working_path, "/work_dir/")
                with open(configfile_path, "r") as f:
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

        return {
            "total": self.get_workflow_run_info(workflow_id=workflow_id).get("total"),
            "completed": result.completed or 0,
            "running": result.running or 0,
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

    def get_workflow_rule_graph_data(self, workflow_id: uuid.UUID) -> Dict[str, Any]:
        """
        Get the rule graph for a workflow
        """
        workflow = self.db_session.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        ).scalar_one_or_none()
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # res = self.convert_rule_graph_to_dag(workflow.rulegraph_data)

        return workflow.rulegraph_data

    def get_workflow_run_info(self, workflow_id: uuid.UUID) -> Dict[str, Any]:
        """
        Get the run information for a workflow
        """
        workflow = self.db_session.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        ).scalar_one_or_none()
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        return workflow.run_info

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
        workflow = self.db_session.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        ).scalar_one_or_none()

        if not workflow.flowo_working_path or not workflow.directory:
            pass

        directory = workflow.directory.replace(workflow.flowo_working_path, "/work_dir/")
        return build_tree_with_anytree(directory, max_depth=max_depth)

    def delete_workflow(self, workflow_id: uuid.UUID):
        self.db_session.query(Error).filter(Error.workflow_id == workflow_id).delete()
        self.db_session.query(Workflow).filter(Workflow.id == workflow_id).delete()
        self.db_session.commit()
