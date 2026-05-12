# Advanced Configuration

FlowO is configured primarily through environment variables. This page provides a detailed breakdown of all available settings in the `.env` file and within the application.

## Core Settings

| Variable     | Description                              | Required | Default           |
| ------------ | ---------------------------------------- | -------- | ----------------- |
| `SECRET_KEY` | Used for JWT token signing and security. | **Yes**  | `your_secret_key` |
| `PORT`       | The host port Caddy listens on.          | No       | `3100`            |
| `DOMAIN`     | Domain name for the application.         | No       | `localhost`       |
| `PROTOCOL`   | Protocol used (http/https).              | No       | `http`            |
| `FLOWO_HOST` | The external URL used for API reporting. | No       | _Calculated_      |
| `UID`        | User ID for the container process.       | No       | `0` (root)        |
| `GID`        | Group ID for the container process.      | No       | `0` (root)        |
| `TZ`         | Timezone setting.                        | No       | `Asia/Shanghai`   |

<!-- prettier-ignore -->
!!! warning "UID and GID"
    By default, these values are set to `0` (root). Running FlowO as **root** is a security risk and may lead to file permission issues (files created by FlowO will be owned by root). Always use your local user IDs.

<!-- prettier-ignore -->
!!! warning
    Always change the `SECRET_KEY` in production to ensure the security of user sessions and tokens.

## Database (PostgreSQL)

Settings for the backend to connect to the PostgreSQL database.

| Variable            | Description            | Required | Default                                       |
| ------------------- | ---------------------- | -------- | --------------------------------------------- |
| `POSTGRES_HOST`     | Database host address. | No       | `localhost` (Internal `postgresql` in Docker) |
| `POSTGRES_PORT`     | Database port.         | No       | `5432`                                        |
| `POSTGRES_DB`       | Database name.         | No       | `flowo_logs`                                  |
| `POSTGRES_USER`     | Database username.     | No       | `flowo`                                       |
| `POSTGRES_PASSWORD` | Database password.     | No       | `flowo_password`                              |

## Storage & Paths

These settings control how FlowO interacts with the filesystem for log storage and task data.

| Variable               | Description                                          | Required | Default                  |
| ---------------------- | ---------------------------------------------------- | -------- | ------------------------ |
| `FLOWO_WORKING_PATH`   | Host path where Snakemake logs and files are stored. | **Yes**  | `/tmp/flowo_working_dir` |
| `CONTAINER_MOUNT_PATH` | The destination path inside the Docker container.    | No       | `/flowo-data`            |

<!-- prettier-ignore -->
!!! warning "Important"
    `FLOWO_WORKING_PATH` must be an absolute path on your host machine to ensure Caddy and the Backend can correctly serve and process files.

<!-- prettier-ignore -->
!!! note
    FlowO can be deployed on any machine. However, if the FlowO services are not running on the same machine as the `FLOWO_WORKING_PATH` (where Snakemake runs), file-related features like **log viewing** and **result previews** will be unavailable. In this case, you will only be able to monitor the task and job statuses.

## Snakemake workflow template (built-in)

The official [snakemake-workflow-template](https://github.com/snakemake-workflows/snakemake-workflow-template) is a **local cache** on disk (not stored in the database like user catalogs). It powers the **Snakemake template** page in the web UI and the server-side copy used when creating workflows from that template.

| Variable                           | Description                                                                                                                                                                                                                                                                    | Default                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `SNAKEMAKE_WORKFLOW_TEMPLATE_DIR` | Absolute path to the git checkout of the official template. Should live on **persistent storage** (same idea as `CONTAINER_MOUNT_PATH`), not baked into the image.                                                                                                          | `${CONTAINER_MOUNT_PATH}/snakemake-workflow-template` when that mount exists and is writable; otherwise under `FLOWO_WORKING_PATH`. |

**Online deployments**

- On backend startup, FlowO runs a best-effort **ensure** step (in the app lifespan, in a worker thread).
- If the directory is missing or does not contain a `workflow/` tree, FlowO runs the same git logic as **Pull / update** in the UI: shallow `git clone --depth 1` when there is no `.git`, or `git pull --ff-only` when a repo already exists.
- If the checkout is already valid (`workflow/` present), startup does **nothing** so restarts never change your tree.
- If clone/pull fails (no network, GitHub blocked, no `git` binary), the API still starts; check logs for a warning and `GET /api/v1/catalog/snake-template` will report `ready=false` until you fix the environment or use **Pull / update**.

**Offline deployments**

- Do not rely on startup clone: pre-populate the directory yourself so it contains at least a `workflow/` folder (same layout as the official repo).
- Point `SNAKEMAKE_WORKFLOW_TEMPLATE_DIR` at that directory, or place the tree at the default path on the mounted volume (for example, if the host path behind `CONTAINER_MOUNT_PATH` is your data disk, create `snakemake-workflow-template/` next to other FlowO data with a full template checkout).

**CLI (`flowo catalog new`)**

- The CLI may run on a laptop or cluster node without the FlowO server. It still uses `SNAKEMAKE_WORKFLOW_TEMPLATE_DIR` from config and can clone on demand when the template is missing; it does not depend on the server having already run ensure.

## Development & Security

| Variable               | Description                                          | Required | Default |
| ---------------------- | ---------------------------------------------------- | -------- | ------- |
| `BACKEND_CORS_ORIGINS` | List of allowed origins for CORS.                    | No       | `["*"]` |
| `SQL_ECHO`             | If set to `True`, logs all SQL queries (very noisy). | No       | `False` |

## CLI Authentication

Run `flowo login --host https://your-flowo-host` to authorize the CLI through the browser. The CLI stores credentials in `~/.config/flowo/config.toml` with mode **0600** where the OS allows it. API tokens remain visible in full only once when explicitly created from Settings → API Tokens.

## MCP (assistants)

Model Context Protocol (MCP) URL, Caddy routing, exposed tools, and security notes are documented on a dedicated page: **[MCP integration](mcp.md)**.

## Hierarchy of Configuration

FlowO looks for environment variables in the following order:

1. Environment variables set in the shell.
2. The CLI configuration file at `~/.config/flowo/config.toml`.
3. The `.env` file in the project root.
