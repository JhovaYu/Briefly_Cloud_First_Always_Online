"""
SQLAlchemy async repositories for workspace and membership persistence.

Uses WORKSPACE_DATABASE_URL (postgresql+asyncpg).
Falls back to in-memory if DATABASE_URL is not configured.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import Column, String, DateTime, PrimaryKeyConstraint, Index
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class WorkspaceModel(Base):
    """SqlAlchemy model for workspaces table."""
    __tablename__ = "workspaces"

    id: str = Column(String(36), primary_key=True)
    name: str = Column(String(255), nullable=False)
    owner_id: str = Column(String(36), nullable=False, index=True)
    created_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class MembershipModel(Base):
    """SqlAlchemy model for workspace_memberships table."""
    __tablename__ = "workspace_memberships"
    __table_args__ = (
        PrimaryKeyConstraint("workspace_id", "user_id"),
        Index("ix_memberships_workspace_id", "workspace_id"),
        Index("ix_memberships_user_id", "user_id"),
    )

    workspace_id: str = Column(String(36), nullable=False)
    user_id: str = Column(String(36), nullable=False)
    role: str = Column(String(20), nullable=False)  # owner | member | viewer
    joined_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
