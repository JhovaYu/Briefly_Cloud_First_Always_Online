"""
Tests for PostgresTaskRepository.

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

from app.adapters.persistence.postgres_task_repository import PostgresTaskRepository
from app.adapters.persistence.postgres_task_list_repository import PostgresTaskListRepository
from app.domain.task import Task
from app.domain.task_list import TaskList
from app.domain.task_state import TaskState, Priority
from app.domain.errors import DuplicateResourceError


class TestPostgresTaskRepositorySave:
    @pytest.mark.asyncio
    async def test_save_inserts_new_task(self, session_maker, _uuid, _now):
        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            task = Task(
                id=_uuid(),
                workspace_id=_uuid(),
                list_id=None,
                text="Test task",
                state=TaskState.PENDING,
                priority=Priority.HIGH,
                assignee_id=None,
                due_date=None,
                description=None,
                tags=["bug"],
                created_at=_now(),
                updated_at=_now(),
                completed_at=None,
                created_by="user-1",
            )
            result = await repo.save(task)
            await session.commit()
            assert result.id == task.id
            assert result.text == "Test task"
            assert result.priority == Priority.HIGH

    @pytest.mark.asyncio
    async def test_save_idempotent_same_payload(self, session_maker, _uuid, _now):
        task_id = _uuid()
        workspace_id = _uuid()
        now = _now()

        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            task1 = Task(
                id=task_id,
                workspace_id=workspace_id,
                list_id=None,
                text="Idempotent task",
                state=TaskState.PENDING,
                priority=Priority.MEDIUM,
                assignee_id=None,
                due_date=None,
                description=None,
                tags=None,
                created_at=now,
                updated_at=now,
                completed_at=None,
                created_by="user-1",
            )
            result1 = await repo.save(task1)
            await session.commit()
            assert result1.id == task_id

        # Idempotent retry: new session, same payload
        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            task2 = Task(
                id=task_id,
                workspace_id=workspace_id,
                list_id=None,
                text="Idempotent task",
                state=TaskState.PENDING,
                priority=Priority.MEDIUM,
                assignee_id=None,
                due_date=None,
                description=None,
                tags=None,
                created_at=now,
                updated_at=now,
                completed_at=None,
                created_by="user-1",
            )
            result2 = await repo.save(task2)
            await session.commit()
            assert result2.id == task_id

    @pytest.mark.asyncio
    async def test_save_duplicate_conflicting_payload(self, session_maker, _uuid, _now):
        task_id = _uuid()
        workspace_id = _uuid()
        now = _now()

        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            task1 = Task(
                id=task_id,
                workspace_id=workspace_id,
                list_id=None,
                text="Original task",
                state=TaskState.PENDING,
                priority=Priority.LOW,
                assignee_id=None,
                due_date=None,
                description=None,
                tags=None,
                created_at=now,
                updated_at=now,
                completed_at=None,
                created_by="user-1",
            )
            await repo.save(task1)
            await session.commit()

        # Conflicting payload: new session, same id, different text
        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            task2 = Task(
                id=task_id,
                workspace_id=workspace_id,
                list_id=None,
                text="Conflicting task",
                state=TaskState.WORKING,
                priority=Priority.HIGH,
                assignee_id=None,
                due_date=None,
                description=None,
                tags=None,
                created_at=now,
                updated_at=now,
                completed_at=None,
                created_by="user-2",
            )
            with pytest.raises(DuplicateResourceError):
                await repo.save(task2)

    @pytest.mark.asyncio
    async def test_save_duplicate_different_workspace(self, session_maker, _uuid, _now):
        task_id = _uuid()
        workspace_id_1 = _uuid()
        workspace_id_2 = _uuid()
        now = _now()

        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            task1 = Task(
                id=task_id,
                workspace_id=workspace_id_1,
                list_id=None,
                text="Task in WS1",
                state=TaskState.PENDING,
                priority=Priority.MEDIUM,
                assignee_id=None,
                due_date=None,
                description=None,
                tags=None,
                created_at=now,
                updated_at=now,
                completed_at=None,
                created_by="user-1",
            )
            await repo.save(task1)
            await session.commit()

        # Cross-workspace: new session, same id, different workspace
        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            task2 = Task(
                id=task_id,
                workspace_id=workspace_id_2,
                list_id=None,
                text="Task in WS2",
                state=TaskState.PENDING,
                priority=Priority.MEDIUM,
                assignee_id=None,
                due_date=None,
                description=None,
                tags=None,
                created_at=now,
                updated_at=now,
                completed_at=None,
                created_by="user-2",
            )
            with pytest.raises(DuplicateResourceError):
                await repo.save(task2)


class TestPostgresTaskRepositoryFind:
    @pytest.mark.asyncio
    async def test_find_by_id_returns_task(self, session_maker, _uuid, _now):
        task_id = _uuid()
        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            task = Task(
                id=task_id,
                workspace_id=_uuid(),
                list_id=None,
                text="Find me",
                state=TaskState.PENDING,
                priority=Priority.HIGH,
                assignee_id=None,
                due_date=None,
                description=None,
                tags=None,
                created_at=_now(),
                updated_at=_now(),
                completed_at=None,
                created_by="user-1",
            )
            await repo.save(task)
            await session.commit()

            found = await repo.find_by_id(task_id)
            assert found is not None
            assert found.id == task_id
            assert found.text == "Find me"

    @pytest.mark.asyncio
    async def test_find_by_id_returns_none_for_missing(self, session_maker, _uuid):
        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            found = await repo.find_by_id(_uuid())
            assert found is None

    @pytest.mark.asyncio
    async def test_find_by_id_invalid_uuid_returns_none(self, session_maker):
        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            found = await repo.find_by_id("not-a-uuid")
            assert found is None


class TestPostgresTaskRepositoryWorkspaceIsolation:
    @pytest.mark.asyncio
    async def test_find_by_workspace_returns_only_that_workspace_tasks(
        self, session_maker, _uuid, _now
    ):
        ws1 = _uuid()
        ws2 = _uuid()

        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            await repo.save(Task(id=_uuid(), workspace_id=ws1, list_id=None, text="WS1 Task 1", state=TaskState.PENDING, priority=Priority.LOW, assignee_id=None, due_date=None, description=None, tags=None, created_at=_now(), updated_at=_now(), completed_at=None, created_by="user-1"))
            await session.commit()

        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            await repo.save(Task(id=_uuid(), workspace_id=ws2, list_id=None, text="WS2 Task 1", state=TaskState.PENDING, priority=Priority.LOW, assignee_id=None, due_date=None, description=None, tags=None, created_at=_now(), updated_at=_now(), completed_at=None, created_by="user-1"))
            await session.commit()

        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            await repo.save(Task(id=_uuid(), workspace_id=ws1, list_id=None, text="WS1 Task 2", state=TaskState.PENDING, priority=Priority.LOW, assignee_id=None, due_date=None, description=None, tags=None, created_at=_now(), updated_at=_now(), completed_at=None, created_by="user-1"))
            await session.commit()

        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            ws1_tasks = await repo.find_by_workspace(ws1)
            assert len(ws1_tasks) == 2
            assert all(t.workspace_id == ws1 for t in ws1_tasks)

            ws2_tasks = await repo.find_by_workspace(ws2)
            assert len(ws2_tasks) == 1
            assert ws2_tasks[0].text == "WS2 Task 1"

    @pytest.mark.asyncio
    async def test_find_by_workspace_empty_for_unknown_workspace(self, session_maker, _uuid):
        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            tasks = await repo.find_by_workspace(_uuid())
            assert tasks == []


class TestPostgresTaskRepositoryDelete:
    @pytest.mark.asyncio
    async def test_delete_existing_task_returns_true(self, session_maker, _uuid, _now):
        task_id = _uuid()
        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            task = Task(
                id=task_id,
                workspace_id=_uuid(),
                list_id=None,
                text="To delete",
                state=TaskState.PENDING,
                priority=Priority.LOW,
                assignee_id=None,
                due_date=None,
                description=None,
                tags=None,
                created_at=_now(),
                updated_at=_now(),
                completed_at=None,
                created_by="user-1",
            )
            await repo.save(task)
            await session.commit()

            result = await repo.delete(task_id)
            assert result is True

            found = await repo.find_by_id(task_id)
            assert found is None

    @pytest.mark.asyncio
    async def test_delete_missing_task_returns_false(self, session_maker, _uuid):
        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            result = await repo.delete(_uuid())
            assert result is False

    @pytest.mark.asyncio
    async def test_delete_invalid_uuid_returns_false(self, session_maker):
        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            result = await repo.delete("not-a-uuid")
            assert result is False


class TestPostgresTaskRepositoryTagsAndListId:
    @pytest.mark.asyncio
    async def test_save_with_tags(self, session_maker, _uuid, _now):
        async with session_maker() as session:
            repo = PostgresTaskRepository(session)
            task = Task(
                id=_uuid(),
                workspace_id=_uuid(),
                list_id=None,
                text="Task with tags",
                state=TaskState.PENDING,
                priority=Priority.MEDIUM,
                assignee_id=None,
                due_date=None,
                description=None,
                tags=["urgent", "backend"],
                created_at=_now(),
                updated_at=_now(),
                completed_at=None,
                created_by="user-1",
            )
            result = await repo.save(task)
            await session.commit()
            assert result.tags == ["urgent", "backend"]

            found = await repo.find_by_id(task.id)
            assert found is not None
            assert found.tags == ["urgent", "backend"]

    @pytest.mark.asyncio
    async def test_save_with_list_id_same_workspace(self, session_maker, _uuid, _now):
        list_id = _uuid()
        workspace_id = _uuid()
        now = _now()

        async with session_maker() as session:
            list_repo = PostgresTaskListRepository(session)
            task_repo = PostgresTaskRepository(session)

            # Create a task list first
            tl = TaskList(
                id=list_id,
                workspace_id=workspace_id,
                name="My List",
                color=None,
                created_at=now,
                updated_at=now,
                created_by="user-1",
            )
            await list_repo.save(tl)
            await session.commit()

            # Create task with that list_id
            task = Task(
                id=_uuid(),
                workspace_id=workspace_id,
                list_id=list_id,
                text="Task in list",
                state=TaskState.PENDING,
                priority=Priority.MEDIUM,
                assignee_id=None,
                due_date=None,
                description=None,
                tags=None,
                created_at=now,
                updated_at=now,
                completed_at=None,
                created_by="user-1",
            )
            await task_repo.save(task)
            await session.commit()

            found = await task_repo.find_by_id(task.id)
            assert found is not None
            assert found.list_id == list_id


# Fixture helpers
@pytest.fixture
def _uuid():
    return lambda: str(uuid.uuid4())


@pytest.fixture
def _now():
    return lambda: datetime.now(timezone.utc)
