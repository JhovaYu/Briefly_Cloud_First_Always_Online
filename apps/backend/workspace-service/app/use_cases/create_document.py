import uuid
from datetime import datetime, timezone

from app.domain.document_metadata import DocumentMetadata
from app.domain.errors import WorkspaceNotFound
from app.ports.document_repository import DocumentRepository
from app.ports.workspace_repository import WorkspaceRepository
from app.ports.membership_repository import MembershipRepository


async def create_document(
    workspace_id: str,
    title: str,
    user_id: str,
    document_repo: DocumentRepository,
    workspace_repo: WorkspaceRepository,
    membership_repo: MembershipRepository,
) -> DocumentMetadata:
    membership = await membership_repo.get_by_workspace_and_user(workspace_id, user_id)
    if not membership:
        raise WorkspaceNotFound("Workspace not found or access denied")

    workspace = await workspace_repo.get_by_id(workspace_id)
    if not workspace:
        raise WorkspaceNotFound("Workspace not found or access denied")

    now = datetime.now(timezone.utc)
    document = DocumentMetadata(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        title=title,
        created_by=user_id,
        created_at=now,
        updated_at=now,
    )
    return await document_repo.create(document)
