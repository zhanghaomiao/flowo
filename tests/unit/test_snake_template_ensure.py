from unittest.mock import patch

from app.services.catalog.snake_template import (
    ensure_snakemake_workflow_template_on_startup,
)


def test_ensure_skips_when_template_ready():
    with (
        patch(
            "app.services.catalog.snake_template.template_status",
            return_value={"ready": True},
        ),
        patch(
            "app.services.catalog.snake_template.git_pull_or_clone_template"
        ) as git_fn,
    ):
        ensure_snakemake_workflow_template_on_startup()
        git_fn.assert_not_called()


def test_ensure_calls_git_when_not_ready():
    with (
        patch(
            "app.services.catalog.snake_template.template_status",
            return_value={"ready": False},
        ),
        patch(
            "app.services.catalog.snake_template.git_pull_or_clone_template",
            return_value={"status": "ok", "action": "cloned", "path": "/x"},
        ) as git_fn,
    ):
        ensure_snakemake_workflow_template_on_startup()
        git_fn.assert_called_once_with()


def test_ensure_swallows_runtime_error():
    with (
        patch(
            "app.services.catalog.snake_template.template_status",
            return_value={"ready": False},
        ),
        patch(
            "app.services.catalog.snake_template.git_pull_or_clone_template",
            side_effect=RuntimeError("git failed"),
        ),
    ):
        ensure_snakemake_workflow_template_on_startup()


def test_ensure_swallows_oserror():
    with (
        patch(
            "app.services.catalog.snake_template.template_status",
            return_value={"ready": False},
        ),
        patch(
            "app.services.catalog.snake_template.git_pull_or_clone_template",
            side_effect=OSError("permission denied"),
        ),
    ):
        ensure_snakemake_workflow_template_on_startup()
