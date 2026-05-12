from pathlib import Path

from app.services.third_party.snakevision import (
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
