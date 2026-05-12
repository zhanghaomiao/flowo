__all__ = ["LogHandler", "LogHandlerSettings"]


def __getattr__(name: str):
    if name in __all__:
        from snakemake_logger_plugin_flowo.plugin.client.log_handler import (
            LogHandler,
            LogHandlerSettings,
        )

        return {"LogHandler": LogHandler, "LogHandlerSettings": LogHandlerSettings}[
            name
        ]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
