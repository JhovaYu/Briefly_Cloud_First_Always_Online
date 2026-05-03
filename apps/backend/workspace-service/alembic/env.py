"""
Alembic async environment for workspace-service.

WORKSPACE_DATABASE_URL must be set to a valid asyncpg connection string.
"""

from __future__ import annotations

import logging
from typing import Any

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine, async_engine_from_config

from app.adapters.persistence.sqlalchemy_workspace_shared_text import Base

config = context.config

logging.basicConfig()
logger = logging.getLogger("alembic")

import os
database_url = os.getenv("WORKSPACE_DATABASE_URL", "")
if not database_url:
    raise RuntimeError(
        "WORKSPACE_DATABASE_URL environment variable is required to run migrations. "
        "Set WORKSPACE_DATABASE_URL to your asyncpg connection string."
    )

config.set_main_option("sqlalchemy.url", database_url)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
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
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = create_async_engine(
        database_url,
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    import asyncio
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()