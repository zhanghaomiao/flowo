import inspect
import logging
import os
import uuid
from dataclasses import dataclass, field
from logging import Handler, LogRecord
from pathlib import Path

import httpx

try:
    from snakemake.logging import DefaultFilter, DefaultFormatter
except ModuleNotFoundError:

    class DefaultFormatter(logging.Formatter):
        def __init__(
            self,
            quiet: bool = False,  # noqa: ARG002
            show_failed_logs: bool = False,  # noqa: ARG002
            printshellcmds: bool = False,  # noqa: ARG002
        ):
            super().__init__("%(message)s")

    class DefaultFilter(logging.Filter):
        def __init__(
            self,
            quiet: bool = False,  # noqa: ARG002
            debug_dag: bool = False,  # noqa: ARG002
            dryrun: bool = False,  # noqa: ARG002
            printshellcmds: bool = False,  # noqa: ARG002
        ):
            super().__init__()


from snakemake_interface_logger_plugins.base import LogHandlerBase
from snakemake_interface_logger_plugins.settings import (
    LogHandlerSettingsBase,
    OutputSettingsLoggerInterface,
)

from flowo_common.config import DEFAULT_API_V1_STR, get_client_settings
from snakemake_logger_plugin_flowo.plugin.client.parsers import RecordParser


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
        flowo_catalog_slug: str | None = None,
    ):
        super().__init__()
        self.common_settings = common_settings

        tags = [t.strip() for t in (flowo_tags or "").split(",") if t.strip()]
        catalog_slug = (flowo_catalog_slug or "").strip() or None

        self.context = {
            "current_workflow_id": None,
            "dryrun": self.common_settings.dryrun,
            "jobs": {},
            "logfile": str(Path(f"flowo_logs/log_{uuid.uuid4()}.log").resolve()),
            "flowo_project_name": flowo_project_name,
            "flowo_tags": tags,
            "flowo_catalog_slug": catalog_slug,
            "workdir": os.getcwd(),
        }

        self.file_handler = self._init_file_handler()
        self._client = self._init_http_client()

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
        h.setFormatter(self._create_formatter())
        h.addFilter(self._create_filter())
        h.setLevel(logging.DEBUG if self.common_settings.verbose else logging.INFO)
        return h

    def _create_formatter(self):
        """Create DefaultFormatter with version-compatible arguments.

        snakemake <=9.2.x: DefaultFormatter(quiet, show_failed_logs, printshellcmds)
        snakemake >=9.10.0: DefaultFormatter(quiet, show_failed_logs)
        """
        sig = inspect.signature(DefaultFormatter.__init__)
        params = set(sig.parameters.keys()) - {"self"}
        kwargs = {
            "quiet": self.common_settings.quiet,
            "show_failed_logs": self.common_settings.show_failed_logs,
        }
        if "printshellcmds" in params:
            kwargs["printshellcmds"] = self.common_settings.printshellcmds
        return DefaultFormatter(**kwargs)

    def _create_filter(self):
        """Create DefaultFilter with version-compatible arguments.

        snakemake <=9.2.x: DefaultFilter(quiet, debug_dag, dryrun)
        snakemake >=9.10.0: DefaultFilter(quiet, debug_dag, dryrun, printshellcmds)
        """
        sig = inspect.signature(DefaultFilter.__init__)
        params = set(sig.parameters.keys()) - {"self"}
        kwargs = {
            "quiet": self.common_settings.quiet,
            "debug_dag": self.common_settings.debug_dag,
            "dryrun": self.common_settings.dryrun,
        }
        if "printshellcmds" in params:
            kwargs["printshellcmds"] = self.common_settings.printshellcmds
        return DefaultFilter(**kwargs)

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
            data = schema_data.model_dump(mode="json")

            if event_name == "workflow_started":
                configfiles, config = self._get_configfiles()
                self.context["configfiles"] = configfiles
                self._merge_workflow_config_context(config)
            elif event_name == "job_info":
                self._normalize_job_file_paths(data)

            self._send_to_api(event_name, data)
        except Exception as e:
            logger.debug(f"Failed to process event {event_name}: {e}")

    def _init_http_client(self) -> httpx.Client:
        """Initialize a persistent HTTP client for connection pooling."""
        headers = {}
        cs = get_client_settings()
        if cs.FLOWO_USER_TOKEN:
            headers["Authorization"] = f"Bearer {cs.FLOWO_USER_TOKEN}"

        return httpx.Client(
            headers=headers,
            timeout=10.0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )

    def _send_to_api(self, event: str, data: dict) -> None:
        cs = get_client_settings()
        if not cs.FLOWO_USER_TOKEN:
            return

        host = (cs.FLOWO_HOST or "").rstrip("/")
        if not host:
            return

        url = f"{host}{DEFAULT_API_V1_STR}/reports/"
        payload = {"event": event, "record": data, "context": self.context}

        try:
            resp = self._client.post(url, json=payload)
            if resp.status_code == 200:
                updated = resp.json().get("context")
                if updated:
                    self.context.update(updated)
            else:
                logger.warning(f"API reporting failed: {resp.status_code} {resp.text}")
        except Exception as e:
            logger.warning(f"Error reporting to API: {e}")

    def flowo_path_valid(self):
        flowo_working_path = get_client_settings().FLOWO_WORKING_PATH
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

    def _get_configfiles(self) -> tuple[list[str], dict]:
        """Extract configfiles from global snakemake workflow object."""
        try:
            import snakemake.workflow

            config = snakemake.workflow.workflow.config_settings.overwrite_config or {}
            if (
                hasattr(snakemake.workflow, "workflow")
                and snakemake.workflow.workflow
                and hasattr(snakemake.workflow.workflow, "configfiles")
            ):
                return [str(f) for f in snakemake.workflow.workflow.configfiles], config
        except Exception as e:
            logger.debug(f"Failed to access snakemake workflow configfiles: {e}")

        return [], {}

    def _merge_workflow_config_context(self, config: dict) -> None:
        config_name = config.get("flowo_project_name")
        if config_name:
            self.context["flowo_project_name"] = config_name

        config_tags = config.get("flowo_tags")
        if isinstance(config_tags, str):
            tags = [t.strip() for t in config_tags.split(",") if t.strip()]
        elif isinstance(config_tags, list):
            tags = [str(t).strip() for t in config_tags if str(t).strip()]
        else:
            tags = []

        if tags:
            self.context["flowo_tags"] = tags

    def _current_execution_prefix(self) -> Path | None:
        """Relative cwd prefix for paths emitted from Snakemake's effective workdir."""
        try:
            workflow_root = Path(str(self.context.get("workdir") or "")).resolve()
            current = Path.cwd().resolve()
            if current == workflow_root:
                return None
            return current.relative_to(workflow_root)
        except ValueError:
            return None
        except Exception as e:
            logger.debug(f"Failed to derive snakemake execution prefix: {e}")
            return None

    def _normalize_job_file_paths(self, data: dict) -> None:
        prefix = self._current_execution_prefix()
        if prefix is None or str(prefix) == ".":
            return

        def normalize_one(raw: object) -> str:
            path = Path(str(raw))
            if path.is_absolute():
                return str(path)
            if path.parts[: len(prefix.parts)] == prefix.parts:
                return path.as_posix()
            return (prefix / path).as_posix()

        for key in ("input", "output", "log", "benchmark"):
            value = data.get(key)
            if value is None:
                continue
            if isinstance(value, list):
                data[key] = [normalize_one(v) for v in value]
            else:
                data[key] = [normalize_one(value)]

    def close(self) -> None:
        self.file_handler.close()

        if self._client.is_closed:
            return

        workflow_id = self.context.get("current_workflow_id")
        cs = get_client_settings()
        if workflow_id and cs.FLOWO_USER_TOKEN:
            host = (cs.FLOWO_HOST or "").rstrip("/")
            if host:
                url = f"{host}{DEFAULT_API_V1_STR}/reports/close"
                params = {"workflow_id": str(workflow_id)}
                try:
                    self._client.post(url, params=params)
                except Exception as e:
                    logger.warning(f"Error closing workflow: {e}")

        # Close the persistent client
        self._client.close()
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
    catalog: str = field(
        default=None,
        metadata={
            "help": "Catalog slug to link this run to (matches Flowo catalog URL slug)",
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
            flowo_catalog_slug=self.settings.catalog,
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
