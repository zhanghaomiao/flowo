import logging
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from ...core.config import settings
from ...models import Catalog, Error, File, Job, Rule, Workflow
from ...models.enums import FileType, Status
from ...services.catalog.utils import catalog_readable_by_user
from ...services.notification import notify_workflow_failure, notify_workflow_submitted
from ..schemas import (
    ErrorSchema,
    GroupErrorSchema,
    GroupInfoSchema,
    JobErrorSchema,
    JobFinishedSchema,
    JobInfoSchema,
    JobStartedSchema,
    RuleGraphSchema,
    RunInfoSchema,
    WorkflowStartedSchema,
)
from .base import BaseEventHandler

logger = logging.getLogger("snakemake.flowo")


def _normalize_flowo_project_name(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    return s or None


def _normalize_flowo_tags(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        return [t.strip() for t in raw.split(",") if t.strip()]
    if isinstance(raw, list | tuple):
        out: list[str] = []
        for item in raw:
            s = str(item).strip()
            if s:
                out.append(s)
        return out
    return []


class WorkflowStartedHandler(BaseEventHandler[WorkflowStartedSchema]):
    def handle(
        self, data: WorkflowStartedSchema, session: Session, context: dict[str, Any]
    ) -> None:
        catalog: Catalog | None = None
        catalog_id = None
        slug = (context.get("flowo_catalog_slug") or "").strip()
        user_id = context.get("flowo_user_id")
        if slug:
            found = session.query(Catalog).filter_by(slug=slug).first()
            if found and catalog_readable_by_user(
                found, user_id if isinstance(user_id, uuid.UUID) else None
            ):
                catalog = found
                catalog_id = found.id
            elif not found:
                logger.debug("flowo_catalog_slug %r: no catalog with that slug", slug)
            elif found and not catalog_readable_by_user(
                found, user_id if isinstance(user_id, uuid.UUID) else None
            ):
                logger.debug(
                    "flowo_catalog_slug %r: user not allowed to link this catalog", slug
                )

        name = _normalize_flowo_project_name(context.get("flowo_project_name"))
        if not name and catalog is not None:
            name = catalog.name

        tags = _normalize_flowo_tags(context.get("flowo_tags"))
        if not tags and catalog is not None and catalog.tags:
            tags = list(catalog.tags)

        context["flowo_project_name"] = name
        context["flowo_tags"] = tags

        workflow = Workflow(
            id=data.workflow_id,
            snakefile=data.snakefile,
            user=context.get("flowo_user", "Anonymous"),
            user_id=context.get("flowo_user_id"),
            flowo_working_path=settings.FLOWO_WORKING_PATH,
            name=name,
            tags=tags if tags else None,
            logfile=context.get("logfile"),
            directory=context.get("workdir"),
            config=context.get("config"),
            dryrun=context.get("dryrun", False),
            status=Status.RUNNING,
            started_at=datetime.now(),
            configfiles=context.get("configfiles"),
            catalog_id=catalog_id,
        )
        session.add(workflow)

        # Add rules if provided
        rules = [
            Rule(
                name=rule_info.name,
                code=rule_info.code,
                language=rule_info.language,
                workflow_id=workflow.id,
            )
            for rule_info in data.rules
        ]
        session.add_all(rules)

        context["current_workflow_id"] = data.workflow_id

        # Send workflow submitted notification
        user_email = context.get("flowo_user", "")
        notify_workflow_submitted(session, name or "", user_email)


class RunInfoHandler(BaseEventHandler[RunInfoSchema]):
    def handle(
        self, data: RunInfoSchema, session: Session, context: dict[str, Any]
    ) -> None:
        workflow_id = context.get("current_workflow_id")
        if not workflow_id:
            return
        workflow = session.get(Workflow, workflow_id)
        if workflow:
            workflow.run_info = data.stats


class JobStartedHandler(BaseEventHandler[JobStartedSchema]):
    def handle(
        self, data: JobStartedSchema, session: Session, context: dict[str, Any]
    ) -> None:
        workflow_id = context.get("current_workflow_id")
        if not workflow_id:
            return
        jobs = []
        for snakemake_job_id in data.job_ids:
            job = Job(
                snakemake_id=snakemake_job_id,
                workflow_id=workflow_id,
                status=Status.RUNNING,
                started_at=datetime.now(),
            )
            jobs.append(job)
        session.add_all(jobs)
        session.flush()
        # Update mapping
        new_mappings = {job.snakemake_id: job.id for job in jobs}
        context.setdefault("jobs", {}).update(new_mappings)


class JobInfoHandler(BaseEventHandler[JobInfoSchema]):
    def handle(
        self, data: JobInfoSchema, session: Session, context: dict[str, Any]
    ) -> None:
        workflow_id = context.get("current_workflow_id")
        if not workflow_id or "jobs" not in context:
            return

        rule = (
            session.query(Rule)
            .filter_by(name=data.rule_name, workflow_id=workflow_id)
            .first()
        )
        if not rule:
            rule = Rule(name=data.rule_name, workflow_id=workflow_id)
            session.add(rule)
            session.flush()

        jobs_map = context.get("jobs", {})
        db_job_id = jobs_map.get(data.job_id) or jobs_map.get(str(data.job_id))

        if not db_job_id:
            return

        job = session.get(Job, db_job_id)
        if not job:
            return

        job.rule_id = rule.id
        job.message = data.rule_msg
        job.wildcards = data.wildcards
        job.reason = data.reason
        job.resources = data.resources
        job.shellcmd = data.shellcmd
        job.threads = data.threads
        job.priority = data.priority

        self._add_files(job, data.input, FileType.INPUT, session)
        self._add_files(job, data.output, FileType.OUTPUT, session)
        self._add_files(job, data.log, FileType.LOG, session)
        self._add_files(job, data.benchmark, FileType.BENCHMARK, session)

    def _add_files(
        self, job: Job, paths: list[str] | None, ftype: FileType, session: Session
    ):
        if not paths:
            return
        for p in paths:
            f = File(path=p, file_type=ftype, job_id=job.id)
            session.add(f)


class JobFinishedHandler(BaseEventHandler[JobFinishedSchema]):
    def handle(
        self, data: JobFinishedSchema, session: Session, context: dict[str, Any]
    ) -> None:
        jobs_map = context.get("jobs", {})
        db_job_id = jobs_map.get(data.job_id) or jobs_map.get(str(data.job_id))

        if not db_job_id:
            return
        job = session.get(Job, db_job_id)
        if job:
            job.status = Status.SUCCESS
            job.end_time = datetime.now()


class JobErrorHandler(BaseEventHandler[JobErrorSchema]):
    def handle(
        self, data: JobErrorSchema, session: Session, context: dict[str, Any]
    ) -> None:
        jobs_map = context.get("jobs", {})
        db_job_id = jobs_map.get(data.job_id) or jobs_map.get(str(data.job_id))

        if not db_job_id:
            return
        job = session.get(Job, db_job_id)
        if job:
            job.status = Status.ERROR
            job.end_time = datetime.now()


class RuleGraphHandler(BaseEventHandler[RuleGraphSchema]):
    def handle(
        self, data: RuleGraphSchema, session: Session, context: dict[str, Any]
    ) -> None:
        workflow_id = context.get("current_workflow_id")
        if not workflow_id:
            return
        workflow = session.get(Workflow, workflow_id)
        if workflow:
            workflow.rulegraph_data = data.rulegraph
            if workflow.catalog_id:
                # Cache the successful DAG in the catalog
                catalog = session.get(Catalog, workflow.catalog_id)
                if catalog:
                    catalog.rulegraph_data = data.rulegraph


class ErrorHandler(BaseEventHandler[ErrorSchema]):
    def handle(
        self, data: ErrorSchema, session: Session, context: dict[str, Any]
    ) -> None:
        workflow_id = context.get("current_workflow_id")
        if not workflow_id:
            return

        rule_id = None
        if data.rule:
            rule = (
                session.query(Rule)
                .filter_by(name=data.rule, workflow_id=workflow_id)
                .first()
            )
            if not rule:
                rule = Rule(name=data.rule, workflow_id=workflow_id)
                session.add(rule)
                session.flush()
            rule_id = rule.id

        error = Error(
            exception=data.exception,
            location=data.location,
            traceback=data.traceback,
            file=data.file,
            line=data.line,
            workflow_id=workflow_id,
            rule_id=rule_id,
        )
        session.add(error)

        workflow = session.get(Workflow, workflow_id)
        if workflow and workflow.status == Status.RUNNING:
            workflow.status = Status.ERROR
            workflow.end_time = datetime.now()

            # Send workflow failure notification
            user_email = context.get("flowo_user", "")
            error_msg = data.exception or "Unknown error"
            notify_workflow_failure(session, workflow.name or "", user_email, error_msg)


class GroupInfoHandler(BaseEventHandler[GroupInfoSchema]):
    def handle(
        self, data: GroupInfoSchema, session: Session, context: dict[str, Any]
    ) -> None:
        jobs_map = context.get("jobs", {})
        for job_ref in data.jobs:
            jid = getattr(job_ref, "job_id", job_ref)
            db_jid = jobs_map.get(jid) or jobs_map.get(str(jid))
            if db_jid:
                job = session.get(Job, db_jid)
                if job:
                    job.group_id = data.group_id


class GroupErrorHandler(BaseEventHandler[GroupErrorSchema]):
    def handle(
        self, data: GroupErrorSchema, session: Session, context: dict[str, Any]
    ) -> None:
        jobs_map = context.get("jobs", {})
        snakemake_job_id = data.job_error_info.get("job_id")
        if not snakemake_job_id:
            return

        db_jid = jobs_map.get(snakemake_job_id) or jobs_map.get(str(snakemake_job_id))
        if db_jid:
            job = session.get(Job, db_jid)
            if job:
                job.status = Status.ERROR
                job.end_time = datetime.now()
