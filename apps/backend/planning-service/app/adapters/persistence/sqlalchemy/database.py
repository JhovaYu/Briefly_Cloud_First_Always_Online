"""
SQLAlchemy async engine and session factory helpers.

The async engine is created only when PLANNING_STORE_TYPE=postgres.
When PLANNING_STORE_TYPE=inmemory, this module is not used.
"""

from __future__ import annotations

import logging
from typing import AsyncGenerator

from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.config.settings import Settings

logger = logging.getLogger(__name__)

_engine = None
_async_session_factory = None


def get_database_url(settings: Settings) -> str:
    """Build database URL from settings. Never print the URL."""
    if settings.PLANNING_DATABASE_URL:
        return settings.PLANNING_DATABASE_URL
    raise ValueError(
        "PLANNING_DATABASE_URL is required when PLANNING_STORE_TYPE=postgres. "
        "Database URL not configured."
    )


def create_async_engine_if_not_exists(settings: Settings):
    """
    Create and cache the async engine for postgres store.
    Does NOT connect — just creates the engine instance.
    Connection happens lazily on first query.
    """
    global _engine, _async_session_factory
    if _engine is not None:
        return _engine

    db_url = get_database_url(settings)
    # NullPool for async + frequent startup/shutdown; avoid connection lingering
    _engine = create_async_engine(
        db_url,
        poolclass=NullPool,
        echo=False,
    )
    _async_session_factory = async_sessionmaker(
        bind=_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    logger.info("Async engine created for postgres store (lazy connection)")
    return _engine


def get_session_factory():
    """Return the cached async session factory. Raises if not initialized."""
    if _async_session_factory is None:
        raise RuntimeError(
            "Async session factory not initialized. "
            "Call create_async_engine_if_not_exists() first with postgres store type."
        )
    return _async_session_factory


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI-compatible async session dependency (requires factory initialized)."""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def dispose_engine():
    """Dispose the engine and close all connections. Call on shutdown."""
    global _engine, _async_session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _async_session_factory = None
        logger.info("Async engine disposed")