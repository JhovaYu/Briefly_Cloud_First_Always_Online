"""
Alembic async environment for planning-service.

This module configures Alembic to use SQLAlchemy 2.0 async engine.
PLANNING_DATABASE_URL must be set to a valid asyncpg connection string.
"""

from __future__ import annotations

import logging
from typing import Any

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine, async_engine_from_config

from app.config.settings import Settings
from app.adapters.persistence.sqlalchemy.base import Base
from app.adapters.persistence.sqlalchemy.models import TaskListModel, TaskModel

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging.
logging.basicConfig()
logger = logging.getLogger("alembic")

# Set sqlalchemy.url from environment variable (not hardcoded)
settings = Settings()
if settings.PLANNING_DATABASE_URL:
    config.set_main_option("sqlalchemy.url", settings.PLANNING_DATABASE_URL)
else:
    raise RuntimeError(
        "PLANNING_DATABASE_URL environment variable is required to run migrations. "
        "Set PLANNING_DATABASE_URL to your asyncpg connection string."
    )

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL and not an Engine.
    Calls to context.execute() emit the given string to the script output.

    In offline mode, there is no ephemeral DB connection. This is useful
    for generating migration scripts without connecting to the database.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run migrations with the given connection."""
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    from sqlalchemy.ext.asyncio import create_async_engine

    connectable = create_async_engine(
        settings.PLANNING_DATABASE_URL,
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode with async engine."""
    import asyncio
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()