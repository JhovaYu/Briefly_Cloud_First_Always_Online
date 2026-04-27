"""
Postgres implementation of TaskRepository.

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

from app.adapters.persistence.sqlalchemy.models import TaskModel
from app.domain.task import Task
from app.domain.task_state import TaskState, Priority
from app.ports.task_repository import TaskRepository
from app.domain.errors import DuplicateResourceError


def _model_to_domain(model: TaskModel) -> Task:
    return Task(
        id=str(model.id),
        workspace_id=str(model.workspace_id),
        list_id=str(model.list_id) if model.list_id is not None else None,
        text=model.text,
        state=TaskState(model.state),
        priority=Priority(model.priority),
        assignee_id=str(model.assignee_id) if model.assignee_id is not None else None,
        due_date=model.due_date,
        description=model.description,
        tags=model.tags,
        created_at=model.created_at,
        updated_at=model.updated_at,
        completed_at=model.completed_at,
        created_by=model.created_by,
    )


def _domain_to_model(task: Task) -> TaskModel:
    return TaskModel(
        id=uuid.UUID(task.id),
        workspace_id=uuid.UUID(task.workspace_id),
        list_id=uuid.UUID(task.list_id) if task.list_id else None,
        text=task.text,
        state=task.state.value,
        priority=task.priority.value,
        assignee_id=uuid.UUID(task.assignee_id) if task.assignee_id else None,
        due_date=task.due_date,
        description=task.description,
        tags=task.tags or [],
        created_at=task.created_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at,
        created_by=task.created_by,
    )


class PostgresTaskRepository(TaskRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, task: Task) -> Task:
        task_uuid = uuid.UUID(task.id)

        # Pre-check: see if this id already exists
        result = await self._session.execute(
            select(TaskModel).where(TaskModel.id == task_uuid)
        )
        existing: TaskModel | None = result.scalar_one_or_none()

        if existing is not None:
            # Record with this id exists — check workspace
            if existing.workspace_id != uuid.UUID(task.workspace_id):
                raise DuplicateResourceError(
                    f"Task with id {task.id} already exists in a different workspace"
                )
            # Same workspace: check payload compatibility
            compatible = (
                existing.text == task.text
                and existing.list_id == (uuid.UUID(task.list_id) if task.list_id else None)
                and existing.state == task.state.value
                and existing.priority == task.priority.value
                and existing.assignee_id == (uuid.UUID(task.assignee_id) if task.assignee_id else None)
                and existing.due_date == task.due_date
                and existing.description == task.description
                and existing.tags == (task.tags or [])
            )
            if not compatible:
                raise DuplicateResourceError(
                    f"Task with id {task.id} already exists with incompatible payload"
                )
            # Idempotent retry — return existing resource
            return _model_to_domain(existing)

        # No existing record — insert new
        model = _domain_to_model(task)
        self._session.add(model)
        await self._session.flush()
        return task

    async def find_by_id(self, task_id: str) -> Task | None:
        try:
            task_uuid = uuid.UUID(task_id)
        except ValueError:
            return None

        result = await self._session.execute(
            select(TaskModel).where(TaskModel.id == task_uuid)
        )
        model: TaskModel | None = result.scalar_one_or_none()
        if model is None:
            return None
        return _model_to_domain(model)

    async def find_by_workspace(self, workspace_id: str) -> list[Task]:
        try:
            workspace_uuid = uuid.UUID(workspace_id)
        except ValueError:
            return []

        result = await self._session.execute(
            select(TaskModel)
            .where(TaskModel.workspace_id == workspace_uuid)
            .order_by(TaskModel.created_at)
        )
        models = result.scalars().all()
        return [_model_to_domain(m) for m in models]

    async def delete(self, task_id: str) -> bool:
        try:
            task_uuid = uuid.UUID(task_id)
        except ValueError:
            return False

        result = await self._session.execute(
            select(TaskModel).where(TaskModel.id == task_uuid)
        )
        model: TaskModel | None = result.scalar_one_or_none()
        if model is None:
            return False

        await self._session.delete(model)
        await self._session.flush()
        return True
