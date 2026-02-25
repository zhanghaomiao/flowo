import logging
from logging import LogRecord
from typing import Any

from ..schemas import (
    ErrorSchema,
    GroupErrorSchema,
    GroupInfoSchema,
    JobErrorSchema,
    JobFinishedSchema,
    JobInfoSchema,
    JobStartedSchema,
    RuleGraphSchema,
    RuleInfoSchema,
    RunInfoSchema,
    WorkflowStartedSchema,
)

logger = logging.getLogger("snakemake.flowo")


def _extract_rules() -> list[RuleInfoSchema]:
    """Extract all rules and their source code from the global snakemake workflow object."""
    rules = []
    try:
        import snakemake.workflow
        from snakemake import notebook, wrapper
        from snakemake.io import contains_wildcard
        from snakemake.script import get_source

        wf = snakemake.workflow.workflow
        if not wf:
            return []

        for rule in wf.rules:
            sources = []
            language = None
            try:
                if rule.shellcmd is not None:
                    sources = [rule.shellcmd]
                    language = "bash"
                elif rule.script is not None and not contains_wildcard(rule.script):
                    _, source, language, _, _ = get_source(
                        rule.script, wf.sourcecache, rule.basedir
                    )
                    sources = [source]
                elif rule.wrapper is not None and not contains_wildcard(rule.wrapper):
                    wrapper_script = wrapper.get_script(
                        rule.wrapper,
                        wf.sourcecache,
                        prefix=wf.workflow_settings.wrapper_prefix,
                    )
                    _, source, language, _, _ = get_source(
                        wrapper_script, wf.sourcecache
                    )
                    sources = [source]
                elif rule.notebook is not None and not contains_wildcard(rule.notebook):
                    _, source, language, _, _ = get_source(
                        rule.notebook, wf.sourcecache, rule.basedir
                    )
                    # For notebooks, we try to split to get the underlying language
                    if language and "_" in language:
                        language = language.split("_")[1]
                    sources = notebook.get_cell_sources(source)
                else:
                    # run: directive or wildcard scripted rules
                    sources = []
                    language = "python" if rule.is_run else None

                code = "\n\n".join(sources) if sources else None
                rules.append(
                    RuleInfoSchema(name=rule.name, code=code, language=language)
                )
            except Exception as e:
                logger.debug(f"Failed to extract code for rule {rule.name}: {e}")
                rules.append(RuleInfoSchema(name=rule.name))

    except Exception as e:
        logger.debug(f"Failed to access snakemake workflow rules: {e}")

    return rules


class RecordParser:
    """Namespace for Snakemake LogRecord to Pydantic Schema conversion."""

    @staticmethod
    def workflow_started(record: LogRecord) -> WorkflowStartedSchema:
        return WorkflowStartedSchema(
            workflow_id=record.workflow_id,
            snakefile=str(getattr(record, "snakefile", "")),
            rules=_extract_rules(),
        )

    @staticmethod
    def run_info(record: LogRecord) -> RunInfoSchema:
        return RunInfoSchema(stats=getattr(record, "stats", {}))

    @staticmethod
    def job_info(record: LogRecord) -> JobInfoSchema:
        resources: dict[str, Any] = {}
        if hasattr(record, "resources") and hasattr(record.resources, "_names"):
            resources = {
                name: value
                for name, value in zip(
                    record.resources._names, record.resources, strict=False
                )
                if name not in {"_cores", "_nodes"}
            }

        benchmark = getattr(record, "benchmark", None)
        if benchmark and not isinstance(benchmark, list):
            benchmark = [benchmark]

        return JobInfoSchema(
            job_id=getattr(record, "jobid", 0),
            rule_name=getattr(record, "rule_name", ""),
            threads=getattr(record, "threads", 1),
            rule_msg=record.rule_msg,
            wildcards=getattr(record, "wildcards", {}),
            reason=record.reason,
            shellcmd=record.shellcmd,
            priority=record.priority,
            input=record.input,
            log=record.log,
            output=record.output,
            benchmark=benchmark,
            resources=resources,
        )

    @staticmethod
    def job_started(record: LogRecord) -> JobStartedSchema:
        jobs = getattr(record, "jobs", [])
        if jobs is None:
            jobs = []
        elif isinstance(jobs, int):
            jobs = [jobs]
        return JobStartedSchema(job_ids=jobs)

    @staticmethod
    def job_finished(record: LogRecord) -> JobFinishedSchema:
        job_id = getattr(record, "jobid", 0)
        if job_id == 0:
            job_id = getattr(record, "job_id", 0)
        return JobFinishedSchema(job_id=int(job_id))

    @staticmethod
    def job_error(record: LogRecord) -> JobErrorSchema:
        job_id = getattr(record, "jobid", 0)
        if job_id == 0:
            job_id = getattr(record, "job_id", 0)
        return JobErrorSchema(job_id=job_id)

    @staticmethod
    def rulegraph(record: LogRecord) -> RuleGraphSchema:
        return RuleGraphSchema(rulegraph=getattr(record, "rulegraph", {}))

    @staticmethod
    def group_info(record: LogRecord) -> GroupInfoSchema:
        return GroupInfoSchema(
            group_id=getattr(record, "group_id", 0),
            jobs=getattr(record, "jobs", []),
        )

    @staticmethod
    def group_error(record: LogRecord) -> GroupErrorSchema:
        return GroupErrorSchema(
            groupid=getattr(record, "groupid", 0),
            aux_logs=getattr(record, "aux_logs", []),
            job_error_info=getattr(record, "job_error_info", {}),
        )

    @staticmethod
    def error(record: LogRecord) -> ErrorSchema:
        return ErrorSchema(
            exception=getattr(record, "exception", None),
            location=getattr(record, "location", None),
            rule=getattr(record, "rule", None),
            traceback=getattr(record, "traceback", None),
            file=getattr(record, "file", None),
            line=getattr(record, "line", None),
        )
