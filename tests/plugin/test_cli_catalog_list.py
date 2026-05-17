"""``flowo catalog list`` — auth + GET /api/v1/catalog."""

from __future__ import annotations

import httpx

from snakemake_logger_plugin_flowo.plugin.client.cli import list_catalog


class _FakeClient:
    def __init__(self, response: httpx.Response):
        self._response = response

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def get(self, url: str, headers=None):
        assert url == "https://flowo.test/api/v1/catalog"
        assert headers == {"Authorization": "Bearer secret"}
        return self._response


def test_list_catalog_empty_success(monkeypatch):
    monkeypatch.setenv("FLOWO_HOST", "https://flowo.test")
    monkeypatch.setenv("FLOWO_USER_TOKEN", "secret")
    monkeypatch.setattr(
        httpx,
        "Client",
        lambda *a, **k: _FakeClient(httpx.Response(200, json=[])),
    )

    assert list_catalog() is True


def test_list_catalog_auth_failure(monkeypatch):
    monkeypatch.setenv("FLOWO_HOST", "https://flowo.test")
    monkeypatch.setenv("FLOWO_USER_TOKEN", "secret")
    monkeypatch.setattr(
        httpx,
        "Client",
        lambda *a, **k: _FakeClient(
            httpx.Response(401, json={"detail": "Unauthorized"})
        ),
    )

    assert list_catalog() is False
