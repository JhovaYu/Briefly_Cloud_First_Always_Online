#!/bin/bash
# init-workspace-db.sh — runs inside postgres container as superuser
# Creates the briefly_workspace database if it doesn't exist

# Check if database already exists
if ! psql -tc "SELECT 1 FROM pg_database WHERE datname = 'briefly_workspace'" -U "$POSTGRES_USER" -d "$POSTGRES_DB" | grep -q 1; then
    echo "Creating briefly_workspace database..."
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE briefly_workspace"
    echo "Database created."
else
    echo "Database briefly_workspace already exists, skipping."
fi