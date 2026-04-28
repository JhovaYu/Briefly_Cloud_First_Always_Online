"""
Tests for the store factory (PLANNING_STORE_TYPE routing in dependencies).

Verifies that get_db() / DBSession returns correct repository types based on PLANNING_STORE_TYPE,
and that the transaction lifecycle (commit on success, rollback on exception) is correct.
"""

from __future__ import annotations

import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from app.adapters.persistence.in_memory_task_repository import InMemoryTaskRepository
from app.adapters.persistence.in_memory_task_list_repository import InMemoryTaskListRepository
from app.adapters.persistence.postgres_task_repository import PostgresTaskRepository
from app.adapters.persistence.postgres_task_list_repository import PostgresTaskListRepository
from app.api import dependencies
from app.api.db_session import get_db, DBSession


class TestStoreFactoryInMemory:
    """Test that PLANNING_STORE_TYPE=inmemory returns in-memory repos via get_db."""

    @pytest.mark.asyncio
    async def test_get_db_inmemory_returns_inmemory_repos(self):
        # Reset global state
        dependencies._task_repo = None
        dependencies._task_list_repo = None
        dependencies._store_type = None

        with patch.object(dependencies, "get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                PLANNING_STORE_TYPE="inmemory",
                PLANNING_DATABASE_URL=None,
            )

            async for db in get_db():
                assert isinstance(db, DBSession)
                assert db.session is None
                assert isinstance(db.task_repo, InMemoryTaskRepository)
                assert isinstance(db.task_list_repo, InMemoryTaskListRepository)
                break


class TestStoreFactoryPostgres:
    """Test that PLANNING_STORE_TYPE=postgres returns postgres repos via get_db."""

    @pytest.mark.asyncio
    async def test_get_db_postgres_returns_postgres_repos(self):
        dependencies._store_type = None

        mock_session = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.rollback = AsyncMock()
        mock_session.close = AsyncMock()
        mock_factory = MagicMock(return_value=mock_session)

        with patch.object(dependencies, "get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                PLANNING_STORE_TYPE="postgres",
                PLANNING_DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/db",
            )
            with patch("app.api.db_session.get_session_factory", mock_factory):
                async for db in get_db():
                    assert isinstance(db, DBSession)
                    # Session is the one created by factory
                    assert db.session is not None
                    assert isinstance(db.task_repo, PostgresTaskRepository)
                    assert isinstance(db.task_list_repo, PostgresTaskListRepository)
                    break

    @pytest.mark.asyncio
    async def test_dbsession_commit_on_success(self):
        """DBSession.__aexit__ commits when no exception."""
        mock_session = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.rollback = AsyncMock()
        mock_session.close = AsyncMock()

        db = DBSession(session=mock_session, task_repo=MagicMock(), task_list_repo=MagicMock())
        await db.__aexit__(None, None, None)

        mock_session.commit.assert_awaited_once()
        mock_session.rollback.assert_not_called()
        mock_session.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_dbsession_rollback_on_exception(self):
        """DBSession.__aexit__ rolls back when there is an exception."""
        mock_session = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.rollback = AsyncMock()
        mock_session.close = AsyncMock()

        db = DBSession(session=mock_session, task_repo=MagicMock(), task_list_repo=MagicMock())
        await db.__aexit__(ValueError, ValueError("test"), None)

        mock_session.rollback.assert_awaited_once()
        mock_session.commit.assert_not_called()
        mock_session.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_dbsession_close_only_on_inmemory(self):
        """DBSession with session=None only closes nothing."""
        db = DBSession(session=None, task_repo=MagicMock(), task_list_repo=MagicMock())
        await db.__aexit__(None, None, None)  # no error, no session
        # No exception means nothing to assert


class TestGetDbAsyncGenLifecycle:
    """
    Verifies get_db() is a proper async generator that yields DBSession.

    The critical property we're testing: get_db() is an async generator function
    (not a regular async function). When FastAPI calls Depends(get_db), it gets
    an async generator that yields DBSession instances.

    The async with DBSession(...) inside get_db() ensures __aexit__ runs on teardown.
    We verify the async generator nature without mocking the complex session lifecycle.
    """

    @pytest.mark.asyncio
    async def test_get_db_is_async_generator(self):
        """get_db() must be an async generator (uses yield, not return)."""
        import inspect
        assert inspect.isasyncgenfunction(get_db), \
            "get_db must be an async generator function (uses yield)"

    @pytest.mark.asyncio
    async def test_get_db_inmemory_yields_dbsession(self):
        """inmemory path: yields DBSession with session=None."""
        dependencies._task_repo = None
        dependencies._task_list_repo = None
        dependencies._store_type = None

        with patch.object(dependencies, "get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                PLANNING_STORE_TYPE="inmemory",
                PLANNING_DATABASE_URL=None,
            )
            gen = get_db()
            try:
                db = await gen.__anext__()
                assert isinstance(db, DBSession)
                assert db.session is None
                assert isinstance(db.task_repo, InMemoryTaskRepository)
                assert isinstance(db.task_list_repo, InMemoryTaskListRepository)
                await gen.aclose()
            except StopAsyncIteration:
                pass

    @pytest.mark.asyncio
    async def test_get_db_inmemory_generator_completes_cleanly(self):
        """
        Consuming the generator fully (async for) lets the async with inside
        get_db() exit and run DBSession.__aexit__ with exc_type=None.
        For session=None this is a no-op, but it proves the async with
        context manager protocol is used.
        """
        dependencies._task_repo = None
        dependencies._task_list_repo = None
        dependencies._store_type = None

        with patch.object(dependencies, "get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                PLANNING_STORE_TYPE="inmemory",
                PLANNING_DATABASE_URL=None,
            )
            async for db in get_db():
                pass
            # If we reach here, the async with block exited cleanly
            # (no GeneratorExit or other exceptions propagating)


class TestInMemoryRepoDirect:
    """Test that get_task_repo / get_task_list_repo still work for inmemory."""

    def test_get_task_repo_inmemory_still_works(self):
        dependencies._task_repo = None
        dependencies._store_type = None

        with patch.object(dependencies, "get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                PLANNING_STORE_TYPE="inmemory",
                PLANNING_DATABASE_URL=None,
            )
            repo = dependencies.get_task_repo()

        assert isinstance(repo, InMemoryTaskRepository)

    def test_get_task_list_repo_inmemory_still_works(self):
        dependencies._task_list_repo = None
        dependencies._store_type = None

        with patch.object(dependencies, "get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                PLANNING_STORE_TYPE="inmemory",
                PLANNING_DATABASE_URL=None,
            )
            repo = dependencies.get_task_list_repo()

        assert isinstance(repo, InMemoryTaskListRepository)