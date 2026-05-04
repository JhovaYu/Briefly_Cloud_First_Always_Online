from fastapi import APIRouter, Depends, HTTPException, status

from app.api.schemas import (
    CreateWorkspaceRequest,
    WorkspaceResponse,
    WorkspaceListResponse,
    CreateDocumentRequest,
    DocumentResponse,
    DocumentListResponse,
    PermissionsResponse,
    MeResponse,
    SharedTextResponse,
    UpdateSharedTextRequest,
    JoinWorkspaceResponse,
)
from app.api.dependencies import (
    get_current_user,
    get_workspace_repo,
    get_membership_repo,
    get_document_repo,
    get_shared_text_repo,
)
from app.domain.errors import WorkspaceNotFound
from app.domain.workspace_shared_text import WorkspaceSharedText
from app.ports.token_verifier import TokenPayload
from app.ports.workspace_repository import WorkspaceRepository
from app.ports.membership_repository import MembershipRepository
from app.ports.document_repository import DocumentRepository
from app.ports.workspace_shared_text_repository import WorkspaceSharedTextRepository
from app.use_cases import (
    create_workspace,
    list_workspaces,
    get_workspace,
    create_document,
    list_documents,
    get_permissions,
    join_workspace,
)

router = APIRouter()





@router.get("/me", response_model=MeResponse)
async def get_me(
    current_user: TokenPayload = Depends(get_current_user),
):
    return MeResponse(
        user_id=current_user.sub,
        email=current_user.email,
    )


@router.post("/workspaces", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace_endpoint(
    req: CreateWorkspaceRequest,
    current_user: TokenPayload = Depends(get_current_user),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repo),
    membership_repo: MembershipRepository = Depends(get_membership_repo),
):
    workspace = await create_workspace(
        name=req.name,
        owner_id=current_user.sub,
        workspace_repo=workspace_repo,
        membership_repo=membership_repo,
    )
    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        owner_id=workspace.owner_id,
        created_at=workspace.created_at.isoformat(),
        updated_at=workspace.updated_at.isoformat(),
    )


@router.get("/workspaces", response_model=WorkspaceListResponse)
async def list_workspaces_endpoint(
    current_user: TokenPayload = Depends(get_current_user),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repo),
    membership_repo: MembershipRepository = Depends(get_membership_repo),
):
    workspaces = await list_workspaces(
        user_id=current_user.sub,
        workspace_repo=workspace_repo,
        membership_repo=membership_repo,
    )
    return WorkspaceListResponse(
        workspaces=[
            WorkspaceResponse(
                id=w.id,
                name=w.name,
                owner_id=w.owner_id,
                created_at=w.created_at.isoformat(),
                updated_at=w.updated_at.isoformat(),
            )
            for w in workspaces
        ]
    )


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace_endpoint(
    workspace_id: str,
    current_user: TokenPayload = Depends(get_current_user),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repo),
    membership_repo: MembershipRepository = Depends(get_membership_repo),
):
    try:
        workspace = await get_workspace(
            workspace_id=workspace_id,
            user_id=current_user.sub,
            workspace_repo=workspace_repo,
            membership_repo=membership_repo,
        )
    except WorkspaceNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found or access denied")

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        owner_id=workspace.owner_id,
        created_at=workspace.created_at.isoformat(),
        updated_at=workspace.updated_at.isoformat(),
    )


@router.post("/workspaces/{workspace_id}/join", response_model=JoinWorkspaceResponse)
async def join_workspace_endpoint(
    workspace_id: str,
    current_user: TokenPayload = Depends(get_current_user),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repo),
    membership_repo: MembershipRepository = Depends(get_membership_repo),
):
    try:
        workspace, already_member = await join_workspace(
            workspace_id=workspace_id,
            user_id=current_user.sub,
            workspace_repo=workspace_repo,
            membership_repo=membership_repo,
        )
    except WorkspaceNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    return JoinWorkspaceResponse(
        workspace=WorkspaceResponse(
            id=workspace.id,
            name=workspace.name,
            owner_id=workspace.owner_id,
            created_at=workspace.created_at.isoformat(),
            updated_at=workspace.updated_at.isoformat(),
        ),
        already_member=already_member,
    )


