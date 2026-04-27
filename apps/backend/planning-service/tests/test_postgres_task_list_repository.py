"""
Tests for PostgresTaskListRepository.

Requires planning-postgres running (docker-compose up -d planning-postgres)
and migrations applied (alembic upgrade head).

Each test uses a fresh session factory (session_maker). Each repository
operation gets its own session from the factory, matching production behavior.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio

from app.adapters.persistence.postgres_task_list_repository import PostgresTaskListRepository
from app.adapters.persistence.sqlalchemy.models import TaskListModel
from app.domain.task_list import TaskList
from app.domain.errors import DuplicateResourceError


class TestPostgresTaskListRepositorySave:
    @pytest.mark.asyncio
    async def test_save_inserts_new_task_list(self, session_maker, _uuid, _now):
        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            tl = TaskList(
                id=_uuid(),
                workspace_id=_uuid(),
                name="Test List",
                color="blue",
                created_at=_now(),
                updated_at=_now(),
                created_by="user-1",
            )
            result = await repo.save(tl)
            await session.commit()
            assert result.id == tl.id
            assert result.name == "Test List"
            assert result.color == "blue"

    @pytest.mark.asyncio
    async def test_save_idempotent_same_payload(self, session_maker, _uuid, _now):
        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            list_id = _uuid()
            workspace_id = _uuid()
            now = _now()
            tl1 = TaskList(
                id=list_id,
                workspace_id=workspace_id,
                name="Idempotent List",
                color=None,
                created_at=now,
                updated_at=now,
                created_by="user-1",
            )
            result1 = await repo.save(tl1)
            await session.commit()
            assert result1.id == list_id

        # Idempotent retry: new session, same payload
        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            tl2 = TaskList(
                id=list_id,
                workspace_id=workspace_id,
                name="Idempotent List",
                color=None,
                created_at=now,
                updated_at=now,
                created_by="user-1",
            )
            result2 = await repo.save(tl2)
            await session.commit()
            assert result2.id == list_id
            assert result2.name == "Idempotent List"

    @pytest.mark.asyncio
    async def test_save_duplicate_conflicting_payload(self, session_maker, _uuid, _now):
        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            list_id = _uuid()
            workspace_id = _uuid()
            now = _now()

            tl1 = TaskList(
                id=list_id,
                workspace_id=workspace_id,
                name="Original Name",
                color="red",
                created_at=now,
                updated_at=now,
                created_by="user-1",
            )
            await repo.save(tl1)
            await session.commit()

        # Conflicting payload: new session, same id, different name
        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            tl2 = TaskList(
                id=list_id,
                workspace_id=workspace_id,
                name="Conflicting Name",
                color="blue",
                created_at=now,
                updated_at=now,
                created_by="user-2",
            )
            with pytest.raises(DuplicateResourceError):
                await repo.save(tl2)

    @pytest.mark.asyncio
    async def test_save_duplicate_different_workspace(self, session_maker, _uuid, _now):
        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            list_id = _uuid()
            workspace_id_1 = _uuid()
            workspace_id_2 = _uuid()
            now = _now()

            tl1 = TaskList(
                id=list_id,
                workspace_id=workspace_id_1,
                name="List in WS1",
                color=None,
                created_at=now,
                updated_at=now,
                created_by="user-1",
            )
            await repo.save(tl1)
            await session.commit()

        # Cross-workspace: new session, same id, different workspace
        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            tl2 = TaskList(
                id=list_id,
                workspace_id=workspace_id_2,
                name="List in WS2",
                color=None,
                created_at=now,
                updated_at=now,
                created_by="user-2",
            )
            with pytest.raises(DuplicateResourceError):
                await repo.save(tl2)


class TestPostgresTaskListRepositoryFind:
    @pytest.mark.asyncio
    async def test_find_by_id_returns_task_list(self, session_maker, _uuid, _now):
        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            list_id = _uuid()
            workspace_id = _uuid()
            now = _now()
            tl = TaskList(
                id=list_id,
                workspace_id=workspace_id,
                name="Find Me",
                color="green",
                created_at=now,
                updated_at=now,
                created_by="user-1",
            )
            await repo.save(tl)
            await session.commit()

            found = await repo.find_by_id(list_id)
            assert found is not None
            assert found.id == list_id
            assert found.name == "Find Me"

    @pytest.mark.asyncio
    async def test_find_by_id_returns_none_for_missing(self, session_maker, _uuid):
        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            found = await repo.find_by_id(_uuid())
            assert found is None

    @pytest.mark.asyncio
    async def test_find_by_id_invalid_uuid_returns_none(self, session_maker):
        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            found = await repo.find_by_id("not-a-uuid")
            assert found is None


class TestPostgresTaskListRepositoryWorkspaceIsolation:
    @pytest.mark.asyncio
    async def test_find_by_workspace_returns_only_that_workspace_lists(
        self, session_maker, _uuid, _now
    ):
        ws1 = _uuid()
        ws2 = _uuid()

        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            await repo.save(TaskList(id=_uuid(), workspace_id=ws1, name="WS1 List 1", color=None, created_at=_now(), updated_at=_now(), created_by="user-1"))
            await session.commit()

        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            await repo.save(TaskList(id=_uuid(), workspace_id=ws2, name="WS2 List 1", color=None, created_at=_now(), updated_at=_now(), created_by="user-1"))
            await session.commit()

        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            await repo.save(TaskList(id=_uuid(), workspace_id=ws1, name="WS1 List 2", color=None, created_at=_now(), updated_at=_now(), created_by="user-1"))
            await session.commit()

        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            ws1_lists = await repo.find_by_workspace(ws1)
            assert len(ws1_lists) == 2
            assert all(tl.workspace_id == ws1 for tl in ws1_lists)

            ws2_lists = await repo.find_by_workspace(ws2)
            assert len(ws2_lists) == 1
            assert ws2_lists[0].name == "WS2 List 1"

    @pytest.mark.asyncio
    async def test_find_by_workspace_empty_for_unknown_workspace(self, session_maker, _uuid):
        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            lists = await repo.find_by_workspace(_uuid())
            assert lists == []

    @pytest.mark.asyncio
    async def test_find_by_workspace_invalid_uuid_returns_empty(self, session_maker):
        async with session_maker() as session:
            repo = PostgresTaskListRepository(session)
            lists = await repo.find_by_workspace("not-a-uuid")
            assert lists == []
