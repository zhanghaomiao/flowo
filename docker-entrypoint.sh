#!/bin/bash
set -e

echo "🚀 Starting FlowO setup..."

# Run database migrations
echo "Running database migrations..."
if alembic upgrade head; then
    echo "✅ Database migrations completed successfully!"
else
    echo "❌ Database migrations failed!"
    exit 1
fi

# Optional: first superuser from env (see env.example / README)
echo "Checking optional FLOWO_BOOTSTRAP_ADMIN_* …"
python -m app.manage bootstrap-admin-from-env || {
    echo "❌ Bootstrap admin step failed!"
    exit 1
}

# Hand over to CMD (supervisord)
exec "$@"
