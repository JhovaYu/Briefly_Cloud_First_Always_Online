#!/bin/bash
# init-schedule-db.sh — runs inside postgres container as superuser
# Creates the briefly_schedule database if it doesn't exist

# Check if database already exists
if ! psql -tc "SELECT 1 FROM pg_database WHERE datname = 'briefly_schedule'" -U "$POSTGRES_USER" -d "$POSTGRES_DB" | grep -q 1; then
    echo "Creating briefly_schedule database..."
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE briefly_schedule"
    echo "Database created."
else
    echo "Database briefly_schedule already exists, skipping."
fi