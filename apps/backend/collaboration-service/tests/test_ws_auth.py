import json

import pytest
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.testclient import WebSocketDisconnect

from app.api.routes import (
    CLOSE_AUTH_TIMEOUT,
    CLOSE_INVALID_MESSAGE,
    CLOSE_PERMISSION_DENIED,
    CLOSE_UPSTREAM_ERROR,
    router,
)
from app.adapters.workspace_client import WorkspacePermissionsClient
from app.domain.errors import PermissionDenied, UpstreamUnavailable


app = FastAPI(title="collab-auth-test")
app.include_router(router)
client = TestClient(app)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class TestHealthEndpoints:
    def test_health_returns_200(self):
        response = client.get("/collab/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "service": "collaboration-service"}

    def test_healthz_returns_200(self):
        response = client.get("/collab/healthz")
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Echo (diagnostic endpoint — no auth)
# ---------------------------------------------------------------------------

class TestEchoEndpoint:
    def test_echo_ws_works(self):
        with client.websocket_connect("/collab/echo") as ws:
            data = ws.receive_json()
            assert data == {"type": "ready", "service": "collaboration-service"}
            ws.send_text("ping")
            assert ws.receive_json() == {"type": "pong"}
            ws.send_text("hello")
            assert ws.receive_json() == {"type": "echo", "payload": "hello"}


# ---------------------------------------------------------------------------
# Auth negative tests — verify close codes
# ---------------------------------------------------------------------------

class TestAuthCloseCodes:
    """Verify server closes WebSocket with correct code for each error case."""

    def test_invalid_json_closes_with_4400(self):
        with client.websocket_connect("/collab/ws-id/doc-id") as ws:
            ws.send_text("not json {")
            with pytest.raises(WebSocketDisconnect) as exc_info:
                ws.receive_text()
            assert exc_info.value.code == CLOSE_INVALID_MESSAGE

    def test_wrong_message_type_closes_with_4400(self):
        with client.websocket_connect("/collab/ws-id/doc-id") as ws:
            ws.send_text(json.dumps({"type": "notauth", "token": "abc"}))
            with pytest.raises(WebSocketDisconnect) as exc_info:
                ws.receive_text()
            assert exc_info.value.code == CLOSE_INVALID_MESSAGE

    def test_empty_token_closes_with_4003(self):
        with client.websocket_connect("/collab/ws-id/doc-id") as ws:
            ws.send_text(json.dumps({"type": "auth", "token": ""}))
            with pytest.raises(WebSocketDisconnect) as exc_info:
                ws.receive_text()
            assert exc_info.value.code == CLOSE_PERMISSION_DENIED

    def test_missing_token_field_closes_with_4003(self):
        with client.websocket_connect("/collab/ws-id/doc-id") as ws:
            ws.send_text(json.dumps({"type": "auth"}))
            with pytest.raises(WebSocketDisconnect) as exc_info:
                ws.receive_text()
            assert exc_info.value.code == CLOSE_PERMISSION_DENIED

    def test_token_not_leaked_in_response(self):
        """Token must never appear in any server response body."""
        with client.websocket_connect("/collab/ws-id/doc-id") as ws:
            ws.send_text(json.dumps({
                "type": "auth",
                "token": "super-secret-real-token",
            }))
            try:
                while True:
                    data = ws.receive_text()
                    assert "super-secret-real-token" not in data
            except WebSocketDisconnect:
                pass


# ---------------------------------------------------------------------------
# Auth positive tests — with faked permission client
# ---------------------------------------------------------------------------

class TestAuthPositive:
    """Test auth_ok flow with a fake permission client that returns success."""

    def test_auth_ok_ping_pong(self):
        """After auth_ok, server echoes ping/pong and returns auth_ok with role."""
        fake_permissions = AsyncMock()
        fake_permissions.check.return_value = {
            "workspace_id": "workspace-1",
            "user_id": "user-1",
            "role": "owner",
        }

        with patch(
            "app.api.routes.get_workspace_permissions",
            return_value=fake_permissions,
        ):
            with client.websocket_connect("/collab/workspace-1/doc-1") as ws:
                # First message: auth
                ws.send_text(json.dumps({
                    "type": "auth",
                    "token": "any-valid-looking-token",
                }))
                # Receive auth_ok
                auth_ok = ws.receive_json()
                assert auth_ok == {
                    "type": "auth_ok",
                    "workspace_id": "workspace-1",
                    "document_id": "doc-1",
                    "role": "owner",
                }
                # After auth_ok, ping -> pong
                ws.send_text("ping")
                assert ws.receive_json() == {"type": "pong"}

    def test_permission_denied_closes_with_4003(self):
        """Fake permission client returning PermissionDenied → server closes 4003."""
        fake_permissions = AsyncMock()
        fake_permissions.check.side_effect = PermissionDenied("Access denied")

        with patch(
            "app.api.routes.get_workspace_permissions",
            return_value=fake_permissions,
        ):
            with client.websocket_connect("/collab/ws-id/doc-id") as ws:
                ws.send_text(json.dumps({
                    "type": "auth",
                    "token": "some-token",
                }))
                with pytest.raises(WebSocketDisconnect) as exc_info:
                    ws.receive_text()
                assert exc_info.value.code == CLOSE_PERMISSION_DENIED

    def test_upstream_unavailable_closes_with_1011(self):
        """Fake permission client raising UpstreamUnavailable → server closes 1011."""
        fake_permissions = AsyncMock()
        fake_permissions.check.side_effect = UpstreamUnavailable("Service down")

        with patch(
            "app.api.routes.get_workspace_permissions",
            return_value=fake_permissions,
        ):
            with client.websocket_connect("/collab/ws-id/doc-id") as ws:
                ws.send_text(json.dumps({
                    "type": "auth",
                    "token": "some-token",
                }))
                with pytest.raises(WebSocketDisconnect) as exc_info:
                    ws.receive_text()
                assert exc_info.value.code == CLOSE_UPSTREAM_ERROR


# ---------------------------------------------------------------------------
# WorkspacePermissionsClient unit tests
# ---------------------------------------------------------------------------

class TestWorkspacePermissionsClient:
    """Unit tests for the HTTP client to workspace-service."""

    @pytest.mark.asyncio
    async def test_permission_denied_status(self):
        mock_response = AsyncMock()
        mock_response.status_code = 403

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value.get.return_value = mock_response

        with patch("httpx.AsyncClient", return_value=mock_client):
            http_client = WorkspacePermissionsClient("http://ws:8001", 3.0)
            with pytest.raises(PermissionDenied):
                await http_client.check("workspace-1", "fake-token")

    @pytest.mark.asyncio
    async def test_upstream_timeout(self):
        import httpx
        mock_client = AsyncMock()
        mock_client.__aenter__.side_effect = httpx.TimeoutException("timeout")

        with patch("httpx.AsyncClient", return_value=mock_client):
            http_client = WorkspacePermissionsClient("http://ws:8001", 3.0)
            with pytest.raises(UpstreamUnavailable):
                await http_client.check("workspace-1", "fake-token")