@router.post("/workspaces/{workspace_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document_endpoint(
    workspace_id: str,
    req: CreateDocumentRequest,
    current_user: TokenPayload = Depends(get_current_user),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repo),
    membership_repo: MembershipRepository = Depends(get_membership_repo),
    document_repo: DocumentRepository = Depends(get_document_repo),
):
    try:
        document = await create_document(
            workspace_id=workspace_id,
            title=req.title,
            user_id=current_user.sub,
            document_repo=document_repo,
            workspace_repo=workspace_repo,
            membership_repo=membership_repo,
        )
    except WorkspaceNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found or access denied")

    return DocumentResponse(
        id=document.id,
        workspace_id=document.workspace_id,
        title=document.title,
        created_by=document.created_by,
        created_at=document.created_at.isoformat(),
        updated_at=document.updated_at.isoformat(),
    )


@router.get("/workspaces/{workspace_id}/documents", response_model=DocumentListResponse)
async def list_documents_endpoint(
    workspace_id: str,
    current_user: TokenPayload = Depends(get_current_user),
    membership_repo: MembershipRepository = Depends(get_membership_repo),
    document_repo: DocumentRepository = Depends(get_document_repo),
):
    try:
        documents = await list_documents(
            workspace_id=workspace_id,
            user_id=current_user.sub,
            document_repo=document_repo,
            membership_repo=membership_repo,
        )
    except WorkspaceNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found or access denied")

    return DocumentListResponse(
        documents=[
            DocumentResponse(
                id=d.id,
                workspace_id=d.workspace_id,
                title=d.title,
                created_by=d.created_by,
                created_at=d.created_at.isoformat(),
                updated_at=d.updated_at.isoformat(),
            )
            for d in documents
        ]
    )


@router.get("/workspaces/{workspace_id}/permissions", response_model=PermissionsResponse)
async def get_permissions_endpoint(
    workspace_id: str,
    current_user: TokenPayload = Depends(get_current_user),
    membership_repo: MembershipRepository = Depends(get_membership_repo),
):
    try:
        perms = await get_permissions(
            workspace_id=workspace_id,
            user_id=current_user.sub,
            membership_repo=membership_repo,
        )
    except WorkspaceNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access denied")

    return PermissionsResponse(**perms)


@router.get("/workspaces/{workspace_id}/shared-text", response_model=SharedTextResponse)
async def get_shared_text_endpoint(
    workspace_id: str,
    current_user: TokenPayload = Depends(get_current_user),
    membership_repo: MembershipRepository = Depends(get_membership_repo),
    shared_text_repo: WorkspaceSharedTextRepository = Depends(get_shared_text_repo),
):
    # Verify membership (workspace exists + user has access)
    membership = await membership_repo.get_by_workspace_and_user(workspace_id, current_user.sub)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found or access denied")

    shared_text = await shared_text_repo.get(workspace_id)
    if shared_text is None:
        # Return empty content if not yet created
        return SharedTextResponse(
            workspace_id=workspace_id,
            content="",
            updated_by=None,
            updated_at="",
            version=0,
        )

    return SharedTextResponse(
        workspace_id=shared_text.workspace_id,
        content=shared_text.content,
        updated_by=shared_text.updated_by,
        updated_at=shared_text.updated_at.isoformat() if shared_text.updated_at else "",
        version=shared_text.version,
    )


@router.put("/workspaces/{workspace_id}/shared-text", response_model=SharedTextResponse)
async def update_shared_text_endpoint(
    workspace_id: str,
    req: UpdateSharedTextRequest,
    current_user: TokenPayload = Depends(get_current_user),
    membership_repo: MembershipRepository = Depends(get_membership_repo),
    shared_text_repo: WorkspaceSharedTextRepository = Depends(get_shared_text_repo),
):
    # Verify membership (workspace exists + user has access)
    membership = await membership_repo.get_by_workspace_and_user(workspace_id, current_user.sub)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found or access denied")

    from datetime import datetime, timezone
    shared_text = await shared_text_repo.upsert(
        WorkspaceSharedText(
            workspace_id=workspace_id,
            content=req.content,
            updated_by=current_user.sub,
            updated_at=datetime.now(timezone.utc),
            version=1,
        )
    )

    return SharedTextResponse(
        workspace_id=shared_text.workspace_id,
        content=shared_text.content,
        updated_by=shared_text.updated_by,
        updated_at=shared_text.updated_at.isoformat() if shared_text.updated_at else "",
        version=shared_text.version,
    )
