from pathlib import Path

from app.services.third_party.snakevision import (
    _parse_missing_inputs,
    declared_configfile_paths,
    find_test_workdir,
)


def test_declared_configfile_paths_reads_literal_relative_paths(tmp_path: Path):
    snakefile = tmp_path / "Snakefile"
    snakefile.write_text(
        """
configfile: "config/config.yaml"
configfile: 'profiles/test.yaml'
rule all:
    input: []
""".strip()
        + "\n",
        encoding="utf-8",
    )

    assert declared_configfile_paths(snakefile) == [
        "config/config.yaml",
        "profiles/test.yaml",
    ]


def test_find_test_workdir_skips_test_dir_when_configfile_is_missing(
    tmp_path: Path,
):
    snakefile = tmp_path / "workflow" / "Snakefile"
    snakefile.parent.mkdir()
    snakefile.write_text(
        'configfile: "config/config.yaml"\nrule all:\n    input: []\n',
        encoding="utf-8",
    )
    (tmp_path / ".test").mkdir()
    (tmp_path / "config").mkdir()
    (tmp_path / "config" / "config.yaml").write_text("samples: []\n")

    assert find_test_workdir(tmp_path, snakefile) is None


def test_find_test_workdir_uses_test_dir_when_configfile_is_present(
    tmp_path: Path,
):
    snakefile = tmp_path / "workflow" / "Snakefile"
    snakefile.parent.mkdir()
    snakefile.write_text(
        'configfile: "config/config.yaml"\nrule all:\n    input: []\n',
        encoding="utf-8",
    )
    (tmp_path / ".test" / "config").mkdir(parents=True)
    (tmp_path / ".test" / "config" / "config.yaml").write_text("samples: []\n")

    assert find_test_workdir(tmp_path, snakefile) == tmp_path / ".test"


def test_parse_missing_inputs_splits_snakefile_affected_files_line():
    err = """
Building DAG of jobs...
MissingInputException in rule fastp_pe in file "/workflow/rules/trim.smk", line 49:
Missing input files for rule fastp_pe:
    output: results/trimmed/E/E-lane1_R1.fastq.gz
    wildcards: sample=E, unit=lane1
    affected files: E.2.fq.gz E.1.fq.gz
""".strip()

    assert _parse_missing_inputs(err) == ["E.2.fq.gz", "E.1.fq.gz"]


def test_parse_missing_inputs_keeps_multiline_relative_paths():
    err = """
MissingInputException:
affected files:
    data/reads/a.chr21.2.fq
    data/reads/a.chr21.1.fq
""".strip()

    assert _parse_missing_inputs(err) == [
        "data/reads/a.chr21.2.fq",
        "data/reads/a.chr21.1.fq",
    ]
