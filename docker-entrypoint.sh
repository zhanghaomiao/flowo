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

# Hand over to CMD (supervisord)
exec "$@"
