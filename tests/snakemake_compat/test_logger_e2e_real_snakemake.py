import json
import os
import subprocess
from pathlib import Path

import pytest

from app.plugin.schemas import (
    ErrorSchema,
    JobInfoSchema,
    RuleGraphSchema,
    WorkflowStartedSchema,
)

pytestmark = pytest.mark.snakemake_compat


def _write_sitecustomize(sitecustomize_path: Path) -> None:
    sitecustomize_path.write_text(
        """
import json
import os

import httpx


class _CaptureResponse:
    def __init__(self, context):
        self.status_code = 200
        self.text = "ok"
        self._context = context

    def json(self):
        return {"context": self._context}


class _CaptureClient:
    def __init__(self, *args, **kwargs):
        self.is_closed = False

    def post(self, url, json=None, params=None):
        capture_path = os.environ["FLOWO_CAPTURE_PATH"]
        with open(capture_path, "a", encoding="utf-8") as handle:
            handle.write(
                json_module.dumps(
                    {
                        "url": url,
                        "json": json,
                        "params": params,
                    }
                )
                + "\\n"
            )

        context = {}
        if isinstance(json, dict):
            context = dict(json.get("context") or {})
            if json.get("event") == "workflow_started":
                record = json.get("record") or {}
                workflow_id = record.get("workflow_id")
                if workflow_id:
                    context["current_workflow_id"] = workflow_id
        return _CaptureResponse(context)

    def close(self):
        self.is_closed = True


json_module = json
httpx.Client = _CaptureClient
""".strip()
        + "\n",
        encoding="utf-8",
    )


def _capture_env(tmp_path: Path, workflow_dir: Path) -> tuple[dict[str, str], Path]:
    capture_path = tmp_path / "captured_requests.jsonl"
    sitecustomize_dir = tmp_path / "pyhooks"
    sitecustomize_dir.mkdir()
    _write_sitecustomize(sitecustomize_dir / "sitecustomize.py")

    env = {
        **os.environ,
        "FLOWO_CAPTURE_PATH": str(capture_path),
        "FLOWO_HOST": "http://flowo.test",
        "FLOWO_USER_TOKEN": "test-token",
        "FLOWO_WORKING_PATH": str(workflow_dir),
        "PYTHONPATH": os.pathsep.join(
            filter(None, [str(sitecustomize_dir), os.environ.get("PYTHONPATH", "")])
        ),
    }
    return env, capture_path


def _load_captured_requests(capture_path: Path) -> list[dict]:
    return [
        json.loads(line)
        for line in capture_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def _run_snakemake(
    workflow_dir: Path,
    snakefile: Path,
    env: dict[str, str],
    *extra_args: str,
    cores: int = 1,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            "snakemake",
            "--cores",
            str(cores),
            "--snakefile",
            str(snakefile),
            "--directory",
            str(workflow_dir),
            "--logger",
            "flowo",
            "--logger-flowo-name",
            "compat-e2e",
            "--logger-flowo-tags",
            "compat,e2e",
            *extra_args,
        ],
        cwd=str(workflow_dir),
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
    )


def _report_and_close_requests(capture_path: Path) -> tuple[list[dict], list[dict]]:
    requests = _load_captured_requests(capture_path)
    report_requests = [
        req for req in requests if req["url"].endswith("/api/v1/reports/")
    ]
    close_requests = [
        req for req in requests if req["url"].endswith("/api/v1/reports/close")
    ]
    return report_requests, close_requests


def _workflow_started_rules(report_requests: list[dict]) -> dict[str, object]:
    workflow_started_request = next(
        req for req in report_requests if req["json"]["event"] == "workflow_started"
    )
    workflow_started = WorkflowStartedSchema.model_validate(
        workflow_started_request["json"]["record"]
    )
    rules = {rule.name: rule for rule in workflow_started.rules}
    return {
        "request": workflow_started_request,
        "schema": workflow_started,
        "rules": rules,
    }


