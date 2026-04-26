import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI

from app.api.routes import router

app = FastAPI(title="collaboration-service-test")
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
        assert response.json() == {"status": "ok", "service": "collaboration-service"}


class TestWebSocketEcho:
    def test_ws_echo_connect_and_receive_ready(self):
        with client.websocket_connect("/collab/echo") as ws:
            data = ws.receive_json()
            assert data == {"type": "ready", "service": "collaboration-service"}

    def test_ws_echo_ping_pong(self):
        with client.websocket_connect("/collab/echo") as ws:
            ws.receive_json()  # consume ready
            ws.send_text("ping")
            data = ws.receive_json()
            assert data == {"type": "pong"}

    def test_ws_echo_text_echo(self):
        with client.websocket_connect("/collab/echo") as ws:
            ws.receive_json()  # consume ready
            ws.send_text("hello")
            data = ws.receive_json()
            assert data == {"type": "echo", "payload": "hello"}

    def test_ws_echo_disconnect_clean(self):
        with client.websocket_connect("/collab/echo") as ws:
            ws.receive_json()  # consume ready
        # Connection closed without error — passes if no exception raised
