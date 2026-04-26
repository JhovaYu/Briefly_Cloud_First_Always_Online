from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.domain.errors import Unauthorized, AuthServiceUnavailable
from app.ports.token_verifier import TokenVerifier, TokenPayload
from app.ports.workspace_repository import WorkspaceRepository
from app.ports.membership_repository import MembershipRepository
from app.ports.document_repository import DocumentRepository
from app.adapters.auth.supabase_jwks_token_verifier import SupabaseJWKSVerifier
from app.adapters.persistence.in_memory_repositories import (
    InMemoryWorkspaceRepository,
    InMemoryMembershipRepository,
    InMemoryDocumentRepository,
)
from app.config.settings import Settings

security = HTTPBearer()

# Singleton repositories — application-wide in-memory state
_workspace_repo: WorkspaceRepository | None = None
_membership_repo: MembershipRepository | None = None
_document_repo: DocumentRepository | None = None
_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def get_workspace_repo() -> WorkspaceRepository:
    global _workspace_repo
    if _workspace_repo is None:
        _workspace_repo = InMemoryWorkspaceRepository()
    return _workspace_repo


def get_membership_repo() -> MembershipRepository:
    global _membership_repo
    if _membership_repo is None:
        _membership_repo = InMemoryMembershipRepository()
    return _membership_repo


def get_document_repo() -> DocumentRepository:
    global _document_repo
    if _document_repo is None:
        _document_repo = InMemoryDocumentRepository()
    return _document_repo


def get_token_verifier() -> TokenVerifier:
    settings = get_settings()
    return SupabaseJWKSVerifier(
        jwks_url=settings.SUPABASE_JWKS_URL,
        issuer=settings.SUPABASE_JWT_ISSUER,
        audience=settings.SUPABASE_JWT_AUDIENCE,
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    verifier: TokenVerifier = Depends(get_token_verifier),
) -> TokenPayload:
    try:
        return verifier.verify(credentials.credentials)
    except AuthServiceUnavailable as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Unauthorized as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
