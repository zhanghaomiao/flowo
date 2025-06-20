# Snakemake Logger Plugin PostgreSQL

A PostgreSQL-based logging plugin for Snakemake workflows that provides persistent storage and monitoring capabilities.

## Features

- Persistent storage of workflow execution data in PostgreSQL
- Real-time monitoring of workflow progress
- Detailed job and rule tracking
- Support for multiple workflow runs
- RESTful API for data access

## Installation

```bash
pip install snakemake-logger-plugin-postgresql
```

## Usage

1. Configure your Snakemake workflow to use the PostgreSQL logger:

```python
# In your Snakemake workflow
logger = "postgresql"
```

2. Set up the required environment variables:

```bash
export POSTGRES_DB=snakemake_logs
export POSTGRES_USER=snakemake
export POSTGRES_PASSWORD=your_password
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
```

3. Run your Snakemake workflow as usual:

```bash
snakemake --logger postgresql
```

## Development

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/yourusername/snakemake-logger-plugin-postgresql.git
cd snakemake-logger-plugin-postgresql

# Install development dependencies
pip install -e ".[dev]"
```

### Running Tests

```bash
pytest
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

Zhang JM (zhangjm@miaobio.com)
