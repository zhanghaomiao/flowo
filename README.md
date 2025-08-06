# Snakemake PostgreSQL Logger Plugin - Docker Setup

This repository provides a Docker Compose setup for running Snakemake with PostgreSQL logging and database monitoring.

## Database Migration with Alembic (Hybrid Approach)

This project uses a **hybrid approach** for database schema management:

- **Alembic**: Manages table structures, indexes, and schema changes
- **Init-DB Scripts**: Manages functions, triggers, and stored procedures

### Migration Flow

1. **PostgreSQL Container** starts first and becomes healthy
2. **Alembic Migration Service** runs `alembic upgrade head` to create table schemas  
3. **Same Service** then executes `init-db/01-triggers-functions.sql` to create functions and triggers
4. **Application Services** (backend, monitor) start only after both migrations complete successfully

**Execution Order is Critical**: Tables must exist before triggers can be created on them.

### Key Changes

- ✅ **Hybrid Management**: Tables via Alembic, Functions/Triggers via SQL scripts
- ✅ **Environment Variables**: Database connection configured via environment variables
- ✅ **Dependency Management**: Services wait for both types of migrations to complete
- ✅ **Best of Both**: Version-controlled tables + Direct SQL for complex database objects

### File Organization

```
init-db/                          # PostgreSQL init scripts (functions, triggers)
├── 01-triggers-functions.sql     # Database monitoring triggers and functions

snakemake_logger_plugin_postgresql/alembic/
├── versions/                     # Alembic migrations (tables, indexes)
│   └── 2bb0077c55d5_initial_schema_from_models.py
├── alembic.ini                   # Alembic configuration
└── env.py                        # Environment setup
```

### Running the Application

```bash
# Start all services (migrations run automatically)
docker-compose up -d

# View migration logs
docker-compose logs alembic-migrations

# Run only specific services
docker-compose up postgresql alembic-migrations
```

### Creating New Migrations

```bash
# Enter the application container
docker-compose exec snakemake-backend bash

# Generate new migration
cd snakemake_logger_plugin_postgresql
alembic revision --autogenerate -m "Description of changes"

# Apply migrations manually (if needed)
alembic upgrade head
```

## Architecture Options

### Option 1: Separate Monitoring Service (Recommended)
**File**: `docker-compose.yml`

```bash
# Copy environment file
cp .env.example .env

# Start services
docker-compose up -d
```

**Services:**
- `postgresql`: PostgreSQL database server
- `snakemake-backend`: Main Snakemake application
- `db-monitor`: Dedicated monitoring service (lightweight Python container)

**Benefits:**
- Clear separation of concerns
- Independent scaling and restart policies
- Lightweight monitoring container
- Easy to disable monitoring if needed

### Option 2: Integrated Monitoring (Alternative)
**File**: `docker-compose.integrated.yml`

```bash
# Start with integrated monitoring
docker-compose -f docker-compose.integrated.yml up -d
```

**Services:**
- `postgresql`: PostgreSQL database server
- `snakemake-backend`: Combined application and monitoring service

**Benefits:**
- Fewer containers to manage
- Shared resources and logs
- Simpler networking

## Environment Configuration

Create a `.env` file with the following variables:

```env
# Database Configuration
POSTGRES_DB=snakemake_logs
POSTGRES_USER=snakemake
POSTGRES_PASSWORD=your_secure_password
POSTGRES_PORT=5432

# Application Configuration
REPO_PATH=./
BACKEND_PORT=8000
SNAKEMAKE_CORES=4
LOG_LEVEL=INFO

# Monitoring (for integrated setup)
ENABLE_DB_MONITORING=true
```

## Database Monitoring Features

### Automatic Change Detection
The setup includes PostgreSQL triggers and functions that automatically:
- Log all INSERT, UPDATE, DELETE operations
- Send real-time notifications via PostgreSQL LISTEN/NOTIFY
- Track which specific fields changed
- Store change history in `change_notifications` table

### Monitoring Methods

