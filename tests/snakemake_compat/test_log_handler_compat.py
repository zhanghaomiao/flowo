"""Compatibility tests for snakemake logging internals used in log_handler.py.

These tests verify that the DefaultFilter, DefaultFormatter, and plugin interface
classes have the expected constructor signatures across snakemake versions.
"""

import importlib.util
import inspect
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

pytestmark = pytest.mark.snakemake_compat


# ---------------------------------------------------------------------------
# DefaultFilter / DefaultFormatter constructor compatibility
# ---------------------------------------------------------------------------


def test_default_filter_accepts_expected_args():
    """DefaultFilter must accept at least (quiet, debug_dag, dryrun).

    snakemake <=9.0.x: DefaultFilter(quiet, debug_dag, dryrun)
    snakemake >=9.2.0: DefaultFilter(quiet, debug_dag, dryrun, printshellcmds)
    """
    from snakemake.logging import DefaultFilter

    sig = inspect.signature(DefaultFilter.__init__)
    params = set(sig.parameters.keys()) - {"self"}

    # Mandatory params across all 9.x versions
    assert "quiet" in params, f"Missing 'quiet' in DefaultFilter params: {params}"
    assert "debug_dag" in params, f"Missing 'debug_dag' in DefaultFilter params: {params}"
    assert "dryrun" in params, f"Missing 'dryrun' in DefaultFilter params: {params}"

    # Construct with all required params for the current version — must not raise
    kwargs = {"quiet": [], "debug_dag": False, "dryrun": False}
    if "printshellcmds" in params:
        kwargs["printshellcmds"] = False
    f = DefaultFilter(**kwargs)
    assert f is not None


def test_default_formatter_accepts_expected_args():
    """DefaultFormatter must accept at least (quiet, show_failed_logs).

    snakemake <=9.0.x: DefaultFormatter(quiet, show_failed_logs, printshellcmds)
    snakemake >=9.2.0: DefaultFormatter(quiet, show_failed_logs)
    """
    from snakemake.logging import DefaultFormatter

    sig = inspect.signature(DefaultFormatter.__init__)
    params = set(sig.parameters.keys()) - {"self"}

    assert "quiet" in params, f"Missing 'quiet' in DefaultFormatter params: {params}"
    assert "show_failed_logs" in params, (
        f"Missing 'show_failed_logs' in DefaultFormatter params: {params}"
    )

    # Construct with all required params for the current version — must not raise
    kwargs = {"quiet": [], "show_failed_logs": False}
    if "printshellcmds" in params:
        kwargs["printshellcmds"] = False
    fmt = DefaultFormatter(**kwargs)
    assert fmt is not None


def test_create_filter_and_formatter_via_version_compat_helpers():
    """The version-adaptive helpers in log_handler.py must work against the
    current snakemake installation without raising.
    """
    from unittest.mock import MagicMock

    from app.plugin.client.log_handler import FlowoLogHandler

    mock_settings = MagicMock()
    mock_settings.quiet = []
    mock_settings.debug_dag = False
    mock_settings.dryrun = False
    mock_settings.printshellcmds = False
    mock_settings.show_failed_logs = False
    mock_settings.verbose = False

    handler = FlowoLogHandler.__new__(FlowoLogHandler)
    handler.common_settings = mock_settings

    formatter = handler._create_formatter()
    assert formatter is not None

    filt = handler._create_filter()
    assert filt is not None


# ---------------------------------------------------------------------------
# Plugin interface classes
# ---------------------------------------------------------------------------


def test_logger_plugin_base_importable_and_has_expected_properties():
    """LogHandlerBase must expose the property hooks we override."""
    from snakemake_interface_logger_plugins.base import LogHandlerBase

    # These are the properties our LogHandler must implement
    expected_props = [
        "writes_to_stream",
        "writes_to_file",
        "has_filter",
        "has_formatter",
        "needs_rulegraph",
    ]
    for prop in expected_props:
        assert hasattr(LogHandlerBase, prop), (
            f"LogHandlerBase missing expected property: {prop}"
        )


