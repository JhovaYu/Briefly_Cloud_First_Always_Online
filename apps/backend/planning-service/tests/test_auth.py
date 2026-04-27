import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.adapters.auth.supabase_jwks_token_verifier import SupabaseJWKSVerifier
from app.adapters.workspace_client import WorkspacePermissionsClient, PermissionDenied, UpstreamUnavailable
from app.api.dependencies import get_current_user, require_workspace_access, AuthenticatedUser
from app.domain.errors import Unauthorized, AuthServiceUnavailable
from app.ports.token_verifier import TokenPayload


class TestSupabaseJWKSVerifier:
    def test_missing_token_raises_unauthorized(self):
        verifier = SupabaseJWKSVerifier(
            jwks_url="https://example.com/.well-known/jwks.json",
            issuer="https://example.com",
            audience="authenticated",
        )
        with pytest.raises(Unauthorized):
            verifier.verify("")

    def test_invalid_token_format_raises_unauthorized(self):
        verifier = SupabaseJWKSVerifier(
            jwks_url="https://example.com/.well-known/jwks.json",
            issuer="https://example.com",
            audience="authenticated",
        )
        with pytest.raises(Unauthorized):
            verifier.verify("not.a.valid.jwt.token")


class TestWorkspacePermissionsClient:
    @pytest.mark.asyncio
    async def test_check_membership_returns_true_for_member(self):
        client = WorkspacePermissionsClient(base_url="http://workspace-service:8001", timeout=1.0)
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"role": "member", "user_id": "user-123", "workspace_id": "ws-123"}
            mock_client.return_value.__aenter__.return_value.get.return_value = mock_response

            result = await client.check_membership("ws-123", "user-123", "valid-token")
            assert result is True

    @pytest.mark.asyncio
    async def test_check_membership_raises_permission_denied_for_403(self):
        client = WorkspacePermissionsClient(base_url="http://workspace-service:8001", timeout=1.0)
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 403
            mock_client.return_value.__aenter__.return_value.get.return_value = mock_response

            with pytest.raises(PermissionDenied):
                await client.check_membership("ws-123", "user-123", "valid-token")

    @pytest.mark.asyncio
    async def test_check_membership_raises_upstream_unavailable_on_connect_error(self):
        import httpx
        client = WorkspacePermissionsClient(base_url="http://workspace-service:8001", timeout=1.0)
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get.side_effect = httpx.ConnectError("Connection refused")

            with pytest.raises(UpstreamUnavailable):
                await client.check_membership("ws-123", "user-123", "valid-token")


class TestGetCurrentUser:
    @pytest.mark.asyncio
    async def test_missing_credentials_none_raises_401(self):
        """credentials=None (missing Authorization header) → 401"""
        credentials = None
        verifier = MagicMock()

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials, verifier)

        assert exc_info.value.status_code == 401
        assert "WWW-Authenticate" in exc_info.value.headers

    @pytest.mark.asyncio
    async def test_non_bearer_scheme_raises_401(self):
        """Non-Bearer scheme (e.g., Basic) → 401"""
        credentials = HTTPAuthorizationCredentials(scheme="Basic", credentials="abc123")
        verifier = MagicMock()

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials, verifier)

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_empty_bearer_credentials_raises_401(self):
        """Empty Bearer token → 401"""
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="")
        verifier = MagicMock()
        verifier.verify.side_effect = Unauthorized("No token")

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials, verifier)

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid-token")
        verifier = MagicMock()
        verifier.verify.side_effect = Unauthorized("Invalid token")

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials, verifier)

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_valid_token_returns_payload(self):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")
        verifier = MagicMock()
        payload = TokenPayload(sub="user-123", email="test@example.com", exp=9999999999, iss="https://example.com")
        verifier.verify.return_value = payload

        result = await get_current_user(credentials, verifier)

        assert isinstance(result, AuthenticatedUser)
        assert result.payload.sub == "user-123"
        assert result.token == "valid-token"

    @pytest.mark.asyncio
    async def test_auth_service_unavailable_raises_503(self):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")
        verifier = MagicMock()
        verifier.verify.side_effect = AuthServiceUnavailable("JWKS unavailable")

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials, verifier)

        assert exc_info.value.status_code == 503

    @pytest.mark.asyncio
    async def test_invalid_jwt_does_not_call_workspace_service(self):
        """Invalid JWT raises 401 BEFORE workspace-service is called"""
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid-jwt")
        verifier = MagicMock()
        verifier.verify.side_effect = Unauthorized("Invalid token")
        workspace_client = MagicMock()
        workspace_client.check_membership = AsyncMock(return_value=True)

        with pytest.raises(HTTPException):
            await get_current_user(credentials, verifier)

        # Workspace client must NOT be called — auth fails first
        workspace_client.check_membership.assert_not_called()


class TestRequireWorkspaceAccess:
    @pytest.mark.asyncio
    async def test_member_user_passes(self):
        workspace_id = "ws-123"
        auth_user = AuthenticatedUser(
            payload=TokenPayload(sub="user-123", email="test@example.com", exp=9999999999, iss="https://example.com"),
            token="valid-token",
        )
        workspace_client = MagicMock()
        workspace_client.check_membership = AsyncMock(return_value=True)

        await require_workspace_access(workspace_id, auth_user, workspace_client)

        workspace_client.check_membership.assert_called_once_with(
            workspace_id=workspace_id,
            user_id="user-123",
            token="valid-token",
        )

    @pytest.mark.asyncio
    async def test_non_member_raises_403(self):
        workspace_id = "ws-123"
        auth_user = AuthenticatedUser(
            payload=TokenPayload(sub="user-123", email="test@example.com", exp=9999999999, iss="https://example.com"),
            token="valid-token",
        )
        workspace_client = MagicMock()
        workspace_client.check_membership = AsyncMock(return_value=False)

        with pytest.raises(HTTPException) as exc_info:
            await require_workspace_access(workspace_id, auth_user, workspace_client)

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_permission_denied_raises_403(self):
        workspace_id = "ws-123"
        auth_user = AuthenticatedUser(
            payload=TokenPayload(sub="user-123", email="test@example.com", exp=9999999999, iss="https://example.com"),
            token="valid-token",
        )
        workspace_client = MagicMock()
        workspace_client.check_membership = AsyncMock(side_effect=PermissionDenied("Access denied"))

        with pytest.raises(HTTPException) as exc_info:
            await require_workspace_access(workspace_id, auth_user, workspace_client)

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_upstream_unavailable_raises_503(self):
        workspace_id = "ws-123"
        auth_user = AuthenticatedUser(
            payload=TokenPayload(sub="user-123", email="test@example.com", exp=9999999999, iss="https://example.com"),
            token="valid-token",
        )
        workspace_client = MagicMock()
        workspace_client.check_membership = AsyncMock(side_effect=UpstreamUnavailable("Service down"))

        with pytest.raises(HTTPException) as exc_info:
            await require_workspace_access(workspace_id, auth_user, workspace_client)

        assert exc_info.value.status_code == 503