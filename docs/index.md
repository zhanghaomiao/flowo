# Welcome to FlowO 🌊

**FlowO** (Flow Output) is a unified PostgreSQL-based logging plugin and backend for **Snakemake**.

It provides a seamless way to track, store, and visualize your bioinformatics workflows in real-time, leveraging the power of PostgreSQL for structured logging and a modern React-based frontend for monitoring.

## Key Features

- 🛠 **Snakemake Integration**: Seamlessly hooks into Snakemake workflows as a log handler.
- 🗄 **Persistent Storage**: All logs, task statuses, and workflow metadata are stored in PostgreSQL.
- 🚀 **FastAPI Backend**: Robust API for querying workflow data and real-time updates.
- ⚡ **Real-time Monitoring**: Watch your workflow progression, job statuses, and logs live in the dashboard.
- 👥 **User Management**: Built-in authentication and user profile management for secure access.
- 💻 **CLI Tool**: Generate tokens and manage configurations directly from your terminal.

## Quick Start

The fastest way to get FlowO up and running is using Docker:

### 1. Launch with Docker Compose (Recommended)

You can dive straight in using our pre-built Docker images:

```bash
# Clone the repository
git clone https://github.com/zhanghaomiao/flowo.git
cd flowo

# Copy the example environment file
cp env.example .env

# Start the services using the image-based compose file
docker-compose -f docker/compose.yml up -d
```

### 2. Access the Dashboard

Once the containers are running, open your browser and go to:
[http://localhost:3100](http://localhost:3100)

### 3. Run Snakemake with FlowO

Install the plugin and run your workflow:

```bash
pip install snakemake-logger-plugin-flowo
snakemake --logger flowo --cores all
```

Check out the [Getting Started](getting-started.md) guide for more details on advanced configuration.
