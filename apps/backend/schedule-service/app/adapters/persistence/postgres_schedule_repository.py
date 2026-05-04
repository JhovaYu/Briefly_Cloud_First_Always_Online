"""Postgres implementation of ScheduleBlockRepository."""

from __future__ import annotations

import uuid
from datetime import datetime, time, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.persistence.sqlalchemy.models import ScheduleBlockModel
from app.domain.schedule_block import ScheduleBlock
from app.ports.schedule_block_repository import ScheduleBlockRepository
from app.domain.errors import DuplicateResourceError


def _model_to_domain(model: ScheduleBlockModel) -> ScheduleBlock:
    """Convert DB model to domain dataclass.

    PostgreSQL TIME (HH:MM:SS.ffffff) → Python time → string "HH:MM" (no seconds).
    """
    start_time_str = model.start_time.strftime("%H:%M") if model.start_time else "00:00"
    return ScheduleBlock(
        id=str(model.id),
        workspace_id=str(model.workspace_id),
        title=model.title,
        day_of_week=model.day_of_week,
        start_time=start_time_str,
        duration_minutes=model.duration_minutes,
        color=model.color,
        location=model.location,
        notes=model.notes,
        created_at=model.created_at,
        updated_at=model.updated_at,
        created_by=str(model.created_by),
    )


class PostgresScheduleBlockRepository(ScheduleBlockRepository):
    """Backed by PostgreSQL via SQLAlchemy async session."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, block: ScheduleBlock) -> ScheduleBlock:
        # Check for duplicate by id in this workspace
        block_uuid = uuid.UUID(block.id)
        ws_uuid = uuid.UUID(block.workspace_id)

        result = await self._session.execute(
            select(ScheduleBlockModel).where(
                and_(
                    ScheduleBlockModel.id == block_uuid,
                    ScheduleBlockModel.workspace_id == ws_uuid,
                )
            )
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            raise DuplicateResourceError(
                f"ScheduleBlock with id {block.id} already exists in workspace {block.workspace_id}"
            )

        # Parse start_time "HH:MM" → Python time for DB
        hours, minutes = block.start_time.split(":")
        start_time_value = time(int(hours), int(minutes))

        model = ScheduleBlockModel(
            id=block_uuid,
            workspace_id=ws_uuid,
            title=block.title,
            day_of_week=block.day_of_week,
            start_time=start_time_value,
            duration_minutes=block.duration_minutes,
            color=block.color,
            location=block.location,
            notes=block.notes,
            created_at=block.created_at,
            updated_at=block.updated_at,
            created_by=block.created_by,
        )
        self._session.add(model)
        await self._session.flush()
        return block

    async def list_by_workspace(self, workspace_id: str) -> list[ScheduleBlock]:
        try:
            ws_uuid = uuid.UUID(workspace_id)
        except ValueError:
            return []

        result = await self._session.execute(
            select(ScheduleBlockModel)
            .where(ScheduleBlockModel.workspace_id == ws_uuid)
            .order_by(
                ScheduleBlockModel.day_of_week,
                ScheduleBlockModel.start_time,
                ScheduleBlockModel.id,
            )
        )
        models = result.scalars().all()
        return [_model_to_domain(m) for m in models]

    async def get_by_id(self, block_id: str, workspace_id: str) -> ScheduleBlock | None:
        model = await self._get_model_by_id(block_id, workspace_id)
        if model is None:
            return None
        return _model_to_domain(model)

    async def _get_model_by_id(self, block_id: str, workspace_id: str) -> ScheduleBlockModel | None:
        """Return the DB model directly (not converted to domain). Used by update/delete."""
        try:
            block_uuid = uuid.UUID(block_id)
            ws_uuid = uuid.UUID(workspace_id)
        except ValueError:
            return None
        result = await self._session.execute(
            select(ScheduleBlockModel).where(
                and_(
                    ScheduleBlockModel.id == block_uuid,
                    ScheduleBlockModel.workspace_id == ws_uuid,
                )
            )
        )
        return result.scalar_one_or_none()

    async def update(
        self, block_id: str, workspace_id: str, **kwargs
    ) -> ScheduleBlock:
        model = await self._get_model_by_id(block_id, workspace_id)
        if model is None:
            raise LookupError(
                f"ScheduleBlock {block_id} not found in workspace {workspace_id}"
            )

        # Apply field updates
        if "title" in kwargs and kwargs["title"] is not None:
            model.title = kwargs["title"]
        if "day_of_week" in kwargs and kwargs["day_of_week"] is not None:
            model.day_of_week = kwargs["day_of_week"]
        if "start_time" in kwargs and kwargs["start_time"] is not None:
            h, m = kwargs["start_time"].split(":")
            model.start_time = time(int(h), int(m))
        if "duration_minutes" in kwargs and kwargs["duration_minutes"] is not None:
            model.duration_minutes = kwargs["duration_minutes"]
        if "color" in kwargs:
            model.color = kwargs["color"]
        if "location" in kwargs:
            model.location = kwargs["location"]
        if "notes" in kwargs:
            model.notes = kwargs["notes"]

        model.updated_at = datetime.now(timezone.utc)
        await self._session.flush()
        return _model_to_domain(model)

    async def delete(self, block_id: str, workspace_id: str) -> None:
        model = await self._get_model_by_id(block_id, workspace_id)
        if model is None:
            raise LookupError(
                f"ScheduleBlock {block_id} not found in workspace {workspace_id}"
            )
        await self._session.delete(model)
        await self._session.flush()