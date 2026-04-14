import nox

# Define the Snakemake versions to test against
# 7.x (Legacy), 8.x (Current stable), 9.x (Latest/Next)
SNAKEMAKE_VERSIONS = ["7.32.4", "8.4.12", "9.19.0"]


@nox.session(python=["3.12"])
@nox.parametrize("snakemake", SNAKEMAKE_VERSIONS)
def tests(session, snakemake):
    """Run parser tests against different Snakemake versions."""
    # Use uv for faster installation
    session.install("uv")

    # Install the current package with all dependencies needed to load app modules
    # We include [server] to ensure FastAPI and other core deps are present for conftest.py
    session.run("uv", "pip", "install", ".[server]")

    # Install specific snakemake version and test dependencies
    session.run(
        "uv",
        "pip",
        "install",
        f"snakemake=={snakemake}",
        "pytest",
        "pytest-asyncio",
        "httpx",
        "sqlalchemy",
        "asyncpg",
        "psycopg2-binary",
    )

    # Run parser tests
    # We use -c /dev/null to avoid loading the root pytest.ini if it causes issues,
    # but here we mainly need to ensure dependencies for conftest.py are met.
    session.run("pytest", "tests/unit/test_parsers.py", env={"PYTHONPATH": "."})


@nox.session(python=["3.12"])
def lint(session):
    """Run linting."""
    session.install("ruff")
    session.run("ruff", "check", ".")
