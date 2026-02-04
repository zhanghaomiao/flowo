"""
Snakemake PostgreSQL Logger Plugin

A logger plugin for Snakemake that stores workflow execution data in PostgreSQL.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

from snakemake_interface_logger_plugins.base import LogHandlerBase
from snakemake_interface_logger_plugins.settings import LogHandlerSettingsBase

from .plugin.client.log_handler import FlowoLogHandler, LogHandler, LogHandlerSettings

__version__ = "0.1.0"


logger = logging.getLogger("snakemake.flowo")


__all__ = ["LogHandler", "LogHandlerSettings"]
