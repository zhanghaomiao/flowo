import os
from pathlib import Path

import nox

nox.options.sessions = ["lint", "tests"]
nox.options.default_venv_backend = "uv|virtualenv"

SNAKEMAKE_VERSIONS = [
    "9.0.1",
    "9.2.0",
    "9.4.0",
    "9.5.1",
    "9.8.2",
    "9.12.0",
    "9.15.0",
    "9.17.0",
    "9.18.2",
    "9.19.0",
]
TEST_PATHS = [
    "tests/unit/test_parsers.py",
    "tests/unit/test_snakemake_service.py",
    "tests/snakemake_compat/test_extract_rules_real_snakemake.py",
    "tests/snakemake_compat/test_log_handler_compat.py",
    "tests/snakemake_compat/test_logger_e2e_real_snakemake.py",
]
TEST_DEPENDENCIES = [
    "fastapi>=0.115.12",
    "httpx>=0.28.1",
    "pydantic>=2.11.5",
    "pydantic-settings>=2.9.1",
    "pytest>=8.3.0",
    "pytest-asyncio>=0.24.0",
    "snakemake-interface-logger-plugins",
]


def _repo_root() -> str:
    return str(Path(__file__).resolve().parent)


@nox.session(name="tests", python="3.12")
@nox.parametrize("snakemake", SNAKEMAKE_VERSIONS)
def tests(session: nox.Session, snakemake: str) -> None:
    """Run the Snakemake 9.x compatibility suite."""
    env = {
        "NO_COLOR": "1",
        "PYTHONPATH": _repo_root(),
        **os.environ,
    }
    session.install(*TEST_DEPENDENCIES, f"snakemake=={snakemake}")
    session.install(".")
    session.run("pytest", "--noconftest", *TEST_PATHS, env=env)


@nox.session(name="lint", python=False)
def lint(session: nox.Session) -> None:
    """Run Ruff against the repository."""
    session.run(
        "uv",
        "run",
        "--no-project",
        "--python",
        "3.12",
        "--with",
        "ruff",
        "ruff",
        "check",
        ".",
    )
