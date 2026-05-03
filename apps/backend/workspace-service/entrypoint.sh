#!/bin/sh
set -e

if [ "$WORKSPACE_STORE_TYPE" = "postgres" ]; then
    echo "Running database migrations..."
    alembic upgrade head
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8001