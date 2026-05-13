# Installation guide

For the shortest path—including a **hosted sandbox**—read [Quick Start](../quickstart.md) first.

FlowO is usually deployed with **Docker Compose** (PostgreSQL, app image, Caddy). On the machine that runs Snakemake you only need **Python 3.12+** and the logger plugin (`pip`).

## Prerequisites

- **Docker** and **Docker Compose**
- **Python 3.12+** where Snakemake runs

## Deploy the server

### 1. Download files

```bash
curl -O https://raw.githubusercontent.com/zhanghaomiao/flowo/main/compose.yml
curl -O https://raw.githubusercontent.com/zhanghaomiao/flowo/main/env.example
cp env.example .env
```

### 2. Edit `.env` (minimal)

You must set at least:

- **`FLOWO_WORKING_PATH`** — host directory that contains (or is a parent of) your Snakemake projects, so logs and file previews resolve.
- **`SECRET_KEY`** — long random string; keep it stable after the first real deploy.

Strongly recommended for anything beyond a quick trial:

- **`POSTGRES_PASSWORD`** (and other `POSTGRES_*` if you are not using defaults).
- **`UID` / `GID`** — your host user/group (`id -u`, `id -g`) so files on the volume are not owned only by root.

Behind HTTPS or a custom URL, set **`FLOWO_HOST`** (or **`DOMAIN`** / **`PROTOCOL`** as in `env.example`).

**Every variable** is commented in **`env.example`**. Grouped tables and defaults: [Environment variables](../reference/environment-variables.md).

### 3. Start

```bash
docker compose up -d
```

### 4. First login and admin

Open `http://localhost:3100` (or your public URL). You should see the login page.

**Superuser** (for Settings, users, invitations when signup is closed):

- **Easiest:** set `FLOWO_BOOTSTRAP_ADMIN_EMAIL` and `FLOWO_BOOTSTRAP_ADMIN_PASSWORD` in `.env`, then start or restart the stack once (default **Compose image** entrypoint only). Remove those lines after you can sign in.
- **Or:** `docker compose exec flowo python -m app.manage create-admin you@example.com 'your-strong-password'`

See [Quick Start](../quickstart.md) for the full “first Snakemake run” path.

## Install the logger (Snakemake machine)

```bash
pip install snakemake-logger-plugin-flowo
```

With Snakemake in the same environment:

```bash
pip install "snakemake-logger-plugin-flowo[snakemake]"
```

## Security notes

!!! warning "HTTPS in production"
    Use TLS in front of FlowO (reverse proxy or Caddy with a real domain). Set public **`FLOWO_HOST`** so the logger and browser agree on the URL.

!!! danger "Working path"
    **`FLOWO_WORKING_PATH`** must match the tree Snakemake uses; mount a common parent if you have several projects.
