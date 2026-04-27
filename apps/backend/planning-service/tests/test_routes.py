import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.api.dependencies import AuthenticatedUser, get_current_user, get_workspace_client, get_task_repo, get_task_list_repo
from app.ports.token_verifier import TokenPayload
from app.adapters.persistence.in_memory_task_repository import InMemoryTaskRepository
from app.adapters.persistence.in_memory_task_list_repository import InMemoryTaskListRepository


VALID_TOKEN = "test-valid-token"


def auth_user():
    return AuthenticatedUser(
        payload=TokenPayload(sub="user-123", email="test@example.com", exp=9999999999, iss="https://example.com"),
        token=VALID_TOKEN,
    )


def workspace_client_mock():
    client = MagicMock()
    client.check_membership = AsyncMock(return_value=True)
    return client


class TestHealthEndpoints:
    def test_health_endpoint(self):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert response.json()["service"] == "planning-service"

    def test_healthz_endpoint(self):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/healthz")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


class TestAuthMissing:
    """Missing Authorization header must return 401"""

    def test_get_task_lists_without_auth_returns_401(self):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/workspaces/ws-123/task-lists")
        assert response.status_code == 401

    def test_post_task_lists_without_auth_returns_401(self):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post("/workspaces/ws-123/task-lists", json={"id": "x", "name": "Test"})
        assert response.status_code == 401

    def test_get_tasks_without_auth_returns_401(self):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/workspaces/ws-123/tasks")
        assert response.status_code == 401

    def test_post_tasks_without_auth_returns_401(self):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post("/workspaces/ws-123/tasks", json={"id": "x", "text": "Test", "state": "pending", "priority": "low"})
        assert response.status_code == 401

    def test_put_task_without_auth_returns_401(self):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.put("/workspaces/ws-123/tasks/some-id", json={"text": "Updated"})
        assert response.status_code == 401

    def test_delete_task_without_auth_returns_401(self):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.delete("/workspaces/ws-123/tasks/some-id")
        assert response.status_code == 401


class TestInvalidTokenHandling:
    """Malformed/invalid/empty token must return 401"""

    def test_malformed_bearer_token_returns_401(self):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get(
            "/workspaces/ws-123/task-lists",
            headers={"Authorization": "Bearer not-a-valid-jwt"},
        )
        assert response.status_code == 401

    def test_empty_bearer_token_returns_401(self):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get(
            "/workspaces/ws-123/task-lists",
            headers={"Authorization": "Bearer "},
        )
        assert response.status_code == 401

    def test_basic_auth_scheme_returns_401(self):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get(
            "/workspaces/ws-123/task-lists",
            headers={"Authorization": "Basic dXNlcjpwYXNz"},
        )
        assert response.status_code == 401


class TestSchemaValidationRequiresAuth:
    def test_create_task_with_invalid_state_returns_422(self):
        app.dependency_overrides[get_current_user] = auth_user
        app.dependency_overrides[get_workspace_client] = workspace_client_mock
        try:
            client = TestClient(app, raise_server_exceptions=False)
            response = client.post(
                "/workspaces/ws-123/tasks",
                json={
                    "id": "task-123",
                    "text": "Test task",
                    "state": "invalid-state",
                    "priority": "high",
                },
                headers={"Authorization": f"Bearer {VALID_TOKEN}"},
            )
            assert response.status_code == 422
        finally:
            app.dependency_overrides.clear()

    def test_create_task_with_invalid_priority_returns_422(self):
        app.dependency_overrides[get_current_user] = auth_user
        app.dependency_overrides[get_workspace_client] = workspace_client_mock
        try:
            client = TestClient(app, raise_server_exceptions=False)
            response = client.post(
                "/workspaces/ws-123/tasks",
                json={
                    "id": "task-123",
                    "text": "Test task",
                    "state": "pending",
                    "priority": "invalid-priority",
                },
                headers={"Authorization": f"Bearer {VALID_TOKEN}"},
            )
            assert response.status_code == 422
        finally:
            app.dependency_overrides.clear()

    def test_create_task_list_without_name_returns_422(self):
        app.dependency_overrides[get_current_user] = auth_user
        app.dependency_overrides[get_workspace_client] = workspace_client_mock
        try:
            client = TestClient(app, raise_server_exceptions=False)
            response = client.post(
                "/workspaces/ws-123/task-lists",
                json={"id": "list-123"},
                headers={"Authorization": f"Bearer {VALID_TOKEN}"},
            )
            assert response.status_code == 422
        finally:
            app.dependency_overrides.clear()


