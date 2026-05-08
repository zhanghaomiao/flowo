"""Generate catalog rulegraph SVG using snakemake + snakevision CLI."""

from __future__ import annotations

import logging
import re
import subprocess
import tempfile
import threading
import uuid
import venv
from pathlib import Path

from app.core.config import settings
from app.services.catalog.utils import catalog_export_dir

logger = logging.getLogger(__name__)

# Prevent duplicate concurrent generation for the same slug
_gen_registry_lock = threading.Lock()
_generating_slugs: set[str] = set()


def catalog_export_root(owner_id: uuid.UUID | None, slug: str) -> Path:
    return catalog_export_dir(owner_id, slug)


def flowo_meta_dir(owner_id: uuid.UUID | None, slug: str) -> Path:
    return catalog_export_root(owner_id, slug) / ".flowo"


def dag_svg_path(owner_id: uuid.UUID | None, slug: str) -> Path:
    return flowo_meta_dir(owner_id, slug) / "dag.svg"


def dag_error_path(owner_id: uuid.UUID | None, slug: str) -> Path:
    return flowo_meta_dir(owner_id, slug) / "dag_error.txt"


def find_snakefile(catalog_path: Path) -> Path | None:
    """Match SnakemakeService: prefer workflow/Snakefile, then root Snakefile."""
    snakefile = catalog_path / "workflow" / "Snakefile"
    if snakefile.exists():
        return snakefile
    snakefile = catalog_path / "Snakefile"
    if snakefile.exists():
        return snakefile
    return None


def find_test_workdir(catalog_path: Path) -> Path | None:
    """Return the standard workflow test workdir when available."""
    test_dir = catalog_path / ".test"
    if test_dir.is_dir():
        return test_dir
    return None


def try_begin_generation(slug: str) -> bool:
    """Return True if this call should start generation; False if already running."""
    with _gen_registry_lock:
        if slug in _generating_slugs:
            return False
        _generating_slugs.add(slug)
        return True


def end_generation(slug: str) -> None:
    with _gen_registry_lock:
        _generating_slugs.discard(slug)


def is_generation_in_progress(slug: str) -> bool:
    with _gen_registry_lock:
        return slug in _generating_slugs


def clear_dag_artifact_files(out_svg: Path, err_path: Path) -> None:
    """Remove previous SVG and error before a new generation attempt."""
    for p in (out_svg, err_path):
        try:
            if p.exists():
                p.unlink()
        except OSError as e:
            logger.warning("Could not remove %s: %s", p, e)


def clear_cached_dag_artifacts(owner_id: uuid.UUID | None, slug: str) -> None:
    """Remove previous SVG and error before a new generation attempt."""
    clear_dag_artifact_files(
        dag_svg_path(owner_id, slug), dag_error_path(owner_id, slug)
    )


# Registry key for built-in Snakemake workflow template DAG (not a user catalog slug).
SNAKE_TEMPLATE_DAG_REGISTRY_KEY = "__flowo_snake_template_dag__"


def snake_template_workflow_root() -> Path:
    from app.services.catalog.snake_template import snakemake_template_root

    return snakemake_template_root()


def snake_template_dag_svg_path() -> Path:
    return snake_template_workflow_root() / ".flowo" / "dag.svg"


def snake_template_dag_error_path() -> Path:
    return snake_template_workflow_root() / ".flowo" / "dag_error.txt"


