"""``flowo status`` checks local config, API auth, and MCP reachability."""

from __future__ import annotations

import httpx

from snakemake_logger_plugin_flowo.plugin.client.cli import status


class _FakeClient:
    def __init__(self, responses: dict[str, httpx.Response]):
        self._responses = responses

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def get(self, url: str, headers=None):
        assert headers is not None
        return self._responses[url]


def test_status_success_accepts_mcp_406(monkeypatch):
    monkeypatch.setenv("FLOWO_HOST", "https://flowo.test")
    monkeypatch.setenv("FLOWO_USER_TOKEN", "secret")
    monkeypatch.setattr(
        httpx,
        "Client",
        lambda *a, **k: _FakeClient(
            {
                "https://flowo.test/api/v1/utils/info": httpx.Response(200, json={}),
                "https://flowo.test/api/v1/catalog": httpx.Response(200, json=[]),
                "https://flowo.test/mcp": httpx.Response(
                    406,
                    json={
                        "error": {
                            "message": "Client must accept text/event-stream",
                        }
                    },
                ),
            }
        ),
    )

    assert status() is True


def test_status_reports_mcp_404(monkeypatch):
    monkeypatch.setenv("FLOWO_HOST", "https://flowo.test")
    monkeypatch.setenv("FLOWO_USER_TOKEN", "secret")
    monkeypatch.setattr(
        httpx,
        "Client",
        lambda *a, **k: _FakeClient(
            {
                "https://flowo.test/api/v1/utils/info": httpx.Response(200, json={}),
                "https://flowo.test/api/v1/catalog": httpx.Response(200, json=[]),
                "https://flowo.test/mcp": httpx.Response(
                    404,
                    json={"error": {"message": "Session not found"}},
                ),
            }
        ),
    )

    assert status() is False


def test_status_missing_host_fails(monkeypatch):
    monkeypatch.delenv("FLOWO_HOST", raising=False)
    monkeypatch.delenv("FLOWO_USER_TOKEN", raising=False)
    monkeypatch.setattr(
        "snakemake_logger_plugin_flowo.plugin.client.cli.get_client_settings",
        lambda: type(
            "Settings",
            (),
            {
                "FLOWO_HOST": None,
                "FLOWO_USER_TOKEN": None,
                "FLOWO_WORKING_PATH": "/tmp/flowo",
            },
        )(),
    )

    assert status() is False
