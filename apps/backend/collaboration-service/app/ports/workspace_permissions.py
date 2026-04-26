from abc import ABC, abstractmethod


class WorkspacePermissions(ABC):
    @abstractmethod
    async def check(self, workspace_id: str, token: str) -> dict:
        """Check workspace permissions for a user identified by token.

        Returns dict with workspace_id, user_id, role if authorized.
        Raises PermissionDenied if not authorized.
        Raises UpstreamUnavailable if workspace service is unreachable.
        """
        ...
