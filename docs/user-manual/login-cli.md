# Login and CLI Setup

Authenticating the FlowO CLI lets the Snakemake logger post events to your FlowO server. There are two supported setup paths:

- **`flowo login`** for interactive workstations or login nodes where you can complete a browser/device-login flow.
- **Manual token config** for HPC clusters, CI, batch jobs, and other headless environments.

!!! tip
    If you are evaluating a **shared demo deployment**, get the URL and any demo credentials from your **maintainers** or administrator. Do not store sensitive data on shared hosts.

## Interactive Setup: `flowo login`

1. Install the PyPI package (see [Installation](installation.md)) so the `flowo` CLI is available.
2. Run (replace the host with your deployment):

   ```bash
   flowo login --host https://your-flowo-host
   ```

   Optional: **`--working-path /path/on/this/machine`** if that path differs from the value the server would suggest (see below).

3. A browser window opens. If no browser is available, the CLI prints a URL that you can open elsewhere. Sign in to FlowO and approve the device.
4. On success, the CLI writes **`~/.config/flowo/config.toml`** (Linux/macOS; similar paths on Windows) with `0600` permissions, including **`FLOWO_WORKING_PATH`** when the server returns it in the login response (typical Docker: same path you set in the server `.env`).

Example session (wording may vary slightly by CLI version; tokens are **not** echoed):

```text
$ flowo login --host https://your-flowo-host
Opening browser for authentication…
Waiting for you to approve this device in the browser…
Login successful. Configuration saved to ~/.config/flowo/config.toml
```

The file should look like this (use your real host and paths; keep the token private):

```toml
FLOWO_HOST = "https://your-flowo-host"
FLOWO_USER_TOKEN = "<stored-by-flowo-login>"
FLOWO_WORKING_PATH = "/same/host/path/as/the/server/FLOWO_WORKING_PATH"
```

For **`flowo login`**, the server includes **`FLOWO_WORKING_PATH`** in the device-login response so the CLI can persist it automatically when you do **not** pass **`--working-path`**. That keeps same-host Docker setups aligned with the Compose mount. Override with **`--working-path`** when your Snakemake host sees a different absolute path than the server’s configured value.

## Headless Setup: API Token Config

Use this path when the machine that runs Snakemake cannot open a browser, such as HPC compute nodes, locked-down CI runners, or batch jobs.

1. In the web UI: **Settings** → **API Tokens** → create a token with a label and expiry.
2. On the machine or user account that runs Snakemake, create the config directory:

   ```bash
   mkdir -p ~/.config/flowo
   chmod 700 ~/.config/flowo
   ```

3. Create **`~/.config/flowo/config.toml`**:

   ```toml
   FLOWO_HOST = "https://your-flowo-host"
   FLOWO_USER_TOKEN = "flw_xxxxxx"
   FLOWO_WORKING_PATH = "/path/seen/by/snakemake"
   ```

4. Restrict the file permissions:

   ```bash
   chmod 600 ~/.config/flowo/config.toml
   ```

`FLOWO_HOST` must be reachable from the machine running Snakemake. If FlowO runs on that same machine, **`http://localhost:3100`** is fine. If FlowO runs on another server, use that server IP, hostname, or HTTPS URL.

`FLOWO_WORKING_PATH` should be the path as seen by the Snakemake execution environment, for example a shared filesystem path such as **`/publicfs/ucas/user/campoverde`**.

![API Tokens settings page for creating a long-lived token](../assets/images/api-tokens.png)

!!! note
    Treat tokens like passwords. FlowO does not recommend passing tokens as command-line arguments because they can leak through shell history, process listings such as `ps`, scheduler logs, or CI logs.

!!! example "HPC / cluster example"
    A typical cluster setup is:

    1. Run the FlowO server somewhere reachable, such as **`http://flowo-server:3100`**.
    2. Open the FlowO UI from your workstation browser.
    3. Create an API token under **Settings → API Tokens**.
    4. Write **`~/.config/flowo/config.toml`** on the login node or shared home used by Snakemake jobs.
    5. Run Snakemake with **`--logger flowo`**. No browser is needed at Snakemake runtime.

## Verify connectivity

```bash
flowo catalog list
```

An empty list without an error means authentication and HTTPS reachability are working.

## See also

- [Run Snakemake with FlowO](run-snakemake.md)
- [FAQ — token storage and login failures](../faq.md)
