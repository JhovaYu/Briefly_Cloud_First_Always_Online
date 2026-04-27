import uuid
from datetime import datetime, timezone
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    CheckConstraint,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship, mapped_column, Mapped

from app.adapters.persistence.sqlalchemy.base import Base


class TaskListModel(Base):
    __tablename__ = "task_lists"
    __table_args__ = (
        UniqueConstraint("id", "workspace_id", name="uq_task_lists_id_workspace"),
        Index("idx_task_lists_workspace_id", "workspace_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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
    created_by: Mapped[str] = mapped_column(Text, nullable=False)


class TaskModel(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "state IN ('pending', 'working', 'done')",
            name="ck_tasks_state",
        ),
        CheckConstraint(
            "priority IN ('low', 'medium', 'high')",
            name="ck_tasks_priority",
        ),
        Index("idx_tasks_workspace_id", "workspace_id"),
        Index("idx_tasks_list_id", "list_id", postgresql_where=sa.text("list_id IS NOT NULL")),
        Index("idx_tasks_workspace_state", "workspace_id", "state"),
        Index("idx_tasks_assignee", "assignee_id", postgresql_where=sa.text("assignee_id IS NOT NULL")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    list_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    priority: Mapped[str] = mapped_column(Text, nullable=False, default="medium")
    assignee_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text), nullable=True, default=[])
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
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationship - note composite FK requires manual foreign_keys specification
    # The FK constraint is managed at the DB level via migration, not via ORM relationship