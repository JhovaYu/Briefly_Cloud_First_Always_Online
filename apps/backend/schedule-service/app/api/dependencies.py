from __future__ import annotations

from dataclasses import dataclass
from contextlib import asynccontextmanager
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.domain.errors import Unauthorized, AuthServiceUnavailable
from app.ports.token_verifier import TokenVerifier, TokenPayload
from app.ports.schedule_block_repository import ScheduleBlockRepository
from app.ports.workspace_permissions import WorkspacePermissions
from app.adapters.auth.supabase_jwks_token_verifier import SupabaseJWKSVerifier
from app.adapters.workspace_client import WorkspacePermissionsClient, PermissionDenied, UpstreamUnavailable
from app.adapters.persistence.in_memory_schedule_repository import InMemoryScheduleBlockRepository
from app.config.settings import Settings

# auto_error=False gives explicit control over 401/403 behavior
security = HTTPBearer(auto_error=False)


@dataclass
class AuthenticatedUser:
    payload: TokenPayload
    token: str


_settings: Settings | None = None
_token_verifier: TokenVerifier | None = None
_workspace_client: WorkspacePermissions | None = None
_block_repo: ScheduleBlockRepository | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def get_block_repo() -> ScheduleBlockRepository:
    global _block_repo
    if _block_repo is None:
        _block_repo = InMemoryScheduleBlockRepository()
    return _block_repo


def get_token_verifier() -> TokenVerifier:
    global _token_verifier
    if _token_verifier is None:
        settings = get_settings()
        _token_verifier = SupabaseJWKSVerifier(
            jwks_url=settings.SUPABASE_JWKS_URL,
            issuer=settings.SUPABASE_JWT_ISSUER,
            audience=settings.SUPABASE_JWT_AUDIENCE,
        )
    return _token_verifier


def get_workspace_client() -> WorkspacePermissions:
    global _workspace_client
    if _workspace_client is None:
        settings = get_settings()
        _workspace_client = WorkspacePermissionsClient(
            base_url=settings.WORKSPACE_SERVICE_URL,
            timeout=5.0,
        )
    return _workspace_client


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    verifier: TokenVerifier = Depends(get_token_verifier),
) -> AuthenticatedUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if credentials.scheme != "Bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = verifier.verify(credentials.credentials)
        return AuthenticatedUser(payload=payload, token=credentials.credentials)
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


async def require_workspace_access(
    workspace_id: str,
    auth_user: AuthenticatedUser,
    workspace_client: WorkspacePermissions,
):
    try:
        is_member = await workspace_client.check_membership(
            workspace_id=workspace_id,
            user_id=auth_user.payload.sub,
            token=auth_user.token,
        )
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for this workspace",
            )
    except PermissionDenied:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for this workspace",
        )
    except UpstreamUnavailable:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authorization service unavailable",
        )