def _run_snakevision_rulegraph_to_svg(
    root: Path,
    snakefile: Path,
    out_svg: Path,
    err_path: Path,
    log_label: str,
) -> None:
    """Run snakemake --rulegraph and snakevision; write ``out_svg`` or ``err_path``."""
    try:
        dag_py, dag_snakemake, dag_snakevision = _ensure_dag_venv()
    except Exception as e:
        err_path.write_text(f"Failed to prepare DAG venv: {e}", encoding="utf-8")
        return

    try:

        def run_rulegraph() -> subprocess.CompletedProcess:
            test_workdir = find_test_workdir(root)
            if test_workdir:
                return subprocess.run(
                    [
                        str(dag_snakemake),
                        "-s",
                        str(snakefile),
                        "-c",
                        "1",
                        "-d",
                        str(test_workdir),
                        "--forceall",
                        "--rulegraph",
                    ],
                    capture_output=True,
                    text=True,
                    timeout=120,
                    cwd=str(root),
                )

            return subprocess.run(
                [
                    str(dag_snakemake),
                    "-s",
                    str(snakefile),
                    "-c",
                    "1",
                    "--directory",
                    str(root),
                    "--forceall",
                    "--rulegraph",
                ],
                capture_output=True,
                text=True,
                timeout=120,
                cwd=str(root),
            )

        rg = run_rulegraph()
    except FileNotFoundError:
        err_path.write_text(
            "snakemake executable not found on the server.",
            encoding="utf-8",
        )
        return
    except subprocess.TimeoutExpired:
        err_path.write_text(
            "snakemake --rulegraph timed out.",
            encoding="utf-8",
        )
        return

    if rg.returncode != 0:
        combined_err = (rg.stderr or rg.stdout or "").strip()
        if settings.DAG_AUTO_INSTALL_IMPORTS:
            missing = _parse_missing_module(combined_err)
            if missing:
                try:
                    subprocess.run(
                        [
                            str(dag_py),
                            "-m",
                            "pip",
                            "install",
                            "--no-input",
                            "--disable-pip-version-check",
                            missing,
                        ],
                        capture_output=True,
                        text=True,
                        timeout=600,
                    )
                    rg = run_rulegraph()
                except Exception as e:
                    err_path.write_text(
                        f"Auto-install failed for '{missing}': {e}\n\n{combined_err[:8000]}",
                        encoding="utf-8",
                    )
                    return

                if rg.returncode == 0 and rg.stdout.strip():
                    pass
                else:
                    combined_err = (
                        rg.stderr or rg.stdout or ""
                    ).strip() or combined_err

        if settings.DAG_AUTO_TOUCH_MISSING_INPUTS:
            for _ in range(5):
                missing_inputs = _parse_missing_inputs(combined_err)
                if not missing_inputs:
                    break
                try:
                    for rel in missing_inputs:
                        p = root / rel
                        p.parent.mkdir(parents=True, exist_ok=True)
                        p.touch(exist_ok=True)
                except Exception as e:
                    err_path.write_text(
                        f"Auto-touch missing inputs failed: {e}\n\n{combined_err[:8000]}",
                        encoding="utf-8",
                    )
                    return

                rg = run_rulegraph()
                if rg.returncode == 0 and rg.stdout.strip():
                    break
                combined_err = (rg.stderr or rg.stdout or "").strip() or combined_err

        if rg.returncode != 0:
            err = (
                rg.stderr or rg.stdout or ""
            ).strip() or "snakemake --rulegraph failed"
            err_path.write_text((combined_err[:8000] or err[:8000]), encoding="utf-8")
            return

    dot_content = rg.stdout.strip()
    if not dot_content:
        err_path.write_text(
            "snakemake --rulegraph produced empty output.",
            encoding="utf-8",
        )
        return

    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".dot",
        delete=False,
        encoding="utf-8",
    ) as tmp:
        tmp.write(dot_content)
        dot_path = Path(tmp.name)

    try:
        sv = subprocess.run(
            [str(dag_snakevision), "-o", str(out_svg), str(dot_path)],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(root),
        )
    except FileNotFoundError:
        err_path.write_text(
            "snakevision executable not found on the server.",
            encoding="utf-8",
        )
        if out_svg.exists():
            out_svg.unlink(missing_ok=True)
        return
    except subprocess.TimeoutExpired:
        err_path.write_text("snakevision timed out.", encoding="utf-8")
        if out_svg.exists():
            out_svg.unlink(missing_ok=True)
        return
    finally:
        try:
            dot_path.unlink(missing_ok=True)
        except OSError:
            pass

    if sv.returncode != 0:
        err = (sv.stderr or sv.stdout or "").strip() or "snakevision failed"
        err_path.write_text(err[:8000], encoding="utf-8")
        if out_svg.exists():
            out_svg.unlink(missing_ok=True)
        return

    if not out_svg.is_file() or out_svg.stat().st_size == 0:
        err_path.write_text(
            "snakevision did not produce a non-empty SVG file.",
            encoding="utf-8",
        )
        return

    logger.info("Generated DAG SVG for %s at %s", log_label, out_svg)


