from app.domain.workspace import Workspace
from app.ports.workspace_repository import WorkspaceRepository
from app.ports.membership_repository import MembershipRepository


async def list_workspaces(
    user_id: str,
    workspace_repo: WorkspaceRepository,
    membership_repo: MembershipRepository,
) -> list[Workspace]:
    memberships = await membership_repo.list_by_user(user_id)
    workspace_ids = [m.workspace_id for m in memberships]
    workspaces = []
    for wid in workspace_ids:
        w = await workspace_repo.get_by_id(wid)
        if w:
            workspaces.append(w)
    return workspaces
