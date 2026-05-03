"""
Alembic async environment for schedule-service.

SCHEDULE_DATABASE_URL must be set to a valid asyncpg connection string.
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
from app.adapters.persistence.sqlalchemy.models import ScheduleBlockModel

config = context.config

logging.basicConfig()
logger = logging.getLogger("alembic")

settings = Settings()
if settings.SCHEDULE_DATABASE_URL:
    config.set_main_option("sqlalchemy.url", settings.SCHEDULE_DATABASE_URL)
else:
    raise RuntimeError(
        "SCHEDULE_DATABASE_URL environment variable is required to run migrations. "
        "Set SCHEDULE_DATABASE_URL to your asyncpg connection string."
    )

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
        settings.SCHEDULE_DATABASE_URL,
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