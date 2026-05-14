# Quick Start

Docker Compose → sign in → **`flowo login`** → one Snakemake run with **`--logger flowo`**, then check **Dashboard** / **Runs**.

If FlowO is already running elsewhere, use that URL instead of `http://localhost:3100` and skip **Deploy**.

---

## Install FlowO with Docker Compose

### Deploy

1. **Fetch configuration** (adjust if you mirror the repo):

   ```bash
   curl -O https://raw.githubusercontent.com/zhanghaomiao/flowo/main/compose.yml
   curl -O https://raw.githubusercontent.com/zhanghaomiao/flowo/main/env.example
   cp env.example .env
   ```

2. **Edit `.env`** — set **`FLOWO_WORKING_PATH`**, **`SECRET_KEY`**, and DB passwords at minimum; optionally **`FLOWO_BOOTSTRAP_ADMIN_EMAIL`** / **`FLOWO_BOOTSTRAP_ADMIN_PASSWORD`**, **`DOMAIN`** / **`FLOWO_HOST`**. Remove bootstrap password from `.env` after you can sign in.

3. **Start**

   ```bash
   docker compose up -d
   ```

### Superuser

!!! info "Superuser"

    If **`FLOWO_BOOTSTRAP_ADMIN_EMAIL`** and **`FLOWO_BOOTSTRAP_ADMIN_PASSWORD`** are set in `.env`, the first start already created a superuser (see **Edit `.env`** above). Otherwise run:

    ```bash
    docker compose exec flowo python -m app.manage create-admin you@example.com 'your-strong-password'
    ```

Open [http://localhost:3100](http://localhost:3100), sign in, and register another user from the login page if public signup is enabled.

### Logger and CLI

```bash
pip install snakemake-logger-plugin-flowo
flowo login --host http://localhost:3100
```

Complete the browser approval; the CLI writes **`~/.config/flowo/config.toml`** (mode **`0600`**). You should see something like `Login successful. Configuration saved to ~/.config/flowo/config.toml`.

### First Snakemake run

Work under the host directory you set as **`FLOWO_WORKING_PATH`** in `.env` (same tree the server mounts) so **Result preview** matches reported paths.

```bash
cd /path/to/FLOWO_WORKING_PATH
flowo catalog new flowo-quickstart
cd flowo-quickstart
flowo catalog upload --path .
snakemake -n --cores 1 --directory .test --logger flowo \
  --logger-flowo-name "Quickstart" \
  --logger-flowo-tags "demo" \
  --logger-flowo-catalog flowo-quickstart
```

Omit **`flowo catalog upload`** if you only want a run without a catalog link. Template layout, uploads, and logger flags in depth: **[Catalog and templates](user-manual/catalog.md)**, **[Run Snakemake with FlowO](user-manual/run-snakemake.md)**.

Then open **Runs** (and **Dashboard**) for the new run.

---

## Next steps

- [Installation](user-manual/installation.md) — Docker + `.env` checklist.
- [Environment variables](reference/environment-variables.md) — full env tables.
- [Login and CLI setup](user-manual/login-cli.md) — tokens, headless, **`--working-path`** when paths differ.
- [Architecture overview](architecture/overview.md).
