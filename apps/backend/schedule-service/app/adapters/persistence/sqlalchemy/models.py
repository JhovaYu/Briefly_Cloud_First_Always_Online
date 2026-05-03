"""SQLAlchemy model for schedule_blocks table."""

from __future__ import annotations

import uuid
from datetime import datetime, time, timezone

from sqlalchemy import (
    CheckConstraint,
    Index,
    String,
    Text,
    DateTime,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import mapped_column, Mapped

from app.adapters.persistence.sqlalchemy.base import Base


class ScheduleBlockModel(Base):
    """Maps to the schedule_blocks table in briefly_schedule database."""

    __tablename__ = "schedule_blocks"

    # No unique constraint on (id, workspace_id) needed — id is already PK.
    # Workspace filtering is done at query level.

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    day_of_week: Mapped[int] = mapped_column(nullable=False)
    start_time: Mapped[time] = mapped_column(nullable=False)  # PostgreSQL TIME → datetime.time
    duration_minutes: Mapped[int] = mapped_column(nullable=False)
    color: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="ck_schedule_blocks_day_of_week"),
        CheckConstraint("duration_minutes BETWEEN 5 AND 480", name="ck_schedule_blocks_duration"),
        Index("idx_schedule_blocks_workspace_id", "workspace_id"),
        Index("idx_schedule_blocks_workspace_dow_start", "workspace_id", "day_of_week", "start_time"),
    )