1. **Real-time Notifications**: Uses PostgreSQL LISTEN/NOTIFY for instant change detection
2. **Polling**: Checks for unprocessed notifications every 10 seconds
3. **Change History**: Full audit trail of all database changes

### Database Schema

The system creates these main tables:
- `workflow_runs`: Snakemake workflow execution records
- `job_executions`: Individual job/rule execution records  
- `log_entries`: Detailed log messages
- `change_notifications`: Audit trail of all changes

## Usage Examples

### Start the Full Setup
```bash
# Copy example environment
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Monitor Database Changes
```bash
# View monitoring logs
docker-compose logs -f db-monitor

# Connect to database directly
docker-compose exec postgresql psql -U snakemake -d snakemake_logs

# Query recent changes
SELECT * FROM get_recent_changes('2024-01-01'::timestamp);
```

### Testing the Triggers

Connect to the database and insert test data:

```sql
-- Connect to database
docker-compose exec postgresql psql -U snakemake -d snakemake_logs

-- Insert a test workflow
INSERT INTO workflow_runs (workflow_name, status) 
VALUES ('test_workflow', 'running');

-- Check notifications were created
SELECT * FROM change_notifications ORDER BY timestamp DESC LIMIT 5;
```

## Container Size Comparison

| Container Type | Base Image | Size | Purpose |
|---------------|------------|------|---------|
| Original (❌) | postgres:15-alpine | ~280MB | Full PostgreSQL server for monitoring |
| Improved (✅) | python:3.12-alpine | ~150MB | Only PostgreSQL client tools |
| Integrated (✅) | python:3.12-slim | ~200MB | Combined app + monitoring |

## Why the Original Design Was Problematic

The initial setup used `postgres:15-alpine` for both database and monitoring services:

```yaml
# ❌ Problematic - both use same heavy image
postgresql:
  image: postgres:15-alpine  # ~280MB, runs PostgreSQL server
  
db-monitor:
  image: postgres:15-alpine  # ~280MB, only needs psql client
```

**Issues:**
1. **Resource waste**: Monitoring container loads full PostgreSQL server
2. **Security**: Unnecessary services running in monitoring container
3. **Confusion**: Same image for different purposes
4. **Maintenance**: Harder to optimize containers independently

## Improved Solutions

### Solution 1: Lightweight Monitoring Container
```yaml
# ✅ Better - dedicated lightweight monitoring
db-monitor:
  build:
    dockerfile: Dockerfile.monitor  # python:3.12-alpine + psql client
```

### Solution 2: Integrated Services
```yaml
# ✅ Alternative - single container with supervisor
snakemake-backend:
  build:
    dockerfile: Dockerfile.integrated  # Combined app + monitoring
```

## Security Considerations

- Change default passwords in production
- Use Docker secrets for sensitive data
- Limit network exposure of PostgreSQL port
- Enable PostgreSQL SSL in production
- Regular backup of persistent volumes

## Troubleshooting

### Common Issues

1. **Permission denied on monitoring scripts**:
   ```bash
   chmod +x monitor/*.sh monitor/*.py
   ```

2. **Database connection errors**:
   ```bash
   # Check if PostgreSQL is ready
   docker-compose exec postgresql pg_isready
   ```

3. **Monitoring not working**:
   ```bash
   # Check if triggers are installed
   docker-compose exec postgresql psql -U snakemake -d snakemake_logs \
     -c "SELECT tgname FROM pg_trigger WHERE tgname LIKE '%notify%';"
   ```

### Logs Location

- Application logs: `./logs/`
- Database logs: Available via `docker-compose logs postgresql`
- Monitoring logs: Available via `docker-compose logs db-monitor`

## Development

To extend the monitoring functionality:

1. Edit `monitor/python_monitor.py` for custom notification handling
2. Modify `init-db/02-triggers-functions.sql` for additional triggers
3. Update the database schema in `init-db/01-init-schema.sql`

The monitoring system is designed to be extensible and can be adapted for various use cases beyond Snakemake logging.
