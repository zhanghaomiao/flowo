# Frequently asked questions

## Runs and dashboard

### Why is my run not appearing under **Runs**?

1. Confirm Snakemake was started with **`--logger flowo`**.
2. Run **`flowo catalog list`** (or any authenticated `flowo` command) to verify the CLI can reach the server and token is valid.
3. Check the Snakemake console for FlowO plugin warnings (host URL, TLS, or 401 errors).

### Why is the live / SSE indicator red or disconnected?

Common causes: network drop, reverse proxy idle timeouts, backend restart, or corporate proxies blocking long-lived GET streams. The UI retries; if it stays offline, reload the page and check server and proxy logs.

## DAG preview

### Why does catalog (or run) DAG stay “generating”?

DAG extraction runs **best-effort** in the backend: it may need a full checkout, conda/snakevision dependencies, and valid `Snakefile`/`config` material on disk. Large repos or missing Python modules delay or block generation. See [DAG preview](user-manual/dag-preview.md).

### Why do I see errors about **pandas** or missing Python modules?

The DAG worker uses the backend environment. Install documented optional dependencies on the server image/host, or simplify the template until `snakemake --lint`-level imports resolve.

## `flowo login`

### Browser callback fails or never returns to the CLI

- Confirm **`FLOWO_HOST`** / public URL matches what you passed to **`--host`** (scheme, hostname, port).
- Try the same URL from a machine with a desktop browser if you SSH through a jump host.
- Fall back to **Settings → API Tokens** and configure `~/.config/flowo/config.toml` manually ([Login and CLI](user-manual/login-cli.md)). This is the recommended path for HPC compute nodes, CI, and other headless environments.

## Catalog and storage

### Why does the database have catalog files but the disk looks empty?

Catalog file bodies are stored in **PostgreSQL**; the working tree under **`FLOWO_WORKING_PATH`** is a **materialized cache** for Snakemake and previews. It can be rebuilt from the database—see [Catalog storage model](architecture/catalog-storage.md).

## Output preview

### Why can’t I preview an output file?

The server must read the path on disk: align **`FLOWO_WORKING_PATH`** (and mounts) with where Snakemake wrote outputs, ensure POSIX permissions for the container user, and avoid moving/deleting files after the run if you still want previews.

### Are huge files previewed?

Very large files may be truncated or download-only for performance. Use download or `less` on the execution host for multi‑GB artifacts.

## Deployment

### How do I use a custom domain and HTTPS?

Terminate TLS at your reverse proxy or use the bundled Caddy pattern from `compose.yml` / your ops guide; set public **`FLOWO_HOST`** / **`DOMAIN`** so redirects and logger URLs match what clients use.

## Security

### Where is my token stored? Is it safe?

Interactive login stores tokens in **`~/.config/flowo/config.toml`** with mode **`0600`**. Protect that file like an SSH private key; rotate tokens from **Settings → API Tokens** if exposed.

Avoid passing tokens as command-line arguments. They can be captured by shell history, process listings, scheduler logs, or CI logs.

## Optional features

### Is **MCP** required?

No. MCP is optional for AI assistant integration ([MCP integration](advanced/mcp.md)).

### Is **SMTP** / email required?

No. Email notifications are an optional administrator feature ([Email notifications](advanced/email-notifications.md)). Full SMTP setup lives under **Settings → SMTP** for admins—see that page, not the main Quick Start.

## Hosted demo

### Can I try FlowO without installing?

If your organization provides a sandbox, obtain the URL and credentials from the **maintainers**, sign in, then run **`flowo login --host …`** from your laptop. Do not upload sensitive data to shared hosts.
