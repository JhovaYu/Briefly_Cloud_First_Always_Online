import uuid
from datetime import datetime, timezone

from app.domain.workspace import Workspace
from app.domain.membership import Membership, MembershipRole
from app.ports.workspace_repository import WorkspaceRepository
from app.ports.membership_repository import MembershipRepository


async def create_workspace(
    name: str,
    owner_id: str,
    workspace_repo: WorkspaceRepository,
    membership_repo: MembershipRepository,
) -> Workspace:
    now = datetime.now(timezone.utc)
    workspace = Workspace(
        id=str(uuid.uuid4()),
        name=name,
        owner_id=owner_id,
        created_at=now,
        updated_at=now,
    )
    await workspace_repo.create(workspace)

    membership = Membership(
        id=str(uuid.uuid4()),
        workspace_id=workspace.id,
        user_id=owner_id,
        role=MembershipRole.OWNER,
        joined_at=now,
    )
    await membership_repo.create(membership)

    return workspace
