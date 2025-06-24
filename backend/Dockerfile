FROM hub.miaodocker.space:8443/library/python:3.12-slim-bookworm

WORKDIR /app

# Install system dependencies
# Configure apt to use a mirror
RUN echo "deb http://mirrors.aliyun.com/debian/ bookworm main contrib non-free" > /etc/apt/sources.list \
    && echo "deb http://mirrors.aliyun.com/debian/ bookworm-updates main contrib non-free" >> /etc/apt/sources.list \
    && echo "deb http://mirrors.aliyun.com/debian-security bookworm-security main contrib non-free" >> /etc/apt/sources.list

RUN apt-get update && apt-get install -y \
    build-essential \
    postgresql-client \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Install uv package manager
RUN pip install uv -i https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple

# Copy only dependency files first (for better Docker layer caching)
COPY pyproject.toml uv.lock* alembic.ini README.md /app/

# Install dependencies in virtual environment (this creates .venv during build)
RUN uv sync --frozen --no-dev

# Copy the source code (done after dependency installation for better caching)
COPY ./app /app/app
COPY ./scripts /app/scripts

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"
ENV UV_PROJECT_ENVIRONMENT=/app/.venv
