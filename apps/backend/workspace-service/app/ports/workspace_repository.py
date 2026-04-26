from abc import ABC, abstractmethod
from app.domain.workspace import Workspace


class WorkspaceRepository(ABC):
    @abstractmethod
    async def create(self, workspace: Workspace) -> Workspace: ...

    @abstractmethod
    async def get_by_id(self, workspace_id: str) -> Workspace | None: ...

    @abstractmethod
    async def list_by_owner(self, owner_id: str) -> list[Workspace]: ...
