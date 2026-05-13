# Quick Start

This guide takes you from zero to a **visible Snakemake run** in FlowO: install with Docker Compose, sign in, run `flowo login`, scaffold a small project with **`flowo catalog new`** from the official template, run Snakemake with **`--logger flowo`** (and a **catalog slug**), then confirm the run on **Dashboard** and **Runs**.

If FlowO is **already running elsewhere** (someone gave you a URL), use that host everywhere below instead of `http://localhost:3100`, and skip the **Deploy** section.

---

## Install FlowO with Docker Compose

### Deploy

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
   - **Optional — first superuser without `docker exec`:** set **`FLOWO_BOOTSTRAP_ADMIN_EMAIL`** and **`FLOWO_BOOTSTRAP_ADMIN_PASSWORD`**. On the first container start (after migrations), FlowO creates that superuser only if the database has none yet. Remove or blank these after you can sign in; do not keep bootstrap passwords in `.env` long term. (The default `compose.yml` image runs this in its entrypoint; **`compose.dev.yml`** does not—use `create-admin` in the backend container, or run `python -m app.manage bootstrap-admin-from-env` once by hand.)

3. **Start services**

   ```bash
   docker compose up -d
   ```

4. **Superuser** — If **`FLOWO_BOOTSTRAP_ADMIN_EMAIL`** and **`FLOWO_BOOTSTRAP_ADMIN_PASSWORD`** are both set in `.env` (see the bullet **Optional — first superuser** under **Edit `.env`** above), the first start already created an account—**skip** the command below. Otherwise create one manually:

   ```bash
   docker compose exec flowo python -m app.manage create-admin you@example.com 'your-strong-password'
   ```

5. **Open the app** — default [http://localhost:3100](http://localhost:3100). Sign in with the superuser. You can still **register** an extra user from the login page when public registration is enabled.

### Logger and CLI login

```bash
pip install snakemake-logger-plugin-flowo
```

```bash
flowo login --host http://localhost:3100
```

After you approve the device in the browser, the FlowO **server** sends its configured **`FLOWO_WORKING_PATH`** in the login poll response; the `flowo` CLI writes it into **`~/.config/flowo/config.toml`** together with the token (unless you override with **`--working-path`**). That matches the usual Docker setup where Snakemake runs on the **same host** as Compose and uses the same mounted directory.

Use **`--working-path`** only when the path on your Snakemake machine **differs** from the server’s value (different mount point, SSH to another host, etc.).

Run `flowo login`, approve in the browser, and confirm the token is saved under `~/.config/flowo/config.toml` (mode `0600`).

Typical terminal output after a successful login (no token is printed):

```text
$ flowo login --host http://localhost:3100
Opening browser for authentication…
Waiting for you to approve this device in the browser…
Login successful. Configuration saved to ~/.config/flowo/config.toml
```

### Run Snakemake with FlowO

Work **inside** the folder saved as **`FLOWO_WORKING_PATH`** in `~/.config/flowo/config.toml` (same path the FlowO server mounts) so paths and **Result preview** line up.

1. **`flowo catalog new flowo-quickstart`** — Copies the [official Snakemake template](https://github.com/snakemake-workflows/snakemake-workflow-template) into a new directory on **your computer**. It does **not** send anything to FlowO yet, and it is **not** `git push` to GitHub.

2. **`flowo catalog upload`** (or creating the same catalog in the **web UI**) — This is what **uploads the project into FlowO** (the **Catalog** area). After that catalog exists with slug **`flowo-quickstart`**, Snakemake runs that use **`--logger-flowo-catalog flowo-quickstart`** **link** to that catalog entry in the database.

3. **If you skip upload** — You still get a normal **Run** on **Runs** / **Dashboard**. The run simply has **no** catalog link until you upload (or add a matching catalog in the UI) and run again with the same slug.

The first **`flowo catalog new`** may run **`git clone`** once to download the template (needs **`git`** and GitHub access). Air-gapped: put a full template checkout under `snakemake-workflow-template/workflow/` next to your working path—see [Catalog and templates](user-manual/catalog.md).

The official template ships a **`.test`** directory (note the leading dot) with small inputs. Run Snakemake with **`--directory .test`**, as in the [upstream README](https://github.com/snakemake-workflows/snakemake-workflow-template#deployment-options). A real run typically uses **`--sdm conda`** for software environments; if you do not have conda ready, use the **dry-run** block below instead.

```bash
cd "/absolute/host/path/you/set/as/FLOWO_WORKING_PATH"
flowo catalog new flowo-quickstart
cd flowo-quickstart
# Upload this folder into FlowO (Catalog). Omit the next line if you only want a Run without a catalog link.
flowo catalog upload --path .
snakemake --cores 1 --directory .test --sdm conda --logger flowo \
  --logger-flowo-name "Template quickstart" \
  --logger-flowo-tags "demo,quickstart" \
  --logger-flowo-catalog flowo-quickstart
```

If you cannot run conda environments yet, a **dry run** against **`.test`** still registers a run in FlowO:

```bash
cd "/absolute/host/path/you/set/as/FLOWO_WORKING_PATH/flowo-quickstart"
snakemake -n --cores 1 --directory .test --logger flowo \
  --logger-flowo-name "Template quickstart (dry run)" \
  --logger-flowo-tags "demo,quickstart" \
  --logger-flowo-catalog flowo-quickstart
```

### What happens next?

1. **Runs** — Open **Runs** (`/runs`) and open the run detail.
2. **Detail** — **DAG**, **Jobs**, **Timeline**, **Code**, **Result** (when paths match the server mount).
3. **Dashboard** — Summary updates over SSE.
4. **Catalog** — After **`flowo catalog upload`** (or the web UI), runs with the **same `--logger-flowo-catalog` slug** appear **under that catalog** in FlowO; see [Catalog and templates](user-manual/catalog.md).

---

## Next steps

- [Installation](user-manual/installation.md) — minimal Docker + `.env` checklist.
- [Environment variables](reference/environment-variables.md) — full tables for server and Compose settings.
- [Run Snakemake with FlowO](user-manual/run-snakemake.md) — name, tags, catalog slug, config keys.
- [Catalog and templates](user-manual/catalog.md) — browse and link runs to catalog workflows.
- [Architecture overview](architecture/overview.md) — how components fit together.
