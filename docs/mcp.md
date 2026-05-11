# MCP (Model Context Protocol)

Flowo exposes **HTTP MCP** at **`/mcp`** (same host/port as the web UI; Caddy proxies ` /mcp*` to the backend). In-app copy blocks: **Settings → MCP**.

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

## Exposed tool

Registered in `app/main.py` via `include_operations`:

| Operation ID              | HTTP (debug) |
| ------------------------- | ------------ |
| `list_running_workflows`  | `GET /api/v1/mcp-tools/running-count` (requires `Authorization`) |

## Security

Prefer **HTTPS**, restrict network access to `/mcp`, rotate API tokens, and avoid sharing config files that contain secrets.

## Related code

- `app/main.py` — `FastApiMCP`, `mount_http()`
- `app/api/endpoints/mcp.py` — `Depends(current_active_user_with_token)`
- `app/api/deps.py` — JWT or `flw_` bearer
- `Caddyfile` — `handle /mcp*`
