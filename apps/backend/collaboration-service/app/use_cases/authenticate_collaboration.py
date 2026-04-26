from app.domain.errors import PermissionDenied, UpstreamUnavailable
from app.ports.workspace_permissions import WorkspacePermissions


async def authenticate_collaboration(
    workspace_id: str,
    token: str,
    workspace_permissions: WorkspacePermissions,
) -> dict:
    """Validate token and return workspace permissions for collaboration.

    Calls workspace service internally to verify membership.
    Raises PermissionDenied if token invalid or user not member.
    Raises UpstreamUnavailable if workspace service is down.
    """
    return await workspace_permissions.check(workspace_id, token)
