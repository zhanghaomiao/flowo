# Environment variables

This page lists FlowO server and Compose-related variables in one place. The canonical **annotated template** is still **`env.example`** in the repository (copy to `.env` and edit).

For a short install walkthrough, see [Installation](../user-manual/installation.md).

Defaults below follow **`compose.yml`** and `app/core/config.py` unless stated otherwise.

## Core

| Variable | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `SECRET_KEY` | JWT, password reset, and API token signing. Keep stable after the first production deploy. | **Yes** (production) | placeholder in `env.example` |
| `PORT` | Host port published for the bundled Caddy gateway (Compose). | No | `3100` |
| `DOMAIN` | Hostname used when building default URLs. | No | `localhost` |
| `PROTOCOL` | `http` or `https` used with `DOMAIN` and `PORT` when `FLOWO_HOST` is not set. | No | `http` |
| `FLOWO_HOST` | Public base URL of this FlowO deployment (logger, redirects, email links). If unset, derived as `PROTOCOL://DOMAIN:PORT`. | No | *Calculated* |
| `TZ` | Container timezone. | No | *image default* |
| `UID` & `GID` | Linux user/group for the `flowo` process in Compose (file ownership on mounted volumes). | No | `0` (root) if unset |

## Database (PostgreSQL)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `POSTGRES_HOST` | Database host address. | `db` |
| `POSTGRES_PORT` | Database port. | `5432` |
| `POSTGRES_DB` | Database name. | `flowo_logs` |
| `POSTGRES_USER` | Database username. | `flowo` |
| `POSTGRES_PASSWORD` | Database password. | `flowo_password` |

## Storage and mounts

| Variable | Description | Required |
| :--- | :--- | :--- |
| `FLOWO_WORKING_PATH` | **Host** path where Snakemake runs and outputs live; must align with paths the logger reports. | **Yes** |
| `CONTAINER_MOUNT_PATH` | **Inside the container**, where `FLOWO_WORKING_PATH` is mounted. Default in `compose.yml` is `/flowo-data`. | No |

## Catalog, blobs, exports, official template

| Variable | Description | Default |
| :--- | :--- | :--- |
| `CATALOG_EXPORT_DIR` | On-disk export cache for DAG tooling (under the data mount if unset). | `${CONTAINER_MOUNT_PATH}/.flowo_exported_catalogs` |
| `CATALOG_BLOB_DIR` | Sidecar directory for large binary catalog files not stored in PostgreSQL. | `${CONTAINER_MOUNT_PATH}/.flowo_catalog_blobs` |
| `CATALOG_BLOB_MAX_BYTES` | Max size of a single imported catalog binary file. | 250 MiB |
| `CATALOG_IMPORT_MAX_BYTES` | Max total size of files imported for one catalog. | 1 GiB |
| `SNAKEMAKE_WORKFLOW_TEMPLATE_DIR` | Persistent checkout of the official Snakemake workflow template (git ensure on startup when incomplete). | Writable path under mount or `FLOWO_WORKING_PATH` |

More product context: [Catalog and templates](../user-manual/catalog.md).

## Security and browser access

| Variable | Description | Default |
| :--- | :--- | :--- |
| `BACKEND_CORS_ORIGINS` | JSON list of origins allowed to call the API with browser credentials. Include your real frontend URL if it is not same-origin with the API. | See `env.example` |

## First superuser (optional)

| Variable | Description |
| :--- | :--- |
| `FLOWO_BOOTSTRAP_ADMIN_EMAIL` | With `FLOWO_BOOTSTRAP_ADMIN_PASSWORD`, if the DB has **no** superuser yet, the default Docker **entrypoint** creates this account once. |
| `FLOWO_BOOTSTRAP_ADMIN_PASSWORD` | Bootstrap password; **remove or unset both** after first login. Never commit real values. |

## Frontend dev server (`compose.dev.yml`)

| Variable | Description |
| :--- | :--- |
| `VITE_DEV_ALLOWED_HOSTS` | Comma-separated `Host` headers allowed when the Vite dev server is reached through a reverse proxy. |

## Configuration precedence

1. Environment variables set in the shell.
2. The CLI file at `~/.config/flowo/config.toml` (logger / `flowo` CLI).
3. The `.env` file used by Compose / the process (when loaded).
