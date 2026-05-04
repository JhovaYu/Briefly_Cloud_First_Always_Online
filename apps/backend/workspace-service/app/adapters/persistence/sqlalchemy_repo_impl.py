"""
SQLAlchemy async repository implementations for workspace and membership persistence.

Keeps ownership in workspace-service (no importing from planning-service).
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.adapters.persistence.sqlalchemy_repositories import Base, WorkspaceModel, MembershipModel
from app.ports.workspace_repository import WorkspaceRepository
from app.ports.membership_repository import MembershipRepository
from app.domain.workspace import Workspace
from app.domain.membership import Membership, MembershipRole

logger = logging.getLogger(__name__)

_engine = None
_session_factory = None


def _get_database_url() -> str | None:
    """Get database URL from environment. Safe — never logs the URL."""
    return os.getenv("WORKSPACE_DATABASE_URL") or None


def _get_engine():
    global _engine
    if _engine is None:
        db_url = _get_database_url()
        if not db_url:
            raise RuntimeError("WORKSPACE_DATABASE_URL not configured")
        _engine = create_async_engine(db_url, poolclass=NullPool, echo=False)
    return _engine


def _get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=_get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


async def init_db():
    """Create all tables if they don't exist. Idempotent."""
    engine = _get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Workspace database tables initialized")


class SQLAlchemyWorkspaceRepository(WorkspaceRepository):
    async def create(self, workspace: Workspace) -> Workspace:
        session_factory = _get_session_factory()
        async with session_factory() as session:
            model = WorkspaceModel(
                id=workspace.id,
                name=workspace.name,
                owner_id=workspace.owner_id,
                created_at=workspace.created_at,
                updated_at=workspace.updated_at,
            )
            session.add(model)
            await session.commit()
            return workspace

    async def get_by_id(self, workspace_id: str) -> Workspace | None:
        session_factory = _get_session_factory()
        async with session_factory() as session:
            result = await session.get(WorkspaceModel, workspace_id)
            if result is None:
                return None
            return Workspace(
                id=result.id,
                name=result.name,
                owner_id=result.owner_id,
                created_at=result.created_at,
                updated_at=result.updated_at,
            )

    async def list_by_owner(self, owner_id: str) -> list[Workspace]:
        session_factory = _get_session_factory()
        async with session_factory() as session:
            stmt = select(WorkspaceModel).where(WorkspaceModel.owner_id == owner_id)
            result = await session.execute(stmt)
            rows = result.scalars().all()
            return [
                Workspace(
                    id=row.id,
                    name=row.name,
                    owner_id=row.owner_id,
                    created_at=row.created_at,
                    updated_at=row.updated_at,
                )
                for row in rows
            ]


class SQLAlchemyMembershipRepository(MembershipRepository):
    async def create(self, membership: Membership) -> Membership:
        session_factory = _get_session_factory()
        async with session_factory() as session:
            model = MembershipModel(
                workspace_id=membership.workspace_id,
                user_id=membership.user_id,
                role=membership.role.value,
                joined_at=membership.joined_at,
            )
            session.add(model)
            await session.commit()
            return membership

    async def get_by_workspace_and_user(
        self, workspace_id: str, user_id: str
    ) -> Membership | None:
        session_factory = _get_session_factory()
        async with session_factory() as session:
            stmt = select(MembershipModel).where(
                MembershipModel.workspace_id == workspace_id,
                MembershipModel.user_id == user_id,
            )
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()
            if row is None:
                return None
            return Membership(
                id=f"{row.workspace_id}:{row.user_id}",  # synthetic id
                workspace_id=row.workspace_id,
                user_id=row.user_id,
                role=MembershipRole(row.role),
                joined_at=row.joined_at,
            )

    async def list_by_workspace(self, workspace_id: str) -> list[Membership]:
        session_factory = _get_session_factory()
        async with session_factory() as session:
            stmt = select(MembershipModel).where(
                MembershipModel.workspace_id == workspace_id
            )
            result = await session.execute(stmt)
            rows = result.scalars().all()
            return [
                Membership(
                    id=f"{row.workspace_id}:{row.user_id}",
                    workspace_id=row.workspace_id,
                    user_id=row.user_id,
                    role=MembershipRole(row.role),
                    joined_at=row.joined_at,
                )
                for row in rows
            ]

    async def list_by_user(self, user_id: str) -> list[Membership]:
        session_factory = _get_session_factory()
        async with session_factory() as session:
            stmt = select(MembershipModel).where(MembershipModel.user_id == user_id)
            result = await session.execute(stmt)
            rows = result.scalars().all()
            return [
                Membership(
                    id=f"{row.workspace_id}:{row.user_id}",
                    workspace_id=row.workspace_id,
                    user_id=row.user_id,
                    role=MembershipRole(row.role),
                    joined_at=row.joined_at,
                )
                for row in rows
            ]