def test_flowo_logger_real_cli_success_covers_shell_script_run_and_close(
    tmp_path: Path,
):
    workflow_dir = tmp_path / "workflow"
    workflow_dir.mkdir()
    (workflow_dir / "scripts").mkdir()
    (workflow_dir / "scripts" / "transform.py").write_text(
        """\
from pathlib import Path

Path(snakemake.output[0]).write_text(
    Path(snakemake.input[0]).read_text(encoding="utf-8") + "|script\\n",
    encoding="utf-8",
)
""",
        encoding="utf-8",
    )

    snakefile = workflow_dir / "Snakefile"
    snakefile.write_text(
        """\
configfile: "config.yaml"

rule all:
    input:
        "results/final.txt"

rule prepare:
    output:
        "results/input.txt"
    log:
        "logs/prepare.log"
    benchmark:
        "benchmarks/prepare.tsv"
    shell:
        '''
        mkdir -p results logs benchmarks
        printf "%s\\n" "{config[sample]}" > {output}
        printf "prepare\\n" > {log}
        '''

rule scripted:
    input:
        "results/input.txt"
    output:
        "results/scripted.txt"
    script:
        "scripts/transform.py"

rule finalize:
    input:
        "results/scripted.txt"
    output:
        "results/final.txt"
    run:
        from pathlib import Path

        content = Path(input[0]).read_text(encoding="utf-8").strip()
        Path(output[0]).parent.mkdir(parents=True, exist_ok=True)
        Path(output[0]).write_text(content + "|run\\n", encoding="utf-8")
""",
        encoding="utf-8",
    )
    (workflow_dir / "config.yaml").write_text("sample: demo-sample\n", encoding="utf-8")

    env, capture_path = _capture_env(tmp_path, workflow_dir)
    result = _run_snakemake(workflow_dir, snakefile, env, cores=2)

    assert result.returncode == 0, result.stderr or result.stdout
    report_requests, close_requests = _report_and_close_requests(capture_path)
    assert close_requests
    assert close_requests[-1]["params"]["workflow_id"]

    event_names = {req["json"]["event"] for req in report_requests}
    assert {
        "workflow_started",
        "run_info",
        "job_info",
        "job_started",
        "job_finished",
        "rulegraph",
    }.issubset(event_names)

    started = _workflow_started_rules(report_requests)
    workflow_started = started["schema"]
    workflow_context = started["request"]["json"]["context"]
    rules = started["rules"]

    assert workflow_started.workflow_id
    assert Path(workflow_started.snakefile).name == "Snakefile"
    assert workflow_context["workdir"] == str(workflow_dir)
    assert workflow_context["logfile"]
    assert [Path(path).name for path in workflow_context["configfiles"]] == [
        "config.yaml"
    ]

    assert set(rules) >= {"prepare", "scripted", "finalize"}
    assert rules["prepare"].language == "bash"
    assert "printf" in (rules["prepare"].code or "")
    assert rules["scripted"].language == "python"
    assert "script" in (rules["scripted"].code or "")
    assert rules["finalize"].language == "python"
    assert rules["finalize"].code is None

    job_infos = [
        JobInfoSchema.model_validate(req["json"]["record"])
        for req in report_requests
        if req["json"]["event"] == "job_info"
    ]
    assert {job.rule_name for job in job_infos} >= {"prepare", "scripted", "finalize"}
    prepare_job = next(job for job in job_infos if job.rule_name == "prepare")
    assert prepare_job.log
    assert prepare_job.benchmark
    assert isinstance(prepare_job.resources, dict)

    rulegraph_request = next(
        req for req in report_requests if req["json"]["event"] == "rulegraph"
    )
    rulegraph = RuleGraphSchema.model_validate(rulegraph_request["json"]["record"])
    assert rulegraph.rulegraph.get("nodes"), rulegraph.rulegraph
    assert "links" in rulegraph.rulegraph


def test_flowo_logger_real_cli_failure_emits_job_error_and_error_events(
    tmp_path: Path,
):
    workflow_dir = tmp_path / "workflow"
    workflow_dir.mkdir()

    snakefile = workflow_dir / "Snakefile"
    snakefile.write_text(
        """\
rule all:
    input:
        "results/never-created.txt"

rule explode:
    output:
        "results/never-created.txt"
    shell:
        '''
        mkdir -p results
        echo "failing" >&2
        exit 1
        '''
""",
        encoding="utf-8",
    )

    env, capture_path = _capture_env(tmp_path, workflow_dir)
    result = _run_snakemake(workflow_dir, snakefile, env, cores=2)

    assert result.returncode != 0
    report_requests, close_requests = _report_and_close_requests(capture_path)
    assert close_requests

    event_names = [req["json"]["event"] for req in report_requests]
    assert "workflow_started" in event_names
    assert "job_info" in event_names
    assert "job_started" in event_names
    assert "job_error" in event_names
    assert "error" in event_names
    assert "job_finished" not in event_names

    error_request = next(req for req in report_requests if req["json"]["event"] == "error")
    error_schema = ErrorSchema.model_validate(error_request["json"]["record"])
    assert error_schema.rule == "explode" or error_schema.exception


def test_flowo_logger_real_cli_dryrun_extracts_notebook_rule_in_workflow_started(
    tmp_path: Path,
):
    workflow_dir = tmp_path / "workflow"
    workflow_dir.mkdir()
    (workflow_dir / "notebooks").mkdir()
    (workflow_dir / "config.yaml").write_text("sample: notebook-sample\n", encoding="utf-8")
    (workflow_dir / "notebooks" / "analysis.py.ipynb").write_text(
        json.dumps(
            {
                "cells": [
                    {
                        "cell_type": "code",
                        "source": ['print("cell one")\\n'],
                        "metadata": {},
                        "outputs": [],
                        "execution_count": None,
                        "id": "cell1",
                    }
                ],
                "metadata": {
                    "kernelspec": {
                        "display_name": "Python 3",
                        "language": "python",
                        "name": "python3",
                    },
                    "language_info": {"name": "python", "version": "3.12.0"},
                },
                "nbformat": 4,
                "nbformat_minor": 5,
            }
        ),
        encoding="utf-8",
    )

    snakefile = workflow_dir / "Snakefile"
    snakefile.write_text(
        """\
configfile: "config.yaml"

rule all:
    input:
        "results/nb.txt"

rule nb_rule:
    output:
        "results/nb.txt"
    notebook:
        "notebooks/analysis.py.ipynb"
""",
        encoding="utf-8",
    )

    env, capture_path = _capture_env(tmp_path, workflow_dir)
    result = _run_snakemake(workflow_dir, snakefile, env, "--dry-run")

    assert result.returncode == 0, result.stderr or result.stdout
    report_requests, close_requests = _report_and_close_requests(capture_path)
    assert close_requests

    started = _workflow_started_rules(report_requests)
    rules = started["rules"]
    assert "nb_rule" in rules
    assert rules["nb_rule"].language == "python"
    assert "cell one" in (rules["nb_rule"].code or "")


