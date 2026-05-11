"""Generate catalog rulegraph SVG using snakemake + snakevision CLI."""

from __future__ import annotations

import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import uuid
import venv
from pathlib import Path

from app.core.config import settings
from app.services.catalog.utils import catalog_data_dir, catalog_export_dir

logger = logging.getLogger(__name__)

# Prevent duplicate concurrent generation for the same logical job (catalog id, template key, …)
_gen_registry_lock = threading.Lock()
_generating_job_keys: set[str] = set()


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


def try_begin_generation(job_key: str) -> bool:
    """Return True if this call should start generation; False if already running."""
    with _gen_registry_lock:
        if job_key in _generating_job_keys:
            return False
        _generating_job_keys.add(job_key)
        return True


def end_generation(job_key: str) -> None:
    with _gen_registry_lock:
        _generating_job_keys.discard(job_key)


def is_generation_in_progress(job_key: str) -> bool:
    with _gen_registry_lock:
        return job_key in _generating_job_keys


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
    from app.services.catalog.snake_template_paths import snakemake_template_root

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
            env = _dag_subprocess_env()
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
                    env=env,
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
                env=env,
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
                    _install_missing_import(dag_py, missing)
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

    # Force zero margins and padding in the DOT graph to maximize SVG space utilization
    dot_content = re.sub(
        r"(\{\s*)", r"\1graph [margin=0, pad=0];\n    ", dot_content, count=1
    )

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


def _dag_imports_dir() -> Path:
    return _dag_venv_dir() / "imports"


def _dag_subprocess_env() -> dict[str, str]:
    env = os.environ.copy()
    imports_dir = _dag_imports_dir()
    if imports_dir.is_dir():
        existing = env.get("PYTHONPATH")
        env["PYTHONPATH"] = (
            f"{imports_dir}{os.pathsep}{existing}" if existing else str(imports_dir)
        )
    return env


def _install_missing_import(py: Path, package: str) -> None:
    imports_dir = _dag_imports_dir()
    imports_dir.mkdir(parents=True, exist_ok=True)
    uv = shutil.which("uv")
    if uv:
        cmd = [
            uv,
            "pip",
            "install",
            "--python",
            str(py),
            "--target",
            str(imports_dir),
            package,
        ]
    else:
        cmd = [
            str(py),
            "-m",
            "pip",
            "install",
            "--no-input",
            "--disable-pip-version-check",
            "--target",
            str(imports_dir),
            package,
        ]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=600,
    )
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(err[:4000] or f"pip install failed for {package}")


def _venv_bin(venv_dir: Path, exe: str) -> Path:
    return venv_dir / "bin" / exe


def _ensure_dag_venv() -> tuple[Path, Path, Path]:
    """
    Ensure a dedicated venv exists for DAG generation tooling.

    Returns (python, snakemake, snakevision) executable paths inside that venv.
    """
    # Prefer the already-installed backend environment. Docker images install the
    # server extra at build time, which is much more reliable than downloading
    # Snakemake/Snakevision from inside a request-time background task. When
    # DAG_AUTO_INSTALL_IMPORTS is enabled, missing workflow imports are installed
    # into this same environment so the rulegraph process can see them.
    current_bin = Path(sys.executable).parent
    smk_path = current_bin / "snakemake"
    sv_path = current_bin / "snakevision"
    if smk_path.exists() and sv_path.exists():
        return Path(sys.executable), smk_path, sv_path

    smk = shutil.which("snakemake")
    sv = shutil.which("snakevision")
    if smk and sv:
        return Path(sys.executable), Path(smk), Path(sv)

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
    Synchronous: write dag.svg under export ``.flowo/``, or dag_error.txt on failure.

    Reads the Snakefile from the authoritative catalog workspace
    (``CATALOG_DIR/<owner>/<slug>``), not the optional export cache — export may be
    empty while the workspace already has files from DB sync / upload.
    """
    workspace = catalog_data_dir(owner_id, slug)
    if not workspace.is_dir():
        flowo_meta_dir(owner_id, slug).mkdir(parents=True, exist_ok=True)
        dag_error_path(owner_id, slug).write_text(
            "Catalog workspace not found. Open the catalog or sync files first.",
            encoding="utf-8",
        )
        return

    snakefile = find_snakefile(workspace)
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
    _run_snakevision_rulegraph_to_svg(workspace, snakefile, out_svg, err_file, slug)
