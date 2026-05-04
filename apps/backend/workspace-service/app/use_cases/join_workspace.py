import uuid
from datetime import datetime, timezone

from app.domain.workspace import Workspace
from app.domain.membership import Membership, MembershipRole
from app.domain.errors import WorkspaceNotFound
from app.ports.workspace_repository import WorkspaceRepository
from app.ports.membership_repository import MembershipRepository


async def join_workspace(
    workspace_id: str,
    user_id: str,
    workspace_repo: WorkspaceRepository,
    membership_repo: MembershipRepository,
) -> tuple[Workspace, bool]:
    """
    Join a workspace as MEMBER. Idempotent: if already a member, returns
    the workspace without creating a duplicate membership.

    Returns (workspace, already_member).
    Raises WorkspaceNotFound if the workspace does not exist.
    """
    workspace = await workspace_repo.get_by_id(workspace_id)
    if not workspace:
        raise WorkspaceNotFound("Workspace not found")

    existing = await membership_repo.get_by_workspace_and_user(workspace_id, user_id)
    if existing:
        return (workspace, True)

    now = datetime.now(timezone.utc)
    membership = Membership(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        user_id=user_id,
        role=MembershipRole.MEMBER,
        joined_at=now,
    )
    await membership_repo.create(membership)

    return (workspace, False)
