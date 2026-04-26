"""
CRDT WebSocket endpoint using pycrdt-websocket.

This is an experimental endpoint for PM-03D.
Uses ASGIServer + WebsocketServer for CRDT room management.
Auth is handled via short-lived opaque tickets (no JWT in query string).

Note: This endpoint requires ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=true to be mounted.
The stable endpoint with verified auth is /collab/{ws_id}/{doc_id} (PM-03B first-message auth).
"""

from typing import Any

from pycrdt.websocket import ASGIServer, WebsocketServer

from app.adapters.in_memory_ticket_store import InMemoryTicketStore
from app.api.routes import get_ticket_store
from app.use_cases.validate_collaboration_ticket import (
    TicketInvalid,
    validate_collaboration_ticket,
)


# Global room manager instance (singleton per service)
_room_manager = None


def get_room_manager():
    global _room_manager
    if _room_manager is None:
        from app.adapters.pycrdt_room_manager import PycrdtRoomManager
        _room_manager = PycrdtRoomManager()
    return _room_manager


def create_crdt_app() -> tuple[Any, Any]:
    """Create the CRDT ASGI app and return (app, room_manager).

    This creates a separate ASGI app mounted at /collab/crdt/*
    in the main app.
    """
    manager = get_room_manager()
    ws_server = manager.server

    async def on_connect(msg: dict, scope: dict) -> bool:
        """Validate ticket from query string before accepting WebSocket connection.

        Ticket must be present as ?ticket=<opaque_id>
        and must match the workspace_id/document_id from the path.

        Returns True to reject connection, False to accept.
        """
        # pycrdt calls on_connect(msg, scope) — scope is the ASGI scope dict
        # Extract ticket from query string
        query_string = scope.get("query_string", b"").decode()
        params = {}
        if query_string:
            for part in query_string.split("&"):
                if "=" in part:
                    k, v = part.split("=", 1)
                    params[k] = v

        ticket_id = params.get("ticket", "")

        # Extract workspace_id and document_id from path
        # Path format: /{workspace_id}/{document_id}
        path = scope.get("path", "")
        parts = path.strip("/").split("/")
        if len(parts) >= 2:
            workspace_id = parts[-2]
            document_id = parts[-1]
        else:
            return True  # reject: invalid path

        # Validate ticket
        ticket_store = get_ticket_store()
        try:
            await validate_collaboration_ticket(
                ticket_id=ticket_id,
                workspace_id=workspace_id,
                document_id=document_id,
                ticket_store=ticket_store,
            )
            return False  # accept
        except TicketInvalid:
            return True  # reject

    asgi_server = ASGIServer(ws_server, on_connect=on_connect)
    return asgi_server, manager


def create_crdt_subapp():
    """Create the CRDT sub-application for mounting in main FastAPI app."""
    app, _ = create_crdt_app()
    return app