# Installation Guide - Snakemake PostgreSQL Logger Plugin

This guide shows you how to properly install and use the Snakemake PostgreSQL Logger Plugin using `uv`.

## Prerequisites

1. **Python 3.12+** - Required version
2. **uv** - Fast Python package installer
3. **PostgreSQL** - Database server

## Installation Methods

### Method 1: Development Installation (Recommended for Development)

This installs the package in editable mode, so changes to the source code are immediately available:

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd snakemake-logger-plugin-postgresql

# 2. Create environment variable file
cp env.example .env
# Edit .env with your database settings

# 3. Install in development mode with uv
uv pip install -e .

# 4. Install with development dependencies (optional)
uv pip install -e ".[dev]"

# 5. Install with Docker dependencies (optional)
uv pip install -e ".[docker]"
```

### Method 2: Production Installation

```bash
# 1. Build the package
uv build

# 2. Install the built package
uv pip install dist/snakemake_logger_plugin_postgresql-0.1.0-py3-none-any.whl

# Or install directly from source
uv pip install .
```

### Method 3: Docker Installation

```bash
# 1. Copy environment file
cp env.example .env

# 2. Start services with Docker Compose
docker-compose up -d

# The package will be installed automatically in the container
```

## Verification

Test that the package is installed correctly:

```python
# Test import
import snakemake_logger_plugin_postgresql
print(snakemake_logger_plugin_postgresql.__version__)

# Test configuration loading
from snakemake_logger_plugin_postgresql.core.config import settings
print(f"Database URL: {settings.SQLALCHEMY_DATABASE_URI}")

# Test LogHandler
from snakemake_logger_plugin_postgresql import LogHandler
print("✅ Package installed successfully!")
```

## Database Setup

### Option 1: Using Alembic (Recommended)

```bash
# 1. Set up environment variables
export POSTGRES_HOST=localhost
export POSTGRES_USER=snakemake
export POSTGRES_PASSWORD=your_password
export POSTGRES_DB=snakemake_logs

# 2. Create initial migration (if needed)
alembic revision --autogenerate -m "Initial migration"

# 3. Run migrations
alembic upgrade head
```

### Option 2: Using SQL Scripts

```bash
# If you prefer to use the static SQL files
psql -h localhost -U snakemake -d snakemake_logs -f init-db/01-init-schema.sql
psql -h localhost -U snakemake -d snakemake_logs -f init-db/02-triggers-functions.sql
```

## Usage with Snakemake

### Basic Usage

```python
# In your Snakemake workflow
from snakemake_logger_plugin_postgresql import LogHandler

# The plugin will be automatically discovered by Snakemake
# when you use the --logger-plugin option
```

### Command Line Usage

```bash
# Run Snakemake with PostgreSQL logging
snakemake --logger-plugin postgresql your_workflow.smk

# With custom database settings
POSTGRES_HOST=your_host POSTGRES_USER=your_user snakemake --logger-plugin postgresql your_workflow.smk
```

### Configuration

The plugin uses environment variables for configuration. Create a `.env` file:

```env
# Database Configuration
POSTGRES_DB=snakemake_logs
POSTGRES_USER=snakemake
POSTGRES_PASSWORD=your_secure_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Or use a direct DATABASE_URL
# DATABASE_URL=postgresql://user:pass@host:port/dbname

# Application Configuration
LOG_LEVEL=INFO
ENABLE_DB_MONITORING=true
```

## Troubleshooting

### Import Errors

If you get import errors, ensure:

1. **Package is installed correctly**:
   ```bash
   uv pip list | grep snakemake-logger-plugin
   ```

2. **Python path is correct**:
   ```python
   import sys
   print(sys.path)
   ```

3. **Dependencies are installed**:
   ```bash
   uv pip check
   ```

### Database Connection Issues

1. **Test database connection**:
   ```python
   from snakemake_logger_plugin_postgresql.core.config import settings
   from sqlalchemy import create_engine
   
   engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
   with engine.connect() as conn:
       result = conn.execute("SELECT 1")
       print("✅ Database connection successful!")
   ```

2. **Check environment variables**:
   ```bash
   python -c "from snakemake_logger_plugin_postgresql.core.config import settings; print(settings.SQLALCHEMY_DATABASE_URI)"
   ```

### Alembic Issues

1. **Reset migrations**:
   ```bash
   # Remove alembic_version table and start fresh
   alembic stamp base
   alembic upgrade head
   ```

2. **Generate new migration**:
   ```bash
   alembic revision --autogenerate -m "Your migration message"
   ```

## Development Workflow

### Setting up Development Environment

```bash
# 1. Clone and setup
git clone <repo>
cd snakemake-logger-plugin-postgresql

# 2. Install in development mode
uv pip install -e ".[dev]"

# 3. Install pre-commit hooks (optional)
pre-commit install

# 4. Run tests
pytest

# 5. Format code
black snakemake_logger_plugin_postgresql/
ruff snakemake_logger_plugin_postgresql/
```

### Making Changes

1. **Edit code** in `snakemake_logger_plugin_postgresql/`
2. **Test changes** - they're immediately available due to editable install
3. **Run tests**: `pytest`
4. **Create migrations** if models changed: `alembic revision --autogenerate`

## Package Structure

```
snakemake-logger-plugin-postgresql/
├── snakemake_logger_plugin_postgresql/    # Main package
│   ├── __init__.py                        # Package entry point
│   ├── core/                              # Core functionality
│   │   ├── config.py                      # Configuration management
│   │   └── session.py                     # Database session
│   ├── models/                            # SQLAlchemy models
│   │   ├── base.py                        # Base model class
│   │   ├── workflow.py                    # Workflow model
│   │   └── ...                            # Other models
│   ├── log_handler.py                     # Main log handler
│   ├── event_handlers.py                  # Event processing
│   └── parsers.py                         # Log parsing
├── alembic/                               # Database migrations
├── init-db/                               # SQL initialization files
├── docker-compose.yml                     # Docker setup
├── pyproject.toml                         # Package configuration
└── README.md                              # Documentation
```

## Next Steps

1. **Configure your database** connection in `.env`
2. **Run database migrations** with Alembic
3. **Test the installation** with the verification code above
4. **Use with Snakemake** workflows
5. **Monitor your workflows** through the PostgreSQL database 