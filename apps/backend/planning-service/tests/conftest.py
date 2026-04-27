"""
Pytest fixtures for Postgres repository tests.
Requires planning-postgres running via docker-compose.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# Use the docker-compose planning-postgres service (local only for safety)
_TEST_DB_URL = os.environ.get(
    "PLANNING_TEST_DATABASE_URL",
    "postgresql+asyncpg://briefly:briefly_dev_password@localhost:5433/briefly_planning"
)

# Safety guard: only allow TRUNCATE against explicitly local database
# Reject any misconfiguration that would target a remote/non-local DB
try:
    from sqlalchemy.engine import make_url
    parsed = make_url(_TEST_DB_URL)
    allowed_hosts = {"localhost", "127.0.0.1", "::1"}
    allowed_port = 5433
    allowed_db = "briefly_planning"
    if parsed.host not in allowed_hosts:
        raise RuntimeError(
            f"TEST_DATABASE_URL must target localhost. "
            f"Got host '{parsed.host}' — refusing to run TRUNCATE on non-local DB."
        )
    if parsed.port != allowed_port:
        raise RuntimeError(
            f"TEST_DATABASE_URL must use port {allowed_port}. "
            f"Got port '{parsed.port}' — refusing to run TRUNCATE on non-local DB."
        )
    if parsed.database != allowed_db:
        raise RuntimeError(
            f"TEST_DATABASE_URL must target '{allowed_db}'. "
            f"Got database '{parsed.database}' — refusing to run TRUNCATE on non-local DB."
        )
except ImportError:
    # Fallback: basic check via urllib.parse (sqlalchemy not available at import time)
    import re
    m = re.match(r"postgresql\+asyncpg://[^:]+:[^@]+@([^:]+):(\d+)/(\w+)", _TEST_DB_URL)
    if not m or m.group(1) not in ("localhost", "127.0.0.1", "::1"):
        raise RuntimeError(
            f"TEST_DATABASE_URL must target localhost. "
            f"Host redacted — refusing to run TRUNCATE on non-local DB."
        )
    if m.group(2) != "5433":
        raise RuntimeError(
            f"TEST_DATABASE_URL must use port 5433. "
            f"Got port redacted — refusing to run TRUNCATE on non-local DB."
        )
    if m.group(3) != "briefly_planning":
        raise RuntimeError(
            f"TEST_DATABASE_URL must target 'briefly_planning'. "
            f"Got db redacted — refusing to run TRUNCATE on non-local DB."
        )

TEST_DATABASE_URL = _TEST_DB_URL


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def session_maker():
    """Provide an async sessionmaker (session factory) for session-per-operation tests."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    try:
        async_session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        # Clean tables before each test
        async with async_session_factory() as session:
            await session.execute(
                text("TRUNCATE TABLE tasks, task_lists RESTART IDENTITY CASCADE")
            )
            await session.commit()
        yield async_session_factory
    finally:
        await engine.dispose()


@pytest.fixture
def _uuid():
    return lambda: str(uuid.uuid4())


@pytest.fixture
def _now():
    return lambda: datetime.now(timezone.utc)
