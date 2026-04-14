from app.services.notification import (
    _get_absolute_url,
    welcome_html,
    workflow_submitted_html,
    workflow_success_html,
)


def test_get_absolute_url():
    assert _get_absolute_url("http://example.com", "/path") == "http://example.com/path"
    assert (
        _get_absolute_url("http://example.com/", "/path") == "http://example.com/path"
    )
    assert _get_absolute_url("http://example.com", "path") == "http://example.com/path"
    assert _get_absolute_url("", "/path") == "/path"


def test_workflow_submitted_html_contains_critical_info():
    html = workflow_submitted_html(
        workflow_name="Test Workflow",
        user_email="user@example.com",
        submitted_at="2023-01-01 12:00",
        site_url="http://flowo.local",
    )
    assert "Test Workflow" in html
    assert "user@example.com" in html
    assert "2023-01-01 12:00" in html
    assert "http://flowo.local/workflow" in html
    assert "Workflow Submitted" in html


def test_workflow_success_html_contains_critical_info():
    html = workflow_success_html(
        workflow_name="Success Workflow",
        user_email="user@example.com",
        duration="10m 5s",
        site_url="http://flowo.local",
    )
    assert "Success Workflow" in html
    assert "10m 5s" in html
    assert "✓ Success" in html


def test_welcome_html_contains_link():
    html = welcome_html("newuser@example.com", "http://flowo.local")
    assert "newuser@example.com" in html
    assert "http://flowo.local/login" in html
    assert "Registration Successful" in html
