import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.adapters.persistence.sqlalchemy_workspace_shared_text import Base
from app.ports.workspace_shared_text_repository import WorkspaceSharedTextRepository
from app.domain.workspace_shared_text import WorkspaceSharedText
from app.domain.errors import WorkspaceNotFound

_engine = None
_session_factory = None


def _get_engine():
    global _engine
    if _engine is None:
        database_url = os.getenv("WORKSPACE_DATABASE_URL", "")
        _engine = create_async_engine(database_url, echo=False)
    return _engine


def _get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(bind=_get_engine(), class_=AsyncSession, expire_on_commit=False)
    return _session_factory


async def init_db():
    engine = _get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


class SQLAlchemyWorkspaceSharedTextRepository(WorkspaceSharedTextRepository):
    def __init__(self):
        self._session_factory = _get_session_factory()

    async def get(self, workspace_id: str) -> WorkspaceSharedText | None:
        from app.adapters.persistence.sqlalchemy_workspace_shared_text import WorkspaceSharedTextModel
        session = self._session_factory()
        try:
            result = await session.get(WorkspaceSharedTextModel, workspace_id)
            if result is None:
                return None
            return WorkspaceSharedText(
                workspace_id=result.workspace_id,
                content=result.content,
                updated_by=result.updated_by,
                updated_at=result.updated_at,
                version=result.version,
            )
        finally:
            await session.close()

    async def upsert(self, shared_text: WorkspaceSharedText) -> WorkspaceSharedText:
        from app.adapters.persistence.sqlalchemy_workspace_shared_text import WorkspaceSharedTextModel
        session = self._session_factory()
        try:
            existing = await session.get(WorkspaceSharedTextModel, shared_text.workspace_id)
            if existing:
                existing.content = shared_text.content
                existing.updated_by = shared_text.updated_by
                existing.updated_at = shared_text.updated_at
                existing.version = existing.version + 1
                await session.commit()
                await session.refresh(existing)
                return WorkspaceSharedText(
                    workspace_id=existing.workspace_id,
                    content=existing.content,
                    updated_by=existing.updated_by,
                    updated_at=existing.updated_at,
                    version=existing.version,
                )
            else:
                model = WorkspaceSharedTextModel(
                    workspace_id=shared_text.workspace_id,
                    content=shared_text.content,
                    updated_by=shared_text.updated_by,
                    updated_at=shared_text.updated_at,
                    version=1,
                )
                session.add(model)
                await session.commit()
                await session.refresh(model)
                return WorkspaceSharedText(
                    workspace_id=model.workspace_id,
                    content=model.content,
                    updated_by=model.updated_by,
                    updated_at=model.updated_at,
                    version=model.version,
                )
        finally:
            await session.close()


class InMemoryWorkspaceSharedTextRepository(WorkspaceSharedTextRepository):
    def __init__(self):
        self._store: dict[str, WorkspaceSharedText] = {}

    async def get(self, workspace_id: str) -> WorkspaceSharedText | None:
        return self._store.get(workspace_id)

    async def upsert(self, shared_text: WorkspaceSharedText) -> WorkspaceSharedText:
        existing = self._store.get(shared_text.workspace_id)
        if existing:
            updated = WorkspaceSharedText(
                workspace_id=shared_text.workspace_id,
                content=shared_text.content,
                updated_by=shared_text.updated_by,
                updated_at=shared_text.updated_at,
                version=existing.version + 1,
            )
            self._store[shared_text.workspace_id] = updated
            return updated
        else:
            shared_text.version = 1
            self._store[shared_text.workspace_id] = shared_text
            return shared_text