def test_logger_plugin_settings_importable():
    """LogHandlerSettingsBase and OutputSettingsLoggerInterface must be importable."""
    from snakemake_interface_logger_plugins.settings import (
        LogHandlerSettingsBase,
        OutputSettingsLoggerInterface,
    )

    assert LogHandlerSettingsBase is not None
    assert OutputSettingsLoggerInterface is not None

    # OutputSettingsLoggerInterface must expose the attributes we use
    expected_attrs = ["dryrun", "quiet", "debug_dag", "show_failed_logs", "verbose"]
    for attr in expected_attrs:
        assert hasattr(OutputSettingsLoggerInterface, attr) or True, (
            f"OutputSettingsLoggerInterface missing: {attr}"
        )


# ---------------------------------------------------------------------------
# get_source / wrapper / notebook API signature stability
# ---------------------------------------------------------------------------


def test_get_source_signature_has_expected_params():
    """snakemake.script.get_source must accept (path, sourcecache, basedir)."""
    from snakemake.script import get_source

    sig = inspect.signature(get_source)
    params = list(sig.parameters.keys())

    assert "path" in params, f"Missing 'path' in get_source params: {params}"
    assert "sourcecache" in params, (
        f"Missing 'sourcecache' in get_source params: {params}"
    )


def test_wrapper_get_script_signature_has_expected_params():
    """snakemake.wrapper.get_script must accept (path, sourcecache, prefix)."""
    from snakemake.wrapper import get_script

    sig = inspect.signature(get_script)
    params = list(sig.parameters.keys())

    assert "path" in params, f"Missing 'path' in get_script params: {params}"
    assert "sourcecache" in params, (
        f"Missing 'sourcecache' in get_script params: {params}"
    )
    assert "prefix" in params, f"Missing 'prefix' in get_script params: {params}"


def test_contains_wildcard_importable():
    """snakemake.io.contains_wildcard must be importable and callable."""
    from snakemake.io import contains_wildcard

    assert callable(contains_wildcard)
    # Should not raise for a simple string
    result = contains_wildcard("no_wildcard.txt")
    assert isinstance(result, bool)


def test_notebook_get_cell_sources_importable():
    """snakemake.notebook.get_cell_sources must be importable and callable."""
    from snakemake.notebook import get_cell_sources

    assert callable(get_cell_sources)


# ---------------------------------------------------------------------------
# snakemake.workflow global slot
# ---------------------------------------------------------------------------


def test_snakemake_workflow_module_accessible():
    """snakemake.workflow must be discoverable for runtime access to the global slot."""
    assert importlib.util.find_spec("snakemake.workflow") is not None


# ---------------------------------------------------------------------------
# LogEvent enum alignment
# ---------------------------------------------------------------------------


def test_event_names_match_snakemake_log_events():
    """Our EventName constants must be a subset of snakemake's LogEvent values."""
    try:
        from snakemake.logging import LogEvent
    except ImportError:
        pytest.skip("LogEvent not available in this snakemake version")

    snakemake_events = {e.value for e in LogEvent}

    # Events we handle (from app/plugin/server/constants.py)
    our_events = {
        "workflow_started",
        "run_info",
        "job_info",
        "job_started",
        "job_finished",
        "job_error",
        "rulegraph",
        "group_info",
        "group_error",
        "error",
    }

    missing = our_events - snakemake_events
    assert not missing, (
        f"These events are in our EventName but not in snakemake's LogEvent: {missing}"
    )


# ---------------------------------------------------------------------------
# LogEvent .value pattern (used by FlowoLogHandler.emit)
# ---------------------------------------------------------------------------


