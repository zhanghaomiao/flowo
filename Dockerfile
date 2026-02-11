FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY frontend/ ./
RUN npm run build

FROM caddy:2-alpine AS caddy-source

FROM ghcr.io/astral-sh/uv:0.9.22-python3.13-bookworm-slim

RUN groupadd --system --gid 1000 flowo \
 && useradd --system --gid 1000 --uid 1000 --create-home flowo

WORKDIR /app

ENV  UV_LINK_MODE=copy \
     UV_NO_DEV=1 \
     PATH="/app/.venv/bin:$PATH"

COPY --from=caddy-source /usr/bin/caddy /usr/bin/caddy

RUN apt-get update && apt-get install -y --no-install-recommends \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=flowo:flowo pyproject.toml uv.lock ./

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --extra server

COPY --chown=flowo:flowo app /app/app
COPY --chown=flowo:flowo README.md alembic.ini ./

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-editable --no-dev --extra server

COPY --chown=flowo:flowo --from=frontend-builder /app/frontend/dist /app/frontend/dist

COPY Caddyfile /etc/caddy/Caddyfile
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN mkdir -p /var/log/supervisor && chown -R flowo:flowo /var/log/supervisor

COPY --chown=flowo:flowo docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
