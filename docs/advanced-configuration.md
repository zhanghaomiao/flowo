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
| `TZ`         | Timezone setting.                        | No       | `Asia/Shanghai`   |

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

## Development & Security

| Variable               | Description                                          | Required | Default |
| ---------------------- | ---------------------------------------------------- | -------- | ------- |
| `BACKEND_CORS_ORIGINS` | List of allowed origins for CORS.                    | No       | `["*"]` |
| `SQL_ECHO`             | If set to `True`, logs all SQL queries (very noisy). | No       | `False` |

## Hierarchy of Configuration

FlowO looks for environment variables in the following order:

1. Environment variables set in the shell.
2. The `.env` file in the project root.
3. The configuration file at `~/.config/flowo/.env` (primarily for the CLI/Plugin).
