import pytest
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


class TestHealthEndpoints:
    def test_health_returns_200(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "service": "workspace-service"}

    def test_healthz_returns_200(self):
        response = client.get("/healthz")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "service": "workspace-service"}


class TestAuthEndpoints:
    def test_me_without_token_returns_401(self):
        response = client.get("/me")
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    def test_me_with_invalid_token_returns_401(self):
        response = client.get("/me", headers={"Authorization": "Bearer invalid-token"})
        assert response.status_code == 401
        body = response.json()
        assert body["detail"] == "Invalid token"
        # Verify no internal details leak
        assert "Not enough segments" not in body["detail"]
        assert "_pyjwt" not in body["detail"]
        assert "jwks" not in body["detail"].lower()
        assert "issuer" not in body["detail"].lower()
        assert "signature" not in body["detail"].lower()

    def test_me_with_malformed_token_returns_generic_error(self):
        response = client.get("/me", headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"})
        assert response.status_code == 401
        body = response.json()
        # Must NOT expose "Not enough segments" or internal JWT library details
        assert "Not enough segments" not in body["detail"]
        assert body["detail"] in ("Invalid token", "Token expired")
