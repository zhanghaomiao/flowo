from contextlib import contextmanager
from pathlib import Path

import pytest
from snakemake.api import OutputSettings, ResourceSettings, SnakemakeApi

from app.plugin.client.parsers import _extract_rules

pytestmark = pytest.mark.snakemake_compat


@contextmanager
def loaded_workflow(snakefile: Path):
    """Load a real Snakemake workflow and expose it via the global module slot."""
    import snakemake.workflow

    sentinel = object()
    previous_workflow = getattr(snakemake.workflow, "workflow", sentinel)

    with SnakemakeApi(OutputSettings(quiet=True)) as api:
        workflow_api = api.workflow(
            resource_settings=ResourceSettings(cores=1),
            snakefile=snakefile,
        )
        snakemake.workflow.workflow = workflow_api._workflow
        try:
            yield workflow_api._workflow
        finally:
            if previous_workflow is sentinel:
                delattr(snakemake.workflow, "workflow")
            else:
                snakemake.workflow.workflow = previous_workflow


def test_extract_rules_reads_shell_script_and_run_rules(tmp_path: Path):
    scripts_dir = tmp_path / "scripts"
    scripts_dir.mkdir()
    (scripts_dir / "transform.py").write_text(
        "print('hello from transform')\n",
        encoding="utf-8",
    )
    snakefile = tmp_path / "Snakefile"
    snakefile.write_text(
        """
rule shell_rule:
    output: "shell.txt"
    shell:
        "echo shell > {output}"

rule script_rule:
    input: "shell.txt"
    output: "script.txt"
    script: "scripts/transform.py"

rule run_rule:
    input: "script.txt"
    output: "run.txt"
    run:
        with open(output[0], "w", encoding="utf-8") as handle:
            handle.write("run")
""".strip()
        + "\n",
        encoding="utf-8",
    )

    with loaded_workflow(snakefile):
        rules = {rule.name: rule for rule in _extract_rules()}

    assert rules["shell_rule"].language == "bash"
    assert "echo shell > {output}" in (rules["shell_rule"].code or "")
    assert rules["script_rule"].language == "python"
    assert "hello from transform" in (rules["script_rule"].code or "")
    assert rules["run_rule"].language == "python"
    assert rules["run_rule"].code is None


def test_extract_rules_degrades_gracefully_for_missing_script_source(tmp_path: Path):
    snakefile = tmp_path / "Snakefile"
    snakefile.write_text(
        """
rule upstream:
    output: "upstream.txt"
    shell:
        "echo upstream > {output}"

rule missing_script:
    input: "upstream.txt"
    output: "broken.txt"
    script: "scripts/missing.py"
""".strip()
        + "\n",
        encoding="utf-8",
    )

    with loaded_workflow(snakefile):
        rules = {rule.name: rule for rule in _extract_rules()}

    assert rules["upstream"].language == "bash"
    assert "echo upstream > {output}" in (rules["upstream"].code or "")
    assert rules["missing_script"].name == "missing_script"
    assert rules["missing_script"].language is None
    assert rules["missing_script"].code is None


def test_extract_rules_returns_empty_without_global_workflow():
    import snakemake.workflow

    if hasattr(snakemake.workflow, "workflow"):
        delattr(snakemake.workflow, "workflow")

    assert _extract_rules() == []


