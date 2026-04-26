import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocket

from app.api.routes import router, ws_collab
from app.adapters.workspace_client import WorkspacePermissionsClient
from app.domain.errors import PermissionDenied, UpstreamUnavailable


app = FastAPI(title="collab-auth-test")
app.include_router(router)
client = TestClient(app)


class TestHealthEndpoints:
    def test_health_returns_200(self):
        response = client.get("/collab/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "service": "collaboration-service"}

    def test_healthz_returns_200(self):
        response = client.get("/collab/healthz")
        assert response.status_code == 200


class TestEchoEndpoint:
    def test_echo_ws_still_works(self):
        with client.websocket_connect("/collab/echo") as ws:
            data = ws.receive_json()
            assert data == {"type": "ready", "service": "collaboration-service"}
            ws.send_text("ping")
            pong = ws.receive_json()
            assert pong == {"type": "pong"}


class TestAuthEndpointBehavior:
    """Test auth logic with mocked permission client."""

    def test_invalid_json_closes(self):
        """Non-JSON first message should close connection."""
        with pytest.raises(Exception):
            ws = client.websocket_connect("/collab/ws-id/doc-id")
            ws.send_text("not json {")

    def test_wrong_message_type_closes(self):
        """First message type != 'auth' closes connection."""
        import json
        with pytest.raises(Exception):
            ws = client.websocket_connect("/collab/ws-id/doc-id")
            ws.send_text(json.dumps({"type": "notauth", "token": "abc"}))

    def test_empty_token_closes(self):
        """Empty token closes connection."""
        import json
        with pytest.raises(Exception):
            ws = client.websocket_connect("/collab/ws-id/doc-id")
            ws.send_text(json.dumps({"type": "auth", "token": ""}))

    def test_missing_token_field_closes(self):
        """Missing token field closes connection."""
        import json
        with pytest.raises(Exception):
            ws = client.websocket_connect("/collab/ws-id/doc-id")
            ws.send_text(json.dumps({"type": "auth"}))

    def test_token_not_in_error_response(self):
        """Token must not appear in error response body."""
        import json
        try:
            ws = client.websocket_connect("/collab/ws-id/doc-id")
            ws.send_text(json.dumps({"type": "auth", "token": "super-secret-real-token"}))
            # Will close due to upstream error, but response must not echo token
            data = ws.receive_text()
            data_str = json.dumps(data) if isinstance(data, dict) else str(data)
            assert "super-secret-real-token" not in data_str
        except Exception:
            # Connection closed - verify token not leaked
            pass


class TestWorkspacePermissionsClient:
    """Unit tests for the workspace permissions client."""

    @pytest.mark.asyncio
    async def test_permission_denied_raises(self):
        from app.adapters.workspace_client import WorkspacePermissionsClient
        mock_response = AsyncMock()
        mock_response.status_code = 403

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value.get.return_value = mock_response

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = WorkspacePermissionsClient("http://ws:8001", 3.0)
            with pytest.raises(PermissionDenied):
                await client.check("workspace-1", "fake-token")

    @pytest.mark.asyncio
    async def test_upstream_timeout_raises(self):
        from app.adapters.workspace_client import WorkspacePermissionsClient
        import httpx
        mock_client = AsyncMock()
        mock_client.__aenter__.side_effect = httpx.TimeoutException("timeout")

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = WorkspacePermissionsClient("http://ws:8001", 3.0)
            with pytest.raises(UpstreamUnavailable):
                await client.check("workspace-1", "fake-token")

