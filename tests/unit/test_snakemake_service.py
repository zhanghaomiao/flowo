import subprocess
from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.services.third_party.snakemake import (
    _parse_dot_to_graph_json,
    snakemake_service,
)


def test_parse_dot_to_graph_json_maps_rule_names_to_edges():
    dot_graph = """
    digraph snakemake_dag {
        0[label = "all"];
        1[label = "align"];
        2[label = "sort"];
        1 -> 2
        2 -> 0
    }
    """

    parsed = _parse_dot_to_graph_json(dot_graph)

    assert parsed["nodes"] == [
        {"rule": "all"},
        {"rule": "align"},
        {"rule": "sort"},
    ]
    assert parsed["links"] == [
        {"source": 1, "target": 2, "sourcerule": "align", "targetrule": "sort"},
        {"source": 2, "target": 0, "sourcerule": "sort", "targetrule": "all"},
    ]


def test_generate_dag_raises_404_when_no_snakefile_exists(tmp_path: Path):
    with pytest.raises(HTTPException) as excinfo:
        snakemake_service.generate_dag(tmp_path)

    assert excinfo.value.status_code == 404
    assert excinfo.value.detail == "Snakefile not found"


def test_generate_dag_reads_workflow_subdirectory_snakefile(tmp_path: Path):
    workflow_dir = tmp_path / "workflow"
    workflow_dir.mkdir()
    (workflow_dir / "Snakefile").write_text(
        """
rule prepare_data:
    output: "data.txt"
    shell: "echo data > {output}"

rule summarize_data:
    input: "data.txt"
    output: "summary.txt"
    shell: "cp {input} {output}"
""".strip()
        + "\n",
        encoding="utf-8",
    )

    result = snakemake_service.generate_dag(tmp_path)

    rule_names = {node["rule"] for node in result["nodes"]}
    assert result["error"] is None
    assert "prepare_data" in rule_names
    assert all(node["rule"] for node in result["nodes"])
    assert all(link["sourcerule"] or link["targetrule"] for link in result["links"])


def test_generate_dag_falls_back_to_root_snakefile_and_uses_expected_command(
    tmp_path: Path,
):
    snakefile = tmp_path / "Snakefile"
    snakefile.write_text("rule all:\n    input: []\n", encoding="utf-8")

    with patch(
        "app.services.third_party.snakemake.subprocess.run",
        return_value=CompletedProcess(
            args=["snakemake"],
            returncode=0,
            stdout='digraph snakemake_dag {\n    0[label = "all"];\n}\n',
            stderr="",
        ),
    ) as run:
        result = snakemake_service.generate_dag(tmp_path)

    assert result == {"nodes": [{"rule": "all"}], "links": [], "error": None}
    run.assert_called_once_with(
        [
            "snakemake",
            "--rulegraph",
            "-s",
            str(snakefile),
            "--directory",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        timeout=30,
        cwd=str(tmp_path),
    )


def test_generate_dag_returns_error_payload_when_snakemake_fails(tmp_path: Path):
    snakefile = tmp_path / "Snakefile"
    snakefile.write_text("rule broken:\n    shell: (\n", encoding="utf-8")

    result = snakemake_service.generate_dag(tmp_path)

    assert result["nodes"] == []
    assert result["links"] == []
    assert result["error"]


def test_generate_dag_converts_missing_binary_to_http_500(tmp_path: Path):
    snakefile = tmp_path / "Snakefile"
    snakefile.write_text(
        "rule all:\n    output: 'done.txt'\n    shell: 'echo ok > {output}'\n",
        encoding="utf-8",
    )

    with patch(
        "app.services.third_party.snakemake.subprocess.run",
        side_effect=FileNotFoundError,
    ):
        with pytest.raises(HTTPException) as excinfo:
            snakemake_service.generate_dag(tmp_path)

    assert excinfo.value.status_code == 500
    assert excinfo.value.detail == "snakemake is not installed on the server"


def test_generate_dag_converts_subprocess_timeout_to_http_504(tmp_path: Path):
    snakefile = tmp_path / "Snakefile"
    snakefile.write_text(
        "rule all:\n    output: 'done.txt'\n    shell: 'echo ok > {output}'\n",
        encoding="utf-8",
    )

    with patch(
        "app.services.third_party.snakemake.subprocess.run",
        side_effect=subprocess.TimeoutExpired(cmd="snakemake", timeout=30),
    ):
        with pytest.raises(HTTPException) as excinfo:
            snakemake_service.generate_dag(tmp_path)

    assert excinfo.value.status_code == 504
    assert excinfo.value.detail == "DAG generation timed out"


def test_generate_dag_uses_stderr_when_subprocess_returns_failure(tmp_path: Path):
    snakefile = tmp_path / "Snakefile"
    snakefile.write_text(
        "rule all:\n    output: 'done.txt'\n    shell: 'echo ok > {output}'\n",
        encoding="utf-8",
    )

    with patch(
        "app.services.third_party.snakemake.subprocess.run",
        return_value=CompletedProcess(
            args=["snakemake"], returncode=1, stdout="", stderr="parser error"
        ),
    ):
        result = snakemake_service.generate_dag(tmp_path)

    assert result == {"nodes": [], "links": [], "error": "parser error"}
