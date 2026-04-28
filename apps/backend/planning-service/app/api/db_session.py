"""
DBSession scoped value container.
Instantiated once per request by FastAPI Depends.
Implements __aenter__/__aexit__ so FastAPI manages lifecycle automatically.
Yields self — caller reads .session, .task_repo, .task_list_repo.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.ports.task_repository import TaskRepository
from app.ports.task_list_repository import TaskListRepository
from app.adapters.persistence.postgres_task_repository import PostgresTaskRepository
from app.adapters.persistence.postgres_task_list_repository import PostgresTaskListRepository
from app.adapters.persistence.in_memory_task_repository import InMemoryTaskRepository
from app.adapters.persistence.in_memory_task_list_repository import InMemoryTaskListRepository
from app.adapters.persistence.sqlalchemy.database import get_session_factory


@dataclass
class DBSession:
    """Holds session + repos for a single request. Implements async context manager."""
    session: AsyncSession | None
    task_repo: TaskRepository
    task_list_repo: TaskListRepository

    async def __aenter__(self) -> "DBSession":
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session is not None:
            if exc_type is not None:
                await self.session.rollback()
            else:
                await self.session.commit()
            await self.session.close()
        return None


async def get_db() -> AsyncIterator[DBSession]:
    """
    FastAPI dependency — session-per-request with shared repos.

    Uses async with around DBSession so that FastAPI's async generator teardown
    (aclose() after route handler completes) triggers DBSession.__aexit__.
    That in turn calls session.commit() on success or session.rollback() on exception,
    then session.close().

    For PLANNING_STORE_TYPE=postgres:
      - Opens AsyncSession from factory
      - Creates PostgresTaskRepository + PostgresTaskListRepository sharing the session
      - Commits on success, rollback on exception, close always

    For PLANNING_STORE_TYPE=inmemory:
      - Uses singleton inmemory repos (no session needed)
      - Session is None; __aexit__ is a no-op for session part
      - No commit/rollback needed
    """
    from app.api.dependencies import get_store_type
    store_type = get_store_type()

    if store_type == "postgres":
        factory = get_session_factory()
        session = factory()
        try:
            task_repo = PostgresTaskRepository(session)
            task_list_repo = PostgresTaskListRepository(session)
            db = DBSession(session=session, task_repo=task_repo, task_list_repo=task_list_repo)
            async with db:
                yield db
        except Exception:
            await session.close()
            raise

    elif store_type == "inmemory":
        import app.api.dependencies as deps
        if deps._task_repo is None:
            deps._task_repo = InMemoryTaskRepository()
        if deps._task_list_repo is None:
            deps._task_list_repo = InMemoryTaskListRepository()
        db = DBSession(session=None, task_repo=deps._task_repo, task_list_repo=deps._task_list_repo)
        async with db:
            yield db

    else:
        raise ValueError(
            f"Invalid PLANNING_STORE_TYPE: {store_type!r}. "
            "Must be 'inmemory' or 'postgres'."
        )