def test_extract_rules_reads_notebook_rules(tmp_path: Path):
    """Notebook rules should be parsed into individual cell sources."""
    import json

    nb_dir = tmp_path / "notebooks"
    nb_dir.mkdir()
    notebook_content = {
        "cells": [
            {
                "cell_type": "code",
                "source": ['print("cell one")'],
                "metadata": {},
                "outputs": [],
                "execution_count": None,
                "id": "cell1",
            },
            {
                "cell_type": "code",
                "source": ["x = 42\n", "print(x)"],
                "metadata": {},
                "outputs": [],
                "execution_count": None,
                "id": "cell2",
            },
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
    (nb_dir / "analysis.py.ipynb").write_text(
        json.dumps(notebook_content), encoding="utf-8"
    )

    snakefile = tmp_path / "Snakefile"
    snakefile.write_text(
        """\
rule nb_rule:
    output: "nb_out.txt"
    notebook: "notebooks/analysis.py.ipynb"
""",
        encoding="utf-8",
    )

    with loaded_workflow(snakefile):
        rules = {rule.name: rule for rule in _extract_rules()}

    assert "nb_rule" in rules
    nb = rules["nb_rule"]
    assert nb.language == "python"
    assert nb.code is not None
    assert "cell one" in nb.code
    assert "x = 42" in nb.code


def test_extract_rules_skips_wildcard_script_path(tmp_path: Path):
    """Rules whose script path contains wildcards should be treated as 'no source'."""
    snakefile = tmp_path / "Snakefile"
    snakefile.write_text(
        """\
rule wildcard_script:
    input: "{sample}.input"
    output: "{sample}.output"
    script: "scripts/{sample}.py"
""",
        encoding="utf-8",
    )

    with loaded_workflow(snakefile):
        rules = {rule.name: rule for rule in _extract_rules()}

    assert "wildcard_script" in rules
    # Wildcard path => cannot resolve => code should be None, not crash
    wc = rules["wildcard_script"]
    assert wc.code is None


def test_configfiles_accessible_from_loaded_workflow(tmp_path: Path):
    """Verify wf.configfiles is a list and accessible after loading a workflow."""
    config_path = tmp_path / "config.yaml"
    config_path.write_text("sample: test_sample\n", encoding="utf-8")

    snakefile = tmp_path / "Snakefile"
    snakefile.write_text(
        """\
configfile: "config.yaml"
rule all:
    output: "done.txt"
    shell: "echo ok"
""",
        encoding="utf-8",
    )

    with loaded_workflow_with_workdir(snakefile, tmp_path) as wf:
        assert hasattr(wf, "configfiles")
        assert isinstance(wf.configfiles, list)
        assert len(wf.configfiles) >= 1


def test_get_source_returns_5_tuple(tmp_path: Path):
    """get_source must return a 5-tuple for a valid script path."""
    from snakemake.script import get_source

    script = tmp_path / "test_script.py"
    script.write_text('print("hello")\n', encoding="utf-8")

    snakefile = tmp_path / "Snakefile"
    snakefile.write_text(
        """\
rule scripted:
    output: "out.txt"
    script: "test_script.py"
""",
        encoding="utf-8",
    )

    with loaded_workflow(snakefile) as wf:
        rule = [r for r in wf.rules if r.name == "scripted"][0]
        result = get_source(rule.script, wf.sourcecache, rule.basedir)

    assert isinstance(result, tuple), f"get_source returned {type(result)}, expected tuple"
    assert len(result) == 5, (
        f"get_source returned {len(result)}-tuple, expected 5-tuple"
    )
    # result[1] is source content, result[2] is language
    _, source, language, _, _ = result
    assert "hello" in str(source)
    assert language == "python"


def test_workflow_and_rule_attributes_present(tmp_path: Path):
    """Verify that all workflow/rule attributes used by _extract_rules exist."""
    scripts_dir = tmp_path / "scripts"
    scripts_dir.mkdir()
    (scripts_dir / "s.py").write_text("pass\n", encoding="utf-8")

    snakefile = tmp_path / "Snakefile"
    snakefile.write_text(
        """\
rule attr_check:
    output: "out.txt"
    shell: "echo ok > {output}"
""",
        encoding="utf-8",
    )

    with loaded_workflow(snakefile) as wf:
        # Workflow attributes used by our code
        assert hasattr(wf, "rules")
        assert hasattr(wf, "sourcecache")
        assert hasattr(wf, "workflow_settings")
        assert hasattr(wf, "configfiles")

        ws = wf.workflow_settings
        assert hasattr(ws, "wrapper_prefix")

        # Rule attributes used by our code
        rule = list(wf.rules)[0]
        for attr in ["name", "shellcmd", "script", "wrapper", "notebook",
                      "is_run", "basedir"]:
            assert hasattr(rule, attr), (
                f"Rule object missing expected attribute: {attr}"
            )


# ---------------------------------------------------------------------------
# Helper: loaded_workflow with workdir (for configfile tests)
# ---------------------------------------------------------------------------

@contextmanager
def loaded_workflow_with_workdir(snakefile: Path, workdir: Path):
    """Load a real Snakemake workflow with a specific workdir."""
    import snakemake.workflow

    sentinel = object()
    previous_workflow = getattr(snakemake.workflow, "workflow", sentinel)

    with SnakemakeApi(OutputSettings(quiet=True)) as api:
        workflow_api = api.workflow(
            resource_settings=ResourceSettings(cores=1),
            snakefile=snakefile,
            workdir=workdir,
        )
        snakemake.workflow.workflow = workflow_api._workflow
        try:
            yield workflow_api._workflow
        finally:
            if previous_workflow is sentinel:
                delattr(snakemake.workflow, "workflow")
            else:
                snakemake.workflow.workflow = previous_workflow
