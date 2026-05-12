# Quick Start

This guide takes you from zero to a **visible Snakemake run** in FlowO: deploy (or use a demo server), sign in, configure `flowo login`, run Snakemake with `--logger flowo`, and confirm the run on the **Dashboard** and **Runs** pages.

## Option A — Use an existing deployment (optional)

!!! tip
    If your team publishes a **public evaluation host**, use that URL in the steps below and obtain any shared demo credentials from the **maintainers**. Do not run confidential pipelines on shared sandboxes; credentials and URLs may change without notice.

1. Open the deployment URL in a browser and sign in (or register if allowed).
2. On your workstation, install the logger plugin (see Option B) and run:

   ```bash
   flowo login --host https://your-flowo-host
   ```

3. Complete the browser approval flow; the CLI stores the token under `~/.config/flowo/config.toml` (mode `0600`).

![Login page with email and password fields](assets/images/login.png)

Typical terminal output after a successful login (no token is printed):

```text
$ flowo login --host https://your-flowo-host
Opening browser for authentication…
Waiting for you to approve this device in the browser…
Login successful. Configuration saved to ~/.config/flowo/config.toml
```

4. Run Snakemake from any project directory:

   ```bash
   snakemake --logger flowo --logger-flowo-name "demo-quickstart" --logger-flowo-tags demo,qc
   ```

5. In the UI, open **Dashboard** and **Runs** (`/runs`) to see the new run.

![Dashboard with non-empty status cards and charts](assets/images/dashboard.png)

---

## Option B — Local Docker Compose

### 1. Deploy FlowO

1. **Fetch configuration** (adjust URLs if you mirror the repo):

   ```bash
   curl -O https://raw.githubusercontent.com/zhanghaomiao/flowo/main/compose.yml
   curl -O https://raw.githubusercontent.com/zhanghaomiao/flowo/main/env.example
   cp env.example .env
   ```

2. **Edit `.env`**
   - Set **`FLOWO_WORKING_PATH`** to a host directory that will contain (or parent) your Snakemake working directories so logs and previews resolve.
   - Set **`SECRET_KEY`** and database passwords for anything beyond local trials.
   - Optionally set **`DOMAIN`** / **`FLOWO_HOST`** when serving behind HTTPS.

3. **Start services**

   ```bash
   docker compose up -d
   ```

4. **Open the app** — default [http://localhost:3100](http://localhost:3100), register the first user (if enabled), then sign in.

### 2. Install the plugin and CLI login

```bash
pip install snakemake-logger-plugin-flowo
```

```bash
flowo login --host http://localhost:3100
```

Use the same flow as Option A: run `flowo login`, approve in the browser, confirm the token is saved under `~/.config/flowo/config.toml`.

### 3. Run Snakemake with FlowO

```bash
cd /path/to/your/snakemake/project

snakemake --logger flowo \
  --logger-flowo-name "My first run" \
  --logger-flowo-tags "demo,quickstart"
```

### What happens next?

1. **Runs** — Open **Runs** in the top navigation (`/runs`). The new execution appears with status, tags, and progress.
2. **Detail** — Click the run name to open **`/runs/{id}`**: DAG on the left; **Jobs**, **Timeline**, **Code**, and **Result** tabs on the right.
3. **Dashboard** — Aggregate cards and charts update as events arrive (SSE).

---

## Next steps

- [Installation](user-manual/installation.md) — ports, `.env`, HTTPS, and path alignment.
- [Run Snakemake with FlowO](user-manual/run-snakemake.md) — name, tags, catalog slug, config keys.
- [Catalog and templates](user-manual/catalog.md) — browse and link runs to catalog workflows.
- [Architecture overview](architecture/overview.md) — how components fit together.
