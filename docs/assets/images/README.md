# Documentation screenshots

PNG files in this directory are referenced from the MkDocs site. **Committed placeholders** are minimal 1×1 pixels so the site builds without broken images; replace them with real screenshots before publication or paper submission.

## Regenerate screenshots

Replace PNGs manually from a staging deployment, or use your own automation. Keep filenames stable so MkDocs and the root `README.md` keep working.

## Capture checklist

| File | Page | Notes |
|------|------|--------|
| `login.png` | Login / register | Mask real emails; `demo@example.com` is fine for demos. |
| `dashboard.png` | Dashboard | Include success / failed / running runs so charts are non-empty. |
| `runs.png` | Runs list (`/runs`) | Status, progress, tags, start time. |
| `workflow-detail.png` | Run detail (`/runs/{id}`) | Metadata, progress, DAG or summary. |
| `jobs.png` | Run detail → Jobs tab | Rule, status, runtime, wildcards. |
| `error-detail.png` | Failed run / job | Error type, rule, traceback or log. |
| `results-preview.png` | Result tab | Prefer TSV, HTML, or PNG preview. |
| `catalog-list.png` | Catalog list | Several entries; tags / file count / DAG state. |
| `catalog-detail.png` | Catalog detail | Tree, Snakefile/config, recent runs. |
| `dag-preview.png` | Catalog or run DAG | Use a workflow that renders successfully. |
| `api-tokens.png` | Settings → API Tokens | Optional; advanced path. |
| `mcp-settings.png` | Settings → MCP | Optional; advanced. |
| `smtp-settings.png` | Settings → SMTP | Optional; admin. |
| `git-settings.png` | Settings → Git | Optional. |

## Standards

- Width around **1440px** or **1600px**; keep the app header visible for context.
- One short **caption** in the Markdown below each image (see user manual pages).
- Do **not** expose real API tokens, private emails, internal IPs, or patient/sample identifiers.

## Demo data (for consistent screenshots)

Prepare before capture:

- At least three runs (e.g. success, running or simulated, failed with a clear error).
- Tags such as `demo` and `rna-seq` or `qc` on those runs.
- One run with previewable outputs (e.g. `results/counts.tsv`, `results/report.html`, `results/plot.png`).
- One catalog workflow with `workflow/Snakefile`, `config/config.yaml`, `workflow/rules/*.smk`, and a working DAG preview.

## Root `README.md`

The repository **README** uses a small set of marketing shots: **`dashboard.png`**, **`workflow-detail.png`**, **`catalog-list.png`**, **`dag-preview.png`**. Optional extras such as **`workflow.png`**, **`dag.png`**, **`jobs.png`**, and **`login.png`** may still appear in the user manual. **`token.png`** is only needed for the **Login and CLI** page (`api-tokens` screenshot); it is **not** featured on the README hero strip. CLI login is shown as **code blocks** in the docs (no `cli.png` / `cli-login.png`).
