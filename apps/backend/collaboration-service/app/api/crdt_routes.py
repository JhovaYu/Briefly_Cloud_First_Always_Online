"""
CRDT WebSocket endpoint using pycrdt-websocket.

PM-08A: Mounted unconditionally at /collab/crdt.
Auth via short-lived opaque ticket in query string (?ticket=<id>).

PM-09A.2 fix:
  Validation moved to _WSAuthASGIApp wrapper — ticket is verified BEFORE
  pycrdt-websocket sees the connection. If invalid/expired, a proper
  WebSocket close frame (1008) is sent so the client never sees HTTP 500.
"""

import logging
import os
from typing import Any

from starlette.websockets import WebSocket

from app.shared.collab_debug import CRDT_DEBUG_MARKER
from pycrdt.websocket import ASGIServer, WebsocketServer

# Module-level pid for cross-process correlation
_crdt_pid = os.getpid()

# PM-08A: Verbose diagnostics off by default for clean logs.
# Set to True locally to trace ASGI scope / path parsing.
_CRDT_DIAGNOSTICS = False

from app.infrastructure.ticket_store import get_ticket_store
from app.use_cases.validate_collaboration_ticket import (
    TicketInvalid,
    validate_collaboration_ticket,
)


# ── WebSocket auth ASGI wrapper (PM-09A.2) ─────────────────────────────────
# Wraps ASGIServer to intercept WebSocket connections BEFORE pycrdt-websocket.
# Validates ticket in the wrapper — if invalid/expired/missing, sends a proper
# WebSocket close frame (1008) so the client never sees HTTP 500.
class _WSAuthASGIApp:
    """ASGI app that pre-validates tickets, then delegates to the real app."""

    def __init__(self, wrapped, manager, ticket_store):
        self._wrapped = wrapped
        self._manager = manager
        self._ticket_store = ticket_store

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "websocket":
            await self._wrapped(scope, receive, send)
            return

        # ── Extract ticket from query string (safe: no logging of ticket value) ──
        query_string = scope.get("query_string", b"").decode()
        params = {}
        if query_string:
            for part in query_string.split("&"):
                if "=" in part:
                    k, v = part.split("=", 1)
                    params[k] = v

        ticket_id = params.get("ticket", "")
        raw_path = scope.get("path", "")
        path_for_log = raw_path.split("?")[0]  # strip query for safe logging

        print(
            f"[crdt] ATTEMPT marker={CRDT_DEBUG_MARKER} pid={_crdt_pid} "
            f"path={path_for_log!r} has_ticket={str(bool(ticket_id))} "
            f"store_id={id(self._ticket_store)}",
            flush=True,
        )

        ws_pair = extract_workspace_document_from_ws_path(raw_path)

        if ws_pair is None:
            print(
                f"[crdt] DENIED reason=invalid_path marker={CRDT_DEBUG_MARKER} "
                f"pid={_crdt_pid} path={path_for_log!r}",
                flush=True,
            )
            ws = WebSocket(scope, receive, send)
            await ws.accept()
            await ws.close(code=1008, reason="invalid_path")
            return

        workspace_id, document_id = ws_pair
        room_key = f"{workspace_id}/{document_id}"

        # ── Validate ticket ────────────────────────────────────────────────────
        denial_reason = None
        try:
            if not ticket_id:
                denial_reason = "missing_ticket"
            else:
                await validate_collaboration_ticket(
                    ticket_id=ticket_id,
                    workspace_id=workspace_id,
                    document_id=document_id,
                    ticket_store=self._ticket_store,
                )
        except TicketInvalid as e:
            reason = getattr(e, "args", ["unknown"])[0] if e.args else "unknown"
            if "required" in reason or "missing" in reason:
                denial_reason = "missing_ticket"
            elif "expired" in reason:
                denial_reason = "ticket_expired"
            elif "does not match" in reason or "mismatch" in reason:
                denial_reason = "ticket_mismatch"
            elif "invalid" in reason:
                denial_reason = "ticket_invalid"
            else:
                denial_reason = "ticket_rejected"

        if denial_reason:
            print(
                f"[crdt] DENIED reason={denial_reason} marker={CRDT_DEBUG_MARKER} "
                f"pid={_crdt_pid} ws_id={workspace_id!r} doc_id={document_id!r} "
                f"has_ticket={str(bool(ticket_id))}",
                flush=True,
            )
            ws = WebSocket(scope, receive, send)
            await ws.accept()
            await ws.close(code=1008, reason=denial_reason)
            return

        # Valid — delegate to pycrdt-websocket
        print(
            f"[crdt] ALLOWED room_key={room_key!r} "
            f"marker={CRDT_DEBUG_MARKER} pid={_crdt_pid} "
            f"store_id={id(self._ticket_store)}",
            flush=True,
        )
        await self._wrapped(scope, receive, send)


# Global room manager instance (singleton per service)
_room_manager = None

# Diagnostic logger — writes to stdout so it appears in `docker compose logs`
# Use a name under uvicorn so it is captured by the Docker log driver
_logger = logging.getLogger("uvicorn.error")


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
    ticket_store = get_ticket_store()

    async def on_connect(msg: dict, scope: dict) -> bool:
        """Called by pycrdt-websocket after wrapper validation passes.

        At this point the ticket is already valid (wrapper validated it).
        We only do room setup here — no ticket validation needed.
        """
        raw_path = scope.get("path", "")
        ws_pair = extract_workspace_document_from_ws_path(raw_path)
        if ws_pair is None:
            return True  # defensive: should not happen after wrapper check

        workspace_id, document_id = ws_pair
        room_key = f"{workspace_id}/{document_id}"

        channel_id = id(msg)
        manager.track_channel(channel_id, room_key)
        await manager._ensure_room_for_path(room_key, workspace_id, document_id)

        return False  # accept

    asgi_server = ASGIServer(ws_server, on_connect=on_connect, on_disconnect=on_disconnect)
    # PM-09A.2: validate ticket in ASGI wrapper BEFORE pycrdt-websocket sees the connection
    wrapped = _WSAuthASGIApp(asgi_server, manager, ticket_store)
    return wrapped, manager


def create_crdt_subapp():
    """Create the CRDT sub-application for mounting in main FastAPI app."""
    app, _ = create_crdt_app()
    return app
