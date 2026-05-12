# User manual overview

FlowO is a **command center for Snakemake runs**: one browser app for live status, history, logs, outputs, and optional catalog templates.

## Primary UI areas

| Area | Route (typical) | Role |
|------|------------------|------|
| **Runs** | `/runs` | Searchable list of executions (name, tags, status, progress, catalog link). |
| **Run detail** | `/runs/{id}` | DAG, jobs table, timeline, captured code, and result previews for one execution. |
| **Dashboard** | `/dashboard` | Fleet-wide aggregates: status mix, activity, rule errors, resources (when enabled). |
| **Catalog** | `/catalog` | Template library: files in DB, DAG preview, recent runs linked to each entry. |
| **Settings** | `/settings` | Profile, API tokens, MCP, SMTP, Git—most items are **optional** beyond basic use. |

## How pieces connect

1. You run **`snakemake --logger flowo …`** on a machine with network access to the FlowO API.
2. Events land in **PostgreSQL**; the UI learns about updates through **SSE**.
3. For **previews**, the FlowO server must see the same filesystem tree (via **`FLOWO_WORKING_PATH`**) that Snakemake used when it reported paths.

## Chapters in this manual

- [Installation](installation.md)
- [Login and CLI setup](login-cli.md)
- [Run Snakemake with FlowO](run-snakemake.md)
- [Dashboard](dashboard.md)
- [Runs and workflow detail](workflow-detail.md)
- [Jobs, logs, and errors](jobs-logs-errors.md)
- [Results preview](results-preview.md)
- [Catalog and templates](catalog.md)
- [DAG preview](dag-preview.md)

For optional AI and email capabilities, see **Advanced features** in the site navigation.
