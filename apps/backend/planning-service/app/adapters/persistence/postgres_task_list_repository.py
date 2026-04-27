"""
Postgres implementation of TaskListRepository.

Implements client-generated ID idempotency:
- same id + same workspace + compatible payload -> idempotent retry, return existing
- same id + same workspace + conflicting payload -> 409 DuplicateResourceError
- same id + different workspace -> generic conflict (no data leaked)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.persistence.sqlalchemy.models import TaskListModel
from app.domain.task_list import TaskList
from app.ports.task_list_repository import TaskListRepository
from app.domain.errors import DuplicateResourceError


def _model_to_domain(model: TaskListModel) -> TaskList:
    return TaskList(
        id=str(model.id),
        workspace_id=str(model.workspace_id),
        name=model.name,
        color=model.color,
        created_at=model.created_at,
        updated_at=model.updated_at,
        created_by=model.created_by,
    )


class PostgresTaskListRepository(TaskListRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, task_list: TaskList) -> TaskList:
        list_uuid = uuid.UUID(task_list.id)
        workspace_uuid = uuid.UUID(task_list.workspace_id)

        # Pre-check: see if this id already exists in this workspace
        result = await self._session.execute(
            select(TaskListModel).where(TaskListModel.id == list_uuid)
        )
        existing: TaskListModel | None = result.scalar_one_or_none()

        if existing is not None:
            # Record with this id exists — check workspace
            if existing.workspace_id != workspace_uuid:
                raise DuplicateResourceError(
                    f"Task list with id {task_list.id} already exists in a different workspace"
                )
            # Same workspace: check payload compatibility
            if existing.name != task_list.name or existing.color != task_list.color:
                raise DuplicateResourceError(
                    f"Task list with id {task_list.id} already exists with incompatible payload"
                )
            # Idempotent retry — return existing resource
            return _model_to_domain(existing)

        # No existing record — insert new
        model = TaskListModel(
            id=list_uuid,
            workspace_id=workspace_uuid,
            name=task_list.name,
            color=task_list.color,
            created_at=task_list.created_at,
            updated_at=task_list.updated_at,
            created_by=task_list.created_by,
        )
        self._session.add(model)
        await self._session.flush()
        return task_list

    async def find_by_id(self, list_id: str) -> TaskList | None:
        try:
            list_uuid = uuid.UUID(list_id)
        except ValueError:
            return None

        result = await self._session.execute(
            select(TaskListModel).where(TaskListModel.id == list_uuid)
        )
        model: TaskListModel | None = result.scalar_one_or_none()
        if model is None:
            return None
        return _model_to_domain(model)

    async def find_by_workspace(self, workspace_id: str) -> list[TaskList]:
        try:
            workspace_uuid = uuid.UUID(workspace_id)
        except ValueError:
            return []

        result = await self._session.execute(
            select(TaskListModel)
            .where(TaskListModel.workspace_id == workspace_uuid)
            .order_by(TaskListModel.created_at)
        )
        models = result.scalars().all()
        return [_model_to_domain(m) for m in models]
