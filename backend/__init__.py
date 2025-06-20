"""
Snakemake PostgreSQL Logger Plugin

A logger plugin for Snakemake that stores workflow execution data in PostgreSQL.
"""

import logging
from pathlib import Path

from snakemake.logging import DefaultFilter, DefaultFormatter
from snakemake_interface_logger_plugins.base import LogHandlerBase

from .log_handler import PostgresqlLogHandler

__version__ = "0.1.0"


class LogHandler(LogHandlerBase, PostgresqlLogHandler):
    """Main LogHandler class for the PostgreSQL plugin."""

    def __post_init__(self) -> None:
        PostgresqlLogHandler.__init__(self, self.common_settings)
        self.log_file_path = Path(self.context.get("logfile"))
        if not self.log_file_path.parent.exists():
            self.log_file_path.parent.mkdir(parents=True, exist_ok=True)
        self.file_handler = logging.FileHandler(self.log_file_path, encoding="utf-8")
        self.file_handler.setFormatter(
            DefaultFormatter(
                self.common_settings.quiet,
                self.common_settings.show_failed_logs,
                self.common_settings.printshellcmds,
            )
        )
        self.file_handler.addFilter(
            DefaultFilter(
                self.common_settings.quiet,
                self.common_settings.debug_dag,
                self.common_settings.dryrun,
            )
        )
        self.file_handler.setLevel(
            logging.DEBUG if self.common_settings.verbose else logging.INFO
        )
        self.baseFilename = str(self.log_file_path)

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


__all__ = ["LogHandler"]