def generate_snakevision_svg_for_snake_template() -> None:
    """Write DAG SVG under the official template checkout ``.flowo/``."""
    root = snake_template_workflow_root()
    meta = root / ".flowo"
    err_path = snake_template_dag_error_path()
    out_svg = snake_template_dag_svg_path()
    if not root.is_dir() or not (root / "workflow").is_dir():
        meta.mkdir(parents=True, exist_ok=True)
        err_path.write_text(
            "Snakemake template not on disk. Pull the template first.",
            encoding="utf-8",
        )
        return
    snakefile = find_snakefile(root)
    if not snakefile:
        meta.mkdir(parents=True, exist_ok=True)
        err_path.write_text(
            "Snakefile not found (expected workflow/Snakefile or Snakefile).",
            encoding="utf-8",
        )
        return
    meta.mkdir(parents=True, exist_ok=True)
    clear_dag_artifact_files(out_svg, err_path)
    _run_snakevision_rulegraph_to_svg(
        root, snakefile, out_svg, err_path, "snake-template"
    )


def _dag_venv_dir() -> Path:
    return Path(settings.DAG_VENV_DIR)


def _venv_bin(venv_dir: Path, exe: str) -> Path:
    return venv_dir / "bin" / exe


def _ensure_dag_venv() -> tuple[Path, Path, Path]:
    """
    Ensure a dedicated venv exists for DAG generation tooling.

    Returns (python, snakemake, snakevision) executable paths inside that venv.
    """
    venv_dir = _dag_venv_dir()
    py = _venv_bin(venv_dir, "python")
    smk = _venv_bin(venv_dir, "snakemake")
    sv = _venv_bin(venv_dir, "snakevision")

    if not py.exists():
        venv_dir.mkdir(parents=True, exist_ok=True)
        venv.EnvBuilder(with_pip=True, clear=False, symlinks=True).create(str(venv_dir))

    # Install tooling if missing. We keep this minimal and cached on the volume.
    if not smk.exists() or not sv.exists():
        subprocess.run(
            [
                str(py),
                "-m",
                "pip",
                "install",
                "--no-input",
                "--disable-pip-version-check",
                "snakemake",
                "snakevision",
            ],
            capture_output=True,
            text=True,
            timeout=600,
        )

    return py, smk, sv


def _parse_missing_module(err_text: str) -> str | None:
    m = re.search(r"No module named '([^']+)'", err_text)
    if not m:
        return None
    name = m.group(1).strip()
    # Avoid installing relative imports / weird values
    if not name or "." in name:
        return None
    return name


def _parse_missing_inputs(err_text: str) -> list[str]:
    """
    Parse Snakemake MissingInputException and return file paths under the workflow directory.

    Example snippet:
        affected files:
            data/reads/a.chr21.2.fq
            data/reads/a.chr21.1.fq
    """
    m = re.search(
        r"MissingInputException[\s\S]*?affected files:\s*([\s\S]+)$", err_text
    )
    if not m:
        return []
    tail = m.group(1)
    paths: list[str] = []
    for line in tail.splitlines():
        line = line.strip()
        if not line:
            continue
        # stop if looks like a new section
        if ":" in line and ("/" not in line):
            break
        # only accept relative paths
        if line.startswith(("/", "~")) or ".." in line:
            continue
        paths.append(line)
    return paths


def generate_snakevision_svg_for_slug(slug: str, owner_id: uuid.UUID | None) -> None:
    """
    Synchronous: write dag.svg under export dir, or dag_error.txt on failure.
    Expects catalog files to already be exported under the owner-scoped export tree.
    """
    root = catalog_export_root(owner_id, slug)
    if not root.is_dir():
        flowo_meta_dir(owner_id, slug).mkdir(parents=True, exist_ok=True)
        dag_error_path(owner_id, slug).write_text(
            "Catalog export directory not found. Open the catalog or sync files first.",
            encoding="utf-8",
        )
        return

    snakefile = find_snakefile(root)
    if not snakefile:
        flowo_meta_dir(owner_id, slug).mkdir(parents=True, exist_ok=True)
        dag_error_path(owner_id, slug).write_text(
            "Snakefile not found (expected workflow/Snakefile or Snakefile).",
            encoding="utf-8",
        )
        return

    flowo_meta_dir(owner_id, slug).mkdir(parents=True, exist_ok=True)
    clear_cached_dag_artifacts(owner_id, slug)
    out_svg = dag_svg_path(owner_id, slug)
    err_file = dag_error_path(owner_id, slug)
    _run_snakevision_rulegraph_to_svg(root, snakefile, out_svg, err_file, slug)
