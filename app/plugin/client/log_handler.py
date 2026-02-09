import logging
import os
import uuid
from dataclasses import dataclass, field
from logging import Handler, LogRecord
from pathlib import Path

import httpx
from snakemake.logging import DefaultFilter, DefaultFormatter
from snakemake_interface_logger_plugins.base import LogHandlerBase
from snakemake_interface_logger_plugins.settings import (
    LogHandlerSettingsBase,
    OutputSettingsLoggerInterface,
)

from ...core.config import settings
from .parsers import RecordParser


class FlowoFormatter(logging.Formatter):
    """Custom formatter for Flowo logs with colors."""

    grey = "\x1b[38;20m"
    yellow = "\x1b[33;20m"
    red = "\x1b[31;20m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"
    format_str = "[flowo-logs] %(message)s"

    FORMATS = {
        logging.DEBUG: grey + format_str + reset,
        logging.INFO: grey + format_str + reset,
        logging.WARNING: yellow + format_str + reset,
        logging.ERROR: red + format_str + reset,
        logging.CRITICAL: bold_red + format_str + reset,
    }

    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = logging.Formatter(log_fmt)
        return formatter.format(record)


# Configure logger for plugin
logger = logging.getLogger("snakemake.flowo")
logger.setLevel(logging.INFO)

if not any(isinstance(h, logging.StreamHandler) for h in logger.handlers):
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(FlowoFormatter())
    logger.addHandler(console_handler)
    logger.propagate = False


class FlowoLogHandler(Handler):
    """Refactored Log handler for Snakemake."""

    def __init__(
        self,
        common_settings: OutputSettingsLoggerInterface,
        flowo_project_name: str | None = None,
        flowo_tags: str | None = None,
    ):
        super().__init__()
        self.common_settings = common_settings

        tags = [t.strip() for t in (flowo_tags or "").split(",") if t.strip()]

        self.context = {
            "current_workflow_id": None,
            "dryrun": self.common_settings.dryrun,
            "jobs": {},
            "logfile": str(Path(f"flowo_logs/log_{uuid.uuid4()}.log").resolve()),
            "flowo_project_name": flowo_project_name,
            "flowo_tags": tags,
            "workdir": os.getcwd(),
        }

        self.file_handler = self._init_file_handler()

        # Mapping EventName -> Parser method
        self._parsers = {
            "workflow_started": RecordParser.workflow_started,
            "run_info": RecordParser.run_info,
            "job_info": RecordParser.job_info,
            "job_started": RecordParser.job_started,
            "job_finished": RecordParser.job_finished,
            "job_error": RecordParser.job_error,
            "rulegraph": RecordParser.rulegraph,
            "group_info": RecordParser.group_info,
            "group_error": RecordParser.group_error,
            "error": RecordParser.error,
        }

    def _init_file_handler(self):
        log_file_path = Path(self.context["logfile"])
        log_file_path.parent.mkdir(parents=True, exist_ok=True)

        h = logging.FileHandler(log_file_path, encoding="utf-8")
        h.setFormatter(
            DefaultFormatter(
                self.common_settings.quiet, self.common_settings.show_failed_logs
            )
        )
        h.addFilter(
            DefaultFilter(
                self.common_settings.quiet,
                self.common_settings.debug_dag,
                self.common_settings.dryrun,
                self.common_settings.printshellcmds,
            )
        )
        h.setLevel(logging.DEBUG if self.common_settings.verbose else logging.INFO)
        return h

    def emit(self, record: LogRecord) -> None:
        self.file_handler.emit(record)

        event = getattr(record, "event", None)
        if not event:
            return

        event_name = event.value if hasattr(event, "value") else str(event).lower()
        parser_func = self._parsers.get(event_name)

        if not parser_func:
            return

        try:
            # 1. Parse record to schema
            schema_data = parser_func(record)

            # 2. Send to API
            self._send_to_api(event_name, schema_data.model_dump(mode="json"))
        except Exception as e:
            logger.debug(f"Failed to process event {event_name}: {e}")

    def _send_to_api(self, event: str, data: dict) -> None:
        if not settings.FLOWO_USER_TOKEN:
            return

        url = f"{settings.FLOWO_HOST.rstrip('/')}{settings.API_V1_STR}/reports/"
        headers = {"Authorization": f"Bearer {settings.FLOWO_USER_TOKEN}"}
        payload = {"event": event, "record": data, "context": self.context}

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    updated = resp.json().get("context")
                    if updated:
                        self.context.update(updated)
                else:
                    logger.warning(f"API reporting failed: {resp.status_code}")
        except Exception as e:
            logger.warning(f"Error reporting to API: {e}")

    def flowo_path_valid(self):
        flowo_working_path = settings.FLOWO_WORKING_PATH
        workdir = self.context.get("workdir")

        if not flowo_working_path:
            logger.warning(
                """The flowo_working_path is not configured in the .env file.
                Please configure it if you need to use Flowo to view logs,
                snakefiles, outputs, and other information in real-time."""
            )
            return

        if not workdir:
            return

        if not str(Path(workdir).resolve()).startswith(
            str(Path(flowo_working_path).resolve())
        ):
            logger.warning(
                f"workdir:{workdir} is not a valid subpath of flowo_working_path:{flowo_working_path}"
            )
            return

    def close(self) -> None:
        self.file_handler.close()

        workflow_id = self.context.get("current_workflow_id")
        if workflow_id and settings.FLOWO_USER_TOKEN:
            url = (
                f"{settings.FLOWO_HOST.rstrip('/')}{settings.API_V1_STR}/reports/close"
            )
            headers = {"Authorization": f"Bearer {settings.FLOWO_USER_TOKEN}"}
            params = {"workflow_id": str(workflow_id)}
            try:
                with httpx.Client(timeout=10.0) as client:
                    client.post(url, params=params, headers=headers)
            except Exception as e:
                logger.warning(f"Error closing workflow: {e}")

        super().close()


@dataclass
class LogHandlerSettings(LogHandlerSettingsBase):
    name: str = field(
        default=None,
        metadata={
            "help": "Set name of this workflow",
            "env_var": False,
            "required": False,
        },
    )
    tags: str = field(
        default=None,
        metadata={
            "help": "Set tags of this workflow, separated by ',' ",
            "env_var": False,
            "required": False,
        },
    )


class LogHandler(LogHandlerBase, FlowoLogHandler):
    """Main LogHandler class for the PostgreSQL plugin."""

    def __post_init__(self) -> None:
        FlowoLogHandler.__init__(
            self,
            self.common_settings,
            flowo_project_name=self.settings.name,
            flowo_tags=self.settings.tags,
        )

        self.flowo_path_valid()

    @property
    def writes_to_stream(self) -> bool:
        """Whether this plugin writes to stderr/stdout"""
        return False

    @property
    def writes_to_file(self) -> bool:
        """Whether this plugin writes to a file"""
        return False

    @property
    def has_filter(self) -> bool:
        """Whether this plugin attaches its own filter"""
        return True

    @property
    def has_formatter(self) -> bool:
        """Whether this plugin attaches its own formatter"""
        return True

    @property
    def needs_rulegraph(self) -> bool:
        """Whether this plugin requires the DAG rulegraph."""
        return True

    def emit(self, record):
        return FlowoLogHandler.emit(self, record)
