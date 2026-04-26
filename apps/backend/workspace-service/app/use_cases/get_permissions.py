from app.domain.membership import Membership, MembershipRole
from app.domain.errors import WorkspaceNotFound
from app.ports.membership_repository import MembershipRepository


async def get_permissions(
    workspace_id: str,
    user_id: str,
    membership_repo: MembershipRepository,
) -> dict:
    membership = await membership_repo.get_by_workspace_and_user(workspace_id, user_id)
    if not membership:
        raise WorkspaceNotFound("Access denied")

    return {
        "workspace_id": workspace_id,
        "user_id": user_id,
        "role": membership.role.value,
    }
