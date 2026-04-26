from app.domain.workspace import Workspace
from app.domain.errors import WorkspaceNotFound
from app.ports.workspace_repository import WorkspaceRepository
from app.ports.membership_repository import MembershipRepository


async def get_workspace(
    workspace_id: str,
    user_id: str,
    workspace_repo: WorkspaceRepository,
    membership_repo: MembershipRepository,
) -> Workspace:
    membership = await membership_repo.get_by_workspace_and_user(workspace_id, user_id)
    if not membership:
        raise WorkspaceNotFound("Workspace not found or access denied")

    workspace = await workspace_repo.get_by_id(workspace_id)
    if not workspace:
        raise WorkspaceNotFound("Workspace not found or access denied")

    return workspace
