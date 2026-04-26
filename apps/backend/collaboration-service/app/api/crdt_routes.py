"""
CRDT WebSocket endpoint using pycrdt-websocket.

This is an experimental endpoint for PM-03C spike.
Uses ASGIServer + WebsocketServer for CRDT room management.

Note: For PM-03C spike, auth is simplified to token-in-query-string.
The existing /collab/{ws_id}/{doc_id} endpoint continues to use
first-message JSON auth for compatibility with PM-03B clients.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.routing import Route, WebSocketRoute
from starlette.types import ASGIApp

from pycrdt.websocket import ASGIServer, WebsocketServer

from app.adapters.pycrdt_room_manager import PycrdtRoomManager


# Global room manager instance (singleton per service)
_room_manager: PycrdtRoomManager | None = None


def get_room_manager() -> PycrdtRoomManager:
    global _room_manager
    if _room_manager is None:
        _room_manager = PycrdtRoomManager()
    return _room_manager


def create_crdt_app() -> tuple[ASGIApp, PycrdtRoomManager]:
    """Create the CRDT ASGI app and return (app, room_manager).

    This creates a separate ASGI app mounted at /collab/crdt/*
    in the main app.
    """
    manager = get_room_manager()
    ws_server = manager.server

    async def on_connect(scope: dict, receive: dict) -> bool:
        """Validate token before accepting WebSocket connection.

        For PM-03C spike: accepts any token for testing.
        Production would validate against workspace service here.
        Returns True to reject connection, False to accept.
        """
        return False  # accept all for now (spike mode)

    asgi_server = ASGIServer(ws_server, on_connect=on_connect)
    return asgi_server, manager


def create_crdt_subapp() -> ASGIApp:
    """Create the CRDT sub-application for mounting in main FastAPI app."""
    app, _ = create_crdt_app()
    return app


def create_crdt_routes() -> list[Route]:
    """Create routes for the CRDT WebSocket endpoint.

    Returns a list of Route objects that can be included in a FastAPI app.
    """
    _, manager = create_crdt_app()
    return []  # Routes are added via app.mount() not via router