# Getting Started with FlowO

Welcome to FlowO! This guide provides detailed instructions on setting up the environment and using FlowO with your workflows.

## Deployment

FlowO consists of several services orchestrated via Docker Compose.

<!-- prettier-ignore -->
!!! tip "Deployment Location"
    You can deploy FlowO anywhere. Just keep in mind that if it's not on the same machine as your workflow data (`FLOWO_WORKING_PATH`), file browsing features (logs, previews) will be disabled, but status monitoring will still work.

### 1. Prerequisites

- Docker and Docker Compose installed.
- Python 3.12+ (for the CLI/Plugin).

### 2. Setup environment

Copy the `env.example` to `.env` and adjust the variables if necessary:

```bash
cp env.example .env
```

### 3. Start Services (Recommended)

You can start the entire stack using our pre-built images. This is the fastest way to get started and requires no local build.

```bash
# Start the services using the image-based compose file
docker-compose -f docker/compose.yml up -d
```

Alternatively, if you want to build from source (e.g., for development), run:

```bash
docker-compose up -d
```

This will spin up:

- **PostgreSQL**: Stores all workflow data.
- **Backend (FastAPI)**: The core API service (Image: `ghcr.io/zhanghaomiao/flowo/backend`).
- **Frontend (React)**: The monitoring dashboard (Image: `ghcr.io/zhanghaomiao/flowo/frontend`).
- **Caddy**: Reverse proxy handling unified access to the stack.

## Client-side Installation

To use FlowO with Snakemake, you need to install the plugin on your local machine or compute cluster.

### 1. Install via Pip/UV

```bash
uv pip install snakemake-logger-plugin-flowo
# OR
pip install snakemake-logger-plugin-flowo
```

### 2. Generate an Access Token

1. Access the dashboard at `http://localhost:3100`.
2. Login (or register if it's your first time).
3. Navigate to **Profile** > **Access Tokens**.
4. Generate a new token and save the configuration provided.

### 3. Configure the CLI

Use the provided command to generate a local configuration file:

```bash
flowo --generate-config --token YOUR_TOKEN --host http://localhost:3100
```

This creates a config file at `~/.config/flowo/.env`.

## Usage with Snakemake

Once configured, you can trigger FlowO logging in any Snakemake workflow:

```bash
snakemake --logger flowo --cores all --logger-flowo-name "My Project" --logger-flowo-tags "tag1,tag2"
```

### Advanced Usage

You can customize how your workflow appears in FlowO using additional logger arguments:

- `--logger-flowo-name`: Set a custom display name (title) for the workflow.
- `--logger-flowo-tags`: Add comma-separated tags to help with filtering and organization.

FlowO will track your workflow progress and job statuses in real-time based on these settings.
