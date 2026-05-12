# Installation guide

For the shortest path—including a **hosted sandbox**—read [Quick Start](../quickstart.md) first. This page expands Docker deployment, environment variables, and client (`pip`) installation.

FlowO is typically deployed using Docker Compose. This ensures all components (Backend, Frontend, PostgreSQL, Caddy) are correctly configured and isolated.

## Prerequisites

- **Docker** and **Docker Compose** installed.
- **Python 3.12+** on the machine where Snakemake will run.

## Server Deployment

### 1. Download Configuration
Download the core configuration files to your server directory:

```bash
curl -O https://raw.githubusercontent.com/zhanghaomiao/flowo/main/compose.yml
curl -O https://raw.githubusercontent.com/zhanghaomiao/flowo/main/env.example
cp env.example .env
```

### 2. Configure Environment Variables
Edit the `.env` file to suit your environment:

*   `FLOWO_WORKING_PATH`: **Crucial.** This is the path on the host machine where your Snakemake projects reside. FlowO needs this to access logs and output files.
*   `UID` & `GID`: Set these to your local user and group IDs (run `id -u` and `id -g`) to avoid permission issues with files created by FlowO.
*   `FLOWO_HOST`: (Optional) Set this to your external domain or IP (e.g., `https://flowo.example.com`) if you are using a reverse proxy.

### 3. Start the Services
Run the following command to start FlowO in the background:

```bash
docker compose up -d
```

### 4. Verify the Deployment
Open `http://localhost:3100` (or your configured domain). You should see the FlowO login page.

## Client Installation

On the machine(s) where you will execute Snakemake:

```bash
pip install snakemake-logger-plugin-flowo
```

If you don't have Snakemake installed yet, you can install the plugin with Snakemake as a dependency:

```bash
pip install "snakemake-logger-plugin-flowo[snakemake]"
```

## Security Best Practices

!!! warning "HTTPS in production"
    In production, always run FlowO behind a reverse proxy with SSL (HTTPS). The Caddy service included in the default `compose.yml` can be configured for automatic Let's Encrypt certificates if a valid domain is provided.

!!! danger "Working path alignment"
    For file previews to work, the `FLOWO_WORKING_PATH` mounted in the Docker container MUST match the relative paths reported by Snakemake. It is usually best to mount the parent directory of all your projects.

## Advanced Configuration

FlowO is configured primarily through environment variables. Below is a breakdown of the most commonly used settings in the `.env` file.

### Core Settings

| Variable | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `SECRET_KEY` | Used for JWT token signing and security. | **Yes** | `your_secret_key` |
| `PORT` | The host port Caddy listens on. | No | `3100` |
| `DOMAIN` | Domain name for the application. | No | `localhost` |
| `FLOWO_HOST` | The external URL used for API reporting. | No | *Calculated* |
| `UID` & `GID` | User/Group ID for the container process. | No | `0` (root) |

### Database (PostgreSQL)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `POSTGRES_HOST` | Database host address. | `db` |
| `POSTGRES_PORT` | Database port. | `5432` |
| `POSTGRES_DB` | Database name. | `flowo_logs` |
| `POSTGRES_USER` | Database username. | `flowo` |
| `POSTGRES_PASSWORD`| Database password. | `flowo_password` |

### Storage & Paths

| Variable | Description | Required |
| :--- | :--- | :--- |
| `FLOWO_WORKING_PATH` | Host path where Snakemake logs and files are stored. | **Yes** |
| `CONTAINER_MOUNT_PATH`| The destination path inside the Docker container. | No (`/work_dir`) |

## Hierarchy of Configuration

FlowO looks for configuration in the following order of precedence:
1. Environment variables set in the shell.
2. The CLI configuration file at `~/.config/flowo/config.toml`.
3. The `.env` file in the project root.
