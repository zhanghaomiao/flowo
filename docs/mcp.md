# MCP (Model Context Protocol)

Flowo exposes **HTTP MCP** at **`/mcp`** (same host/port as the web UI; Caddy proxies `/mcp*` to the backend). In-app copy blocks: **Settings → MCP**.

## Authentication

MCP tool calls hit the same FastAPI routes as REST. Send **`Authorization: Bearer …`** on MCP requests; `fastapi-mcp` forwards that header to internal tool HTTP calls.

- **API token** (recommended for Cursor): create under **Settings → API Tokens**, value starts with `flw_`.
- **JWT**: session token from normal login also works if your client can refresh it.

Example (replace the placeholder):

```json
{
  "mcpServers": {
    "flowo": {
      "url": "https://your-flowo-host/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_FLOWO_API_TOKEN"
      }
    }
  }
}
```

## Exposed tools

Registered in `app/main.py` via `include_operations`. **Operation IDs** (what the MCP client calls) are listed below; HTTP paths are under **`/api/v1/mcp-tools`** for debugging with `curl`.

### Runs (executions)

| Operation ID | HTTP (debug) |
| ------------------------- | ------------ |
| `list_runs` | `GET .../mcp-tools/workflows` |
| `get_latest_run` | `GET .../mcp-tools/workflows/latest` |
| `list_running_runs` | `GET .../mcp-tools/running-count` |
| `list_recent_failed_runs` | `GET .../mcp-tools/failed-workflows` |
| `summarize_run` | `GET .../mcp-tools/workflows/{workflow_id}/summary` |
| `summarize_latest_run` | `GET .../mcp-tools/workflows/latest/summary` |
| `get_run_timeline` | `GET .../mcp-tools/workflows/{workflow_id}/timeline` |
| `diagnose_run_failure` | `GET .../mcp-tools/workflows/{workflow_id}/failure-diagnosis` |
| `diagnose_latest_failed_run` | `GET .../mcp-tools/workflows/latest/failure-diagnosis` |
| `list_run_outputs` | `GET .../mcp-tools/workflows/{workflow_id}/outputs` |
| `trace_run_output` | `GET .../mcp-tools/workflows/{workflow_id}/trace-output` |

Path segment `{workflow_id}` is the **run** id (Snakemake execution record), not a catalog row.

### Catalog (stored Snakemake workflows)

| Operation ID | HTTP (debug) |
| ------------------------- | ------------ |
| `list_catalog_workflows` | `GET .../mcp-tools/catalogs` |
| `get_catalog_workflow_overview` | `GET .../mcp-tools/catalogs/{catalog_ref}/overview` |
| `read_catalog_workflow_file` | `GET .../mcp-tools/catalogs/{catalog_ref}/files/{path}` |
| `search_catalog_workflow_files` | `GET .../mcp-tools/catalogs/{catalog_ref}/search` |
| `summarize_catalog_workflow` | `GET .../mcp-tools/catalogs/{catalog_ref}/summary` |
| `list_runs_for_catalog_workflow` | `GET .../mcp-tools/catalogs/{catalog_ref}/workflows` |
| `materialize_catalog_workflow_workspace` | `POST .../mcp-tools/catalogs/{catalog_ref}/materialize` |

All of the above require **`Authorization`** unless your deployment changes auth.

## Security

Prefer **HTTPS**, restrict network access to `/mcp`, rotate API tokens, and avoid sharing config files that contain secrets.

## Related code

- `app/main.py` — `FastApiMCP`, `mount_http()`, `include_operations`
- `app/api/endpoints/mcp.py` — `Depends(current_active_user_with_token)`
- `app/api/deps.py` — JWT or `flw_` bearer
- `Caddyfile` — `handle /mcp*`