def test_flowo_logger_real_cli_dryrun_extracts_wrapper_rule_in_workflow_started(
    tmp_path: Path,
):
    workflow_dir = tmp_path / "workflow"
    workflow_dir.mkdir()
    wrapper_dir = workflow_dir / "wrappers" / "echo_wrapper"
    wrapper_dir.mkdir(parents=True)
    (wrapper_dir / "wrapper.py").write_text(
        """\
from pathlib import Path

Path(snakemake.output[0]).write_text(
    Path(snakemake.input[0]).read_text(encoding="utf-8"),
    encoding="utf-8",
)
""",
        encoding="utf-8",
    )

    snakefile = workflow_dir / "Snakefile"
    snakefile.write_text(
        f"""\
rule all:
    input:
        "results/wrapped.txt"

rule seed:
    output:
        "results/input.txt"
    shell:
        '''
        mkdir -p results
        printf "wrapper-seed\\n" > {{output}}
        '''

rule wrapped:
    input:
        "results/input.txt"
    output:
        "results/wrapped.txt"
    wrapper:
        "file:{wrapper_dir}"
""",
        encoding="utf-8",
    )

    env, capture_path = _capture_env(tmp_path, workflow_dir)
    result = _run_snakemake(workflow_dir, snakefile, env, "--dry-run")

    assert result.returncode == 0, result.stderr or result.stdout
    report_requests, close_requests = _report_and_close_requests(capture_path)
    assert close_requests

    started = _workflow_started_rules(report_requests)
    rules = started["rules"]
    assert "wrapped" in rules
    assert rules["wrapped"].language == "python"
    assert "snakemake.output[0]" in (rules["wrapped"].code or "")


def test_flowo_logger_real_cli_local_execution_ignores_groups_and_finishes_jobs(
    tmp_path: Path,
):
    workflow_dir = tmp_path / "workflow"
    workflow_dir.mkdir()

    snakefile = workflow_dir / "Snakefile"
    snakefile.write_text(
        """\
rule all:
    input:
        "results/final.txt"

rule producer:
    output:
        pipe("results/stream.txt")
    group:
        "pipe_group"
    shell:
        '''
        mkdir -p results
        printf "grouped\\n" > {output}
        '''

rule consumer:
    input:
        "results/stream.txt"
    output:
        "results/final.txt"
    group:
        "pipe_group"
    shell:
        "cat {input} > {output}"
""",
        encoding="utf-8",
    )

    env, capture_path = _capture_env(tmp_path, workflow_dir)
    result = _run_snakemake(workflow_dir, snakefile, env, cores=2)

    assert result.returncode == 0, result.stderr or result.stdout
    report_requests, close_requests = _report_and_close_requests(capture_path)
    assert close_requests

    event_names = [req["json"]["event"] for req in report_requests]
    assert "job_info" in event_names
    assert "job_finished" in event_names
    assert "group_info" not in event_names
    assert "group_error" not in event_names


def test_flowo_logger_real_cli_local_execution_ignores_groups_on_failure(
    tmp_path: Path,
):
    workflow_dir = tmp_path / "workflow"
    workflow_dir.mkdir()

    snakefile = workflow_dir / "Snakefile"
    snakefile.write_text(
        """\
rule all:
    input:
        "results/final.txt"

rule producer:
    output:
        pipe("results/stream.txt")
    group:
        "pipe_group"
    shell:
        '''
        mkdir -p results
        printf "grouped\\n" > {output}
        '''

rule consumer:
    input:
        "results/stream.txt"
    output:
        "results/final.txt"
    group:
        "pipe_group"
    shell:
        '''
        cat {input} > /dev/null
        echo "group failure" >&2
        exit 1
        '''
""",
        encoding="utf-8",
    )

    env, capture_path = _capture_env(tmp_path, workflow_dir)
    result = _run_snakemake(workflow_dir, snakefile, env, cores=2)

    assert result.returncode != 0
    report_requests, close_requests = _report_and_close_requests(capture_path)
    assert close_requests

    event_names = [req["json"]["event"] for req in report_requests]
    assert "job_info" in event_names
    assert "error" in event_names
    assert "group_info" not in event_names
    assert "group_error" not in event_names
