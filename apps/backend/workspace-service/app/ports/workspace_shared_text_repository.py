from abc import ABC, abstractmethod
from app.domain.workspace_shared_text import WorkspaceSharedText


class WorkspaceSharedTextRepository(ABC):
    @abstractmethod
    async def get(self, workspace_id: str) -> WorkspaceSharedText | None: ...

    @abstractmethod
    async def upsert(self, shared_text: WorkspaceSharedText) -> WorkspaceSharedText: ...