class TestClientGeneratedIds:
    def test_create_task_list_preserves_client_id(self):
        app.dependency_overrides[get_current_user] = auth_user
        app.dependency_overrides[get_workspace_client] = workspace_client_mock
        app.dependency_overrides[get_task_list_repo] = lambda: InMemoryTaskListRepository()
        try:
            client = TestClient(app, raise_server_exceptions=False)
            response = client.post(
                "/workspaces/ws-123/task-lists",
                json={"id": "my-custom-id-xyz", "name": "My List"},
                headers={"Authorization": f"Bearer {VALID_TOKEN}"},
            )
            assert response.status_code == 201
            data = response.json()
            assert data["id"] == "my-custom-id-xyz"
        finally:
            app.dependency_overrides.clear()

    def test_create_task_preserves_client_id(self):
        app.dependency_overrides[get_current_user] = auth_user
        app.dependency_overrides[get_workspace_client] = workspace_client_mock
        app.dependency_overrides[get_task_repo] = lambda: InMemoryTaskRepository()
        try:
            client = TestClient(app, raise_server_exceptions=False)
            response = client.post(
                "/workspaces/ws-123/tasks",
                json={
                    "id": "custom-task-id-abc",
                    "text": "Do something",
                    "state": "pending",
                    "priority": "high",
                },
                headers={"Authorization": f"Bearer {VALID_TOKEN}"},
            )
            assert response.status_code == 201
            data = response.json()
            assert data["id"] == "custom-task-id-abc"
        finally:
            app.dependency_overrides.clear()

    def test_get_tasks_filters_by_workspace(self):
        app.dependency_overrides[get_current_user] = auth_user
        app.dependency_overrides[get_workspace_client] = workspace_client_mock
        app.dependency_overrides[get_task_repo] = lambda: InMemoryTaskRepository()
        try:
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get(
                "/workspaces/ws-123/tasks",
                headers={"Authorization": f"Bearer {VALID_TOKEN}"},
            )
            assert response.status_code == 200
            assert response.json()["tasks"] == []
        finally:
            app.dependency_overrides.clear()


class TestWorkspaceIsolation:
    def test_task_in_ws1_not_visible_from_ws2(self):
        repo = InMemoryTaskRepository()

        app.dependency_overrides[get_current_user] = auth_user
        app.dependency_overrides[get_task_repo] = lambda: repo
        try:
            client = TestClient(app, raise_server_exceptions=False)

            ws1_mock = workspace_client_mock()
            app.dependency_overrides[get_workspace_client] = lambda: ws1_mock
            create_resp = client.post(
                "/workspaces/ws-1/tasks",
                json={
                    "id": "task-ws1",
                    "text": "Task in WS1",
                    "state": "pending",
                    "priority": "low",
                },
                headers={"Authorization": f"Bearer {VALID_TOKEN}"},
            )
            assert create_resp.status_code == 201

            ws2_mock = workspace_client_mock()
            app.dependency_overrides[get_workspace_client] = lambda: ws2_mock
            list_resp = client.get(
                "/workspaces/ws-2/tasks",
                headers={"Authorization": f"Bearer {VALID_TOKEN}"},
            )
            assert list_resp.status_code == 200
            assert list_resp.json()["tasks"] == []
        finally:
            app.dependency_overrides.clear()


class TestCrossWorkspaceUpdateDelete:
    def test_update_task_in_other_workspace_returns_404(self):
        repo = InMemoryTaskRepository()

        app.dependency_overrides[get_current_user] = auth_user
        app.dependency_overrides[get_task_repo] = lambda: repo
        app.dependency_overrides[get_workspace_client] = workspace_client_mock
        try:
            client = TestClient(app, raise_server_exceptions=False)
            update_resp = client.put(
                "/workspaces/ws-1/tasks/task-123",
                json={"text": "Updated"},
                headers={"Authorization": f"Bearer {VALID_TOKEN}"},
            )
            assert update_resp.status_code == 404
        finally:
            app.dependency_overrides.clear()