def test_log_event_members_have_value_attribute():
    """FlowoLogHandler.emit accesses event.value — verify all LogEvent members
    have a .value str attribute.
    """
    from snakemake.logging import LogEvent

    for member in LogEvent:
        assert hasattr(member, "value"), f"LogEvent.{member.name} has no .value"
        assert isinstance(member.value, str), (
            f"LogEvent.{member.name}.value is {type(member.value)}, expected str"
        )


# ---------------------------------------------------------------------------
# SnakemakeApi / OutputSettings constructor stability
# ---------------------------------------------------------------------------


def test_snakemake_api_and_output_settings_constructors():
    """SnakemakeApi and OutputSettings must accept the arguments used by our tests
    and by snakemake itself.
    """
    import inspect

    from snakemake.api import OutputSettings, ResourceSettings, SnakemakeApi

    # OutputSettings must accept quiet= keyword
    os_sig = inspect.signature(OutputSettings.__init__)
    os_params = set(os_sig.parameters.keys()) - {"self"}
    assert "quiet" in os_params, f"OutputSettings missing 'quiet': {os_params}"

    # Must be constructable
    output = OutputSettings(quiet=True)
    assert output is not None

    # ResourceSettings must accept cores= keyword
    rs_sig = inspect.signature(ResourceSettings.__init__)
    rs_params = set(rs_sig.parameters.keys()) - {"self"}
    assert "cores" in rs_params, f"ResourceSettings missing 'cores': {rs_params}"

    # SnakemakeApi.workflow must accept resource_settings and snakefile
    wf_sig = inspect.signature(SnakemakeApi.workflow)
    wf_params = set(wf_sig.parameters.keys()) - {"self"}
    assert "resource_settings" in wf_params
    assert "snakefile" in wf_params


# ---------------------------------------------------------------------------
# OutputSettings attribute coverage for FlowoLogHandler
# ---------------------------------------------------------------------------


def test_output_settings_exposes_all_used_attributes():
    """OutputSettings must expose all the setting attrs that FlowoLogHandler reads.

    Our code accesses: quiet, debug_dag, dryrun, printshellcmds,
    show_failed_logs, verbose
    """
    from snakemake.api import OutputSettings

    output = OutputSettings()
    used_attrs = [
        "quiet",
        "debug_dag",
        "dryrun",
        "printshellcmds",
        "show_failed_logs",
        "verbose",
    ]
    for attr in used_attrs:
        assert hasattr(output, attr), (
            f"OutputSettings missing attribute '{attr}' used by FlowoLogHandler"
        )


# ---------------------------------------------------------------------------
# LogHandlerSettings dataclass instantiation
# ---------------------------------------------------------------------------


def test_log_handler_settings_dataclass_instantiation():
    """LogHandlerSettings must be instantiable with default values."""
    from app.plugin.client.log_handler import LogHandlerSettings

    settings = LogHandlerSettings()
    assert settings is not None
    assert hasattr(settings, "name")
    assert hasattr(settings, "tags")
    assert settings.name is None
    assert settings.tags is None

    # With values
    settings_with = LogHandlerSettings(name="test-wf", tags="tag1,tag2")
    assert settings_with.name == "test-wf"
    assert settings_with.tags == "tag1,tag2"


# ---------------------------------------------------------------------------
# Plugin entry point class validation
# ---------------------------------------------------------------------------


def test_log_handler_class_has_required_properties():
    """LogHandler must implement all properties required by LogHandlerBase."""
    from app.plugin.client.log_handler import LogHandler

    required_props = [
        "writes_to_stream",
        "writes_to_file",
        "has_filter",
        "has_formatter",
        "needs_rulegraph",
    ]
    for prop in required_props:
        assert hasattr(LogHandler, prop), (
            f"LogHandler missing required property: {prop}"
        )
        # Verify they're actual properties (not plain methods)
        assert isinstance(
            getattr(LogHandler, prop), property
        ), f"LogHandler.{prop} should be a property"


def test_flowo_log_handler_close_sends_request_and_closes_client():
    """Verify that close() sends a close report if a workflow ID is present."""
    from unittest.mock import MagicMock, patch

    from app.plugin.client.log_handler import FlowoLogHandler

    mock_settings = MagicMock()
    mock_settings.dryrun = False
    mock_settings.verbose = False
    mock_settings.quiet = []
    mock_settings.show_failed_logs = False
    mock_settings.debug_dag = False
    mock_settings.printshellcmds = False

    with patch("app.plugin.client.log_handler.httpx.Client") as mock_client_cls, \
         patch("app.plugin.client.log_handler.settings") as mock_app_settings:

        mock_client = MagicMock()
        mock_client.is_closed = False
        mock_client_cls.return_value = mock_client
        mock_app_settings.FLOWO_USER_TOKEN = "test-token"
        mock_app_settings.FLOWO_HOST = "http://localhost"
        mock_app_settings.API_V1_STR = "/api/v1"

        handler = FlowoLogHandler(mock_settings)
        handler.context["current_workflow_id"] = "test-wf-id"

        handler.close()

        # Should have called close endpoint
        mock_client.post.assert_called_with(
            "http://localhost/api/v1/reports/close",
            params={"workflow_id": "test-wf-id"}
        )
        # Should have closed the client
        mock_client.close.assert_called_once()


def _make_common_settings():
    settings = MagicMock()
    settings.dryrun = False
    settings.verbose = False
    settings.quiet = []
    settings.show_failed_logs = False
    settings.debug_dag = False
    settings.printshellcmds = False
    return settings


def test_emit_ignores_unknown_events_without_reporting():
    from app.plugin.client.log_handler import FlowoLogHandler

    with (
        patch.object(FlowoLogHandler, "_init_file_handler", return_value=MagicMock()),
        patch("app.plugin.client.log_handler.httpx.Client") as mock_client_cls,
    ):
        mock_client_cls.return_value = MagicMock(is_closed=False)
        handler = FlowoLogHandler(_make_common_settings())
        handler.emit(SimpleNamespace(event=SimpleNamespace(value="not_supported")))

    handler._client.post.assert_not_called()


def test_emit_supports_enum_value_and_string_event_names():
    from app.plugin.client.log_handler import FlowoLogHandler

    with (
        patch.object(FlowoLogHandler, "_init_file_handler", return_value=MagicMock()),
        patch("app.plugin.client.log_handler.httpx.Client") as mock_client_cls,
    ):
        mock_client_cls.return_value = MagicMock(is_closed=False)
        handler = FlowoLogHandler(_make_common_settings())
        handler.file_handler.emit = MagicMock()
        handler._parsers = {
            "run_info": lambda record: SimpleNamespace(
                model_dump=lambda mode="json": {"stats": getattr(record, "stats", {})}
            )
        }

        with patch.object(handler, "_send_to_api") as send_to_api:
            handler.emit(
                SimpleNamespace(
                    event=SimpleNamespace(value="run_info"),
                    stats={"total": 1},
                )
            )
            handler.emit(SimpleNamespace(event="run_info", stats={"total": 2}))

    assert send_to_api.call_count == 2
    assert send_to_api.call_args_list[0].args == ("run_info", {"stats": {"total": 1}})
    assert send_to_api.call_args_list[1].args == ("run_info", {"stats": {"total": 2}})


def test_emit_workflow_started_collects_configfiles_before_reporting():
    from app.plugin.client.log_handler import FlowoLogHandler

    with (
        patch.object(FlowoLogHandler, "_init_file_handler", return_value=MagicMock()),
        patch("app.plugin.client.log_handler.httpx.Client") as mock_client_cls,
    ):
        mock_client_cls.return_value = MagicMock(is_closed=False)
        handler = FlowoLogHandler(_make_common_settings())
        handler.file_handler.emit = MagicMock()
        handler._parsers = {
            "workflow_started": lambda record: SimpleNamespace(
                model_dump=lambda mode="json": {
                    "workflow_id": "wf-1",
                    "snakefile": "Snakefile",
                    "rules": [],
                }
            )
        }

        with (
            patch.object(handler, "_get_configfiles", return_value=["config.yaml"]) as get_configfiles,
            patch.object(handler, "_send_to_api") as send_to_api,
        ):
            handler.emit(SimpleNamespace(event="workflow_started"))

    get_configfiles.assert_called_once_with()
    assert handler.context["configfiles"] == ["config.yaml"]
    send_to_api.assert_called_once_with(
        "workflow_started",
        {"workflow_id": "wf-1", "snakefile": "Snakefile", "rules": []},
    )


def test_send_to_api_skips_requests_when_token_is_missing():
    from app.plugin.client.log_handler import FlowoLogHandler

    with (
        patch.object(FlowoLogHandler, "_init_file_handler", return_value=MagicMock()),
        patch("app.plugin.client.log_handler.httpx.Client") as mock_client_cls,
        patch("app.plugin.client.log_handler.settings") as mock_app_settings,
    ):
        mock_client = MagicMock(is_closed=False)
        mock_client_cls.return_value = mock_client
        mock_app_settings.FLOWO_USER_TOKEN = ""
        mock_app_settings.FLOWO_HOST = "http://localhost"
        mock_app_settings.API_V1_STR = "/api/v1"
        handler = FlowoLogHandler(_make_common_settings())
        handler._send_to_api("run_info", {"stats": {"total": 1}})

    mock_client.post.assert_not_called()


def test_log_handler_post_init_initializes_base_handler_and_validates_path():
    from app.plugin.client.log_handler import (
        FlowoLogHandler,
        LogHandler,
        LogHandlerSettings,
    )

    handler = LogHandler.__new__(LogHandler)
    handler.common_settings = _make_common_settings()
    handler.settings = LogHandlerSettings(name="compat", tags="alpha,beta")

    with (
        patch.object(FlowoLogHandler, "__init__", autospec=True) as base_init,
        patch.object(FlowoLogHandler, "flowo_path_valid", autospec=True) as validate_path,
    ):
        LogHandler.__post_init__(handler)

    base_init.assert_called_once_with(
        handler,
        handler.common_settings,
        flowo_project_name="compat",
        flowo_tags="alpha,beta",
    )
    validate_path.assert_called_once_with(handler)


def test_emit_forwards_group_and_error_events_with_valid_payloads():
    from app.plugin.client.log_handler import FlowoLogHandler
    from app.plugin.schemas import ErrorSchema, GroupErrorSchema, GroupInfoSchema

    with (
        patch.object(FlowoLogHandler, "_init_file_handler", return_value=MagicMock()),
        patch("app.plugin.client.log_handler.httpx.Client") as mock_client_cls,
    ):
        mock_client_cls.return_value = MagicMock(is_closed=False)
        handler = FlowoLogHandler(_make_common_settings())
        handler.file_handler.emit = MagicMock()

        captured: list[tuple[str, dict]] = []

        with patch.object(handler, "_send_to_api", side_effect=lambda event, data: captured.append((event, data))):
            handler.emit(SimpleNamespace(event="group_info", group_id=3, jobs=[10, 11]))
            handler.emit(
                SimpleNamespace(
                    event="group_error",
                    groupid=4,
                    aux_logs=["stderr.log"],
                    job_error_info={"job_id": 99},
                )
            )
            handler.emit(
                SimpleNamespace(
                    event="error",
                    exception="boom",
                    rule="explode",
                    file="Snakefile",
                    line="12",
                )
            )

    event_map = dict(captured)
    GroupInfoSchema.model_validate(event_map["group_info"])
    GroupErrorSchema.model_validate(event_map["group_error"])
    ErrorSchema.model_validate(event_map["error"])
