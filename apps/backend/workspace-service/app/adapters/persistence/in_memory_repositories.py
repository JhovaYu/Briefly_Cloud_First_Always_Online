from collections import defaultdict

from app.domain.workspace import Workspace
from app.domain.membership import Membership
from app.domain.document_metadata import DocumentMetadata
from app.ports.workspace_repository import WorkspaceRepository
from app.ports.membership_repository import MembershipRepository
from app.ports.document_repository import DocumentRepository


class InMemoryWorkspaceRepository(WorkspaceRepository):
    def __init__(self):
        self._workspaces: dict[str, Workspace] = {}

    async def create(self, workspace: Workspace) -> Workspace:
        self._workspaces[workspace.id] = workspace
        return workspace

    async def get_by_id(self, workspace_id: str) -> Workspace | None:
        return self._workspaces.get(workspace_id)

    async def list_by_owner(self, owner_id: str) -> list[Workspace]:
        return [w for w in self._workspaces.values() if w.owner_id == owner_id]


class InMemoryMembershipRepository(MembershipRepository):
    def __init__(self):
        self._memberships: dict[str, Membership] = {}
        self._by_workspace: dict[str, list[str]] = defaultdict(list)
        self._by_user: dict[str, list[str]] = defaultdict(list)

    async def create(self, membership: Membership) -> Membership:
        self._memberships[membership.id] = membership
        self._by_workspace[membership.workspace_id].append(membership.id)
        self._by_user[membership.user_id].append(membership.id)
        return membership

    async def get_by_workspace_and_user(self, workspace_id: str, user_id: str) -> Membership | None:
        for m in self._memberships.values():
            if m.workspace_id == workspace_id and m.user_id == user_id:
                return m
        return None

    async def list_by_workspace(self, workspace_id: str) -> list[Membership]:
        ids = self._by_workspace.get(workspace_id, [])
        return [self._memberships[mid] for mid in ids if mid in self._memberships]

    async def list_by_user(self, user_id: str) -> list[Membership]:
        ids = self._by_user.get(user_id, [])
        return [self._memberships[mid] for mid in ids if mid in self._memberships]


class InMemoryDocumentRepository(DocumentRepository):
    def __init__(self):
        self._documents: dict[str, DocumentMetadata] = {}
        self._by_workspace: dict[str, list[str]] = defaultdict(list)

    async def create(self, document: DocumentMetadata) -> DocumentMetadata:
        self._documents[document.id] = document
        self._by_workspace[document.workspace_id].append(document.id)
        return document

    async def list_by_workspace(self, workspace_id: str) -> list[DocumentMetadata]:
        ids = self._by_workspace.get(workspace_id, [])
        return [self._documents[did] for did in ids if did in self._documents]
