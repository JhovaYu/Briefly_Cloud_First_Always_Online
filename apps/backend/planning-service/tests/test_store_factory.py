"""
Tests for the store factory (PLANNING_STORE_TYPE routing in dependencies).

These tests verify that get_task_repo() and get_task_list_repo() return
the correct repository type based on PLANNING_STORE_TYPE.
"""

from __future__ import annotations

import pytest
from unittest.mock import patch, MagicMock

from app.adapters.persistence.in_memory_task_repository import InMemoryTaskRepository
from app.adapters.persistence.in_memory_task_list_repository import InMemoryTaskListRepository
from app.adapters.persistence.postgres_task_repository import PostgresTaskRepository
from app.adapters.persistence.postgres_task_list_repository import PostgresTaskListRepository
from app.api import dependencies


class TestStoreFactoryInMemory:
    """Test that PLANNING_STORE_TYPE=inmemory returns in-memory repos."""

    def test_get_task_repo_returns_in_memory_repo(self):
        # Reset global state
        dependencies._task_repo = None
        dependencies._store_type = None

        with patch.object(dependencies, "get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                PLANNING_STORE_TYPE="inmemory",
                PLANNING_DATABASE_URL=None,
            )
            repo = dependencies.get_task_repo()

        assert isinstance(repo, InMemoryTaskRepository)

    def test_get_task_list_repo_returns_in_memory_repo(self):
        dependencies._task_list_repo = None
        dependencies._store_type = None

        with patch.object(dependencies, "get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                PLANNING_STORE_TYPE="inmemory",
                PLANNING_DATABASE_URL=None,
            )
            repo = dependencies.get_task_list_repo()

        assert isinstance(repo, InMemoryTaskListRepository)

    def test_invalid_store_type_raises_value_error(self):
        dependencies._task_repo = None
        dependencies._store_type = None

        with patch.object(dependencies, "get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                PLANNING_STORE_TYPE="invalid",
                PLANNING_DATABASE_URL=None,
            )
            with pytest.raises(ValueError, match="Invalid PLANNING_STORE_TYPE"):
                dependencies.get_task_repo()


class TestStoreFactoryPostgres:
    """Test that PLANNING_STORE_TYPE=postgres returns postgres repos."""

    def test_get_task_repo_returns_postgres_repo(self):
        dependencies._task_repo = None
        dependencies._store_type = None

        mock_session = MagicMock()
        mock_factory = MagicMock(return_value=mock_session)

        with patch.object(dependencies, "get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                PLANNING_STORE_TYPE="postgres",
                PLANNING_DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/db",
            )
            with patch(
                "app.adapters.persistence.sqlalchemy.database.get_session_factory",
                mock_factory,
            ):
                repo = dependencies.get_task_repo()

        assert isinstance(repo, PostgresTaskRepository)
        mock_factory.assert_called_once()

    def test_get_task_list_repo_returns_postgres_repo(self):
        dependencies._task_list_repo = None
        dependencies._store_type = None

        mock_session = MagicMock()
        mock_factory = MagicMock(return_value=mock_session)

        with patch.object(dependencies, "get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                PLANNING_STORE_TYPE="postgres",
                PLANNING_DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/db",
            )
            with patch(
                "app.adapters.persistence.sqlalchemy.database.get_session_factory",
                mock_factory,
            ):
                repo = dependencies.get_task_list_repo()

        assert isinstance(repo, PostgresTaskListRepository)
        mock_factory.assert_called_once()
