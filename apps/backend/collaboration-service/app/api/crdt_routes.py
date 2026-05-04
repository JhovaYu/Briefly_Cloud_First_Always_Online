"""
CRDT WebSocket endpoint using pycrdt-websocket.

This is an experimental endpoint for PM-03D.
Uses ASGIServer + WebsocketServer for CRDT room management.
Auth is handled via short-lived opaque tickets (no JWT in query string).

Note: This endpoint requires ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=true to be mounted.
The stable endpoint with verified auth is /collab/{ws_id}/{doc_id} (PM-03B first-message auth).
"""

import logging
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

# Diagnostic logger — writes to stdout so it appears in `docker compose logs`
# Use a name under uvicorn so it is captured by the Docker log driver
_logger = logging.getLogger("uvicorn.error")


def _mask_ticket(ticket_id: str) -> str:
    """Return a safe representation of a ticket ID for logging — no full values."""
    if not ticket_id:
        return "absent"
    if len(ticket_id) <= 4:
        return "***"
    return ticket_id[:4] + "..."


def _log(prefix: str, msg: str) -> None:
    """Print a log line to stdout/stderr for Docker capture. No secrets."""
    line = f"[collab] {prefix} {msg}"
    print(line, flush=True)


def extract_workspace_document_from_ws_path(path: str) -> tuple[str, str] | None:
    """Extract (workspace_id, document_id) from a WebSocket path robustly.

    Supports two path formats depending on how pycrdt-websocket / uvicorn
    constructs the ASGI scope:

    Format A (mount-relative, 2 segments):
        /{workspace_id}/{document_id}
        e.g. /ws-123/doc-456  → ("ws-123", "doc-456")

    Format B (full path with /collab/crdt prefix, 4 segments):
        /collab/crdt/{workspace_id}/{document_id}
        e.g. /collab/crdt/ws-123/doc-456  → ("ws-123", "doc-456")

    Returns None if the path does not match any expected format.
    """
    if not path:
        return None

    segments = path.strip("/").split("/")
    n = len(segments)

    if n == 2:
        # Format A: /{workspace_id}/{document_id}
        return segments[0], segments[1]
    elif n >= 4 and segments[0] == "collab" and segments[1] == "crdt":
        # Format B: /collab/crdt/{workspace_id}/{document_id}
        return segments[2], segments[3]
    else:
        return None


def get_room_manager(document_store=None):
    global _room_manager
    if _room_manager is None:
        from app.adapters.pycrdt_room_manager import PycrdtRoomManager
        _room_manager = PycrdtRoomManager(document_store=document_store)
    return _room_manager


def create_crdt_app(document_store=None) -> tuple[Any, Any]:
    """Create the CRDT ASGI app and return (app, room_manager).

    This creates a separate ASGI app mounted at /collab/crdt/*
    in the main app.
    """
    manager = get_room_manager(document_store)
    if document_store is not None:
        manager.set_document_store(document_store)
    ws_server = manager.server

    async def on_connect(msg: dict, scope: dict) -> bool:
        """Validate ticket from query string before accepting WebSocket connection.

        Ticket must be present as ?ticket=<opaque_id>
        and must match the workspace_id/document_id from the path.

        pycrdt-websocket on_connect boolean semantics:
            return True  => reject / close the WebSocket connection
            return False => accept / allow the WebSocket connection
        """
        # ── Extract ticket from query string ──────────────────────────────────
        query_string = scope.get("query_string", b"").decode()
        params = {}
        if query_string:
            for part in query_string.split("&"):
                if "=" in part:
                    k, v = part.split("=", 1)
                    params[k] = v

        ticket_id = params.get("ticket", "")

        # ── Extract workspace_id and document_id from path ───────────────────
        raw_path = scope.get("path", "")
        ws_pair = extract_workspace_document_from_ws_path(raw_path)

        if ws_pair is None:
            _log("WARNING", f"[DENIED] invalid_ws_path path={raw_path!r} has_ticket={str(bool(ticket_id))}")
            return True  # reject: malformed path

        workspace_id, document_id = ws_pair

        path_type = "full" if raw_path.startswith("/collab/crdt") else "relative"
        _log("INFO", f"[ATTEMPT] ws_connect path_type={path_type} ws_id={workspace_id!r} doc_id={document_id!r} has_ticket={str(bool(ticket_id))}")

        # ── Validate ticket ──────────────────────────────────────────────────
        ticket_store = get_ticket_store()
        try:
            if not ticket_id:
                _log("WARNING", f"[DENIED] missing_ticket ws_id={workspace_id!r} doc_id={document_id!r}")
                return True  # reject: no ticket

            await validate_collaboration_ticket(
                ticket_id=ticket_id,
                workspace_id=workspace_id,
                document_id=document_id,
                ticket_store=ticket_store,
            )
            # Pre-create room using the clean room key format
            room_key = f"{workspace_id}/{document_id}"
            channel_id = id(msg)
            manager.track_channel(channel_id, room_key)
            await manager._ensure_room_for_path(room_key, workspace_id, document_id)

            _log("INFO", f"[ALLOWED] ws_connected ws_id={workspace_id!r} doc_id={document_id!r}")
            return False  # accept

        except TicketInvalid as e:
            reason = getattr(e, "args", ["unknown"])[0] if e.args else "unknown"
            if "required" in reason or "missing" in reason:
                denial_type = "missing_ticket"
            elif "expired" in reason:
                denial_type = "ticket_expired"
            elif "does not match" in reason or "mismatch" in reason:
                denial_type = "ticket_mismatch"
            elif "invalid" in reason:
                denial_type = "ticket_invalid"
            else:
                denial_type = "ticket_rejected"

            _log("WARNING", f"[DENIED] {denial_type} ws_id={workspace_id!r} doc_id={document_id!r} ticket={_mask_ticket(ticket_id)}")
            return True  # reject

    async def on_disconnect(msg: dict) -> None:
        """Handle client disconnect: save snapshot if last client, then cleanup."""
        channel_id = id(msg)
        await manager.handle_disconnect(channel_id)

    asgi_server = ASGIServer(ws_server, on_connect=on_connect, on_disconnect=on_disconnect)
    return asgi_server, manager


def create_crdt_subapp():
    """Create the CRDT sub-application for mounting in main FastAPI app."""
    app, _ = create_crdt_app()
    return app
