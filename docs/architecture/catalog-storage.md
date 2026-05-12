# Catalog storage model

The workflow catalog uses a **hybrid** model: PostgreSQL holds authoritative file bytes and history; disk is a **materialized workspace** for tools that expect a filesystem.

## Database as source of truth

All catalog file bodies (Snakefiles, configs, rules, …) are stored in PostgreSQL. That enables:

- **Versioning** — every save creates a row in **`catalog_file_versions`**.
- **Portability** — any backend instance can serve file content and search without a shared NFS for the catalog *per se*.
- **UI reads** — listing, opening, and editing files in the web UI is backed by **database reads** (and API responses), not “whatever happens to be on disk right now.”

## Materialized workspace on disk

FlowO also exports the latest (or requested) versions to paths under **`FLOWO_WORKING_PATH`** so that:

1. **Snakemake / Snakevision** can run `snakemake --rulegraph`, lint, or similar against real paths.
2. **Heavy or repeated** file access during DAG generation can use normal OS caching where helpful.

The on-disk tree is a **cache / checkout** derived from the database. It can be deleted or moved; FlowO can **backfill** or re-export from PostgreSQL when the catalog UI or background jobs need files on disk again.

### Important nuance

- **Catalog file browsing in the app** is **not** “only whatever is on local disk.” The authoritative content is in the DB; disk is there for **Snakemake compatibility** and **DAG / tooling** workflows.

## External synchronization (Git)

For Git-backed entries:

- **Pull** clones or fast-forwards a remote checkout (often into a temporary or workspace path).
- **Ingest** reads files into PostgreSQL and updates the **`catalogs`** / file tables.
- **Materialized paths** under the working directory are updated so the next Snakemake-based step sees consistent content.
