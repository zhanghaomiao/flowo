# FlowO

**FlowO** is a **Snakemake observability** and **workflow catalog** platform: run the official logger plugin alongside Snakemake, and the web app records every execution—live **Dashboard** and **Runs**, job-level logs and errors, optional **output preview**, and a **catalog** of versioned Snakemake projects you can browse, edit, and link back to runs.

**Full documentation:** [flowo-docs.pages.dev](https://flowo-docs.pages.dev/)

---

## Why FlowO

| | |
| --- | --- |
| **Real-time run monitoring** | PostgreSQL-backed history with **SSE** so the **Dashboard** and **Runs** views update as jobs start, finish, or fail. |
| **Deep visibility** | Per-run **DAG**, **Jobs**, **Timeline**, captured **code**, and **logs**—plus **result preview** when the server can read the same paths Snakemake used. |
| **Workflow catalog** | The **Catalog** stores Snakemake templates in the database (with versioning), materializes a workspace for Snakemake/DAG tooling, and ties runs to catalog entries when you report `catalog` metadata from the logger. |

---

## Quick start (~5 minutes)

1. **Run FlowO** (Docker Compose, `.env`, `FLOWO_WORKING_PATH`) — follow **[Quick Start](https://flowo-docs.pages.dev/quickstart/)** in the docs.
2. **Install the logger plugin** on the machine where Snakemake runs:

   ```bash
   pip install snakemake-logger-plugin-flowo
   ```

   Optional: `pip install "snakemake-logger-plugin-flowo[snakemake]"` if you need Snakemake in the same venv.

3. **Authenticate the CLI** (browser flow; token is written to `~/.config/flowo/config.toml`, mode `0600`):

   ```bash
   flowo login --host http://localhost:3100
   ```

   Replace the URL with your deployment (HTTPS in production).

4. **Run Snakemake** with the FlowO logger and open **Dashboard** / **Runs** in the browser:

   ```bash
   cd /path/to/your/workflow
   snakemake --logger flowo \
     --logger-flowo-name "my-run" \
     --logger-flowo-tags "demo,qc"
   ```

**Headless servers, CI, or MCP:** create a long-lived token under **Settings → API Tokens** only when you cannot use `flowo login`. See **[Login and CLI setup](https://flowo-docs.pages.dev/user-manual/login-cli/)** (manual token section).

---

## Screenshots

| ![Dashboard](docs/assets/images/dashboard.png) | ![Run detail](docs/assets/images/workflow-detail.png) |
| --- | --- |
| **Dashboard** — fleet status and activity | **Run detail** — DAG, jobs, timeline, code, results |

| ![Catalog](docs/assets/images/catalog-list.png) | ![DAG preview (catalog)](docs/assets/images/dag-preview.png) |
| --- | --- |
| **Catalog** — browse stored workflows | **DAG preview** — best-effort rule graph (catalog / template) |

---

## Documentation map

| Section | What you will find |
| --- | --- |
| **[Quick Start](https://flowo-docs.pages.dev/quickstart/)** | Shortest path: Compose, `flowo login`, first Snakemake run. |
| **User manual** (same site) | Installation, Runs, catalog, DAG preview, results, jobs & errors. |
| **Architecture** | Data flow, catalog storage model. |
| **Advanced features** | **Optional** MCP and email (SMTP); not required for core use. |

---

## Contributing & development

```bash
git clone https://github.com/zhanghaomiao/flowo.git
cd flowo
docker compose -f compose.dev.yml up --build
```

- **Gateway:** `http://localhost:3100` (combined frontend + API in dev compose)
- **Backend API:** `http://localhost:8000`
- **Frontend (Vite):** `http://localhost:5173`

Build the docs locally:

```bash
uv sync --extra docs
uv run mkdocs build --strict
```

---

## Live demo

A hosted sandbox may be available at [flowo.iregene-bio.com](https://flowo.iregene-bio.com/).
For credentials or access policy, see the [Quick Start](https://flowo-docs.pages.dev/quickstart/) or contact the maintainers.
