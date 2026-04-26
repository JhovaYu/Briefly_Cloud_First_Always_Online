from app.domain.document_metadata import DocumentMetadata
from app.domain.errors import WorkspaceNotFound
from app.ports.document_repository import DocumentRepository
from app.ports.membership_repository import MembershipRepository


async def list_documents(
    workspace_id: str,
    user_id: str,
    document_repo: DocumentRepository,
    membership_repo: MembershipRepository,
) -> list[DocumentMetadata]:
    membership = await membership_repo.get_by_workspace_and_user(workspace_id, user_id)
    if not membership:
        raise WorkspaceNotFound("Workspace not found or access denied")

    return await document_repo.list_by_workspace(workspace_id)
