from abc import ABC, abstractmethod


class WorkspacePermissions(ABC):
    @abstractmethod
    async def check_membership(self, workspace_id: str, user_id: str, token: str) -> bool: ...