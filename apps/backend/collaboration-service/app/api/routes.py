import json
import logging
import os
import traceback

from fastapi import APIRouter, Header, HTTPException, status, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.adapters.in_memory_ticket_store import InMemoryTicketStore
from app.adapters.workspace_client import WorkspacePermissionsClient
from app.config.settings import Settings
from app.domain.errors import PermissionDenied, UpstreamUnavailable
from app.use_cases.authenticate_collaboration import authenticate_collaboration
from app.use_cases.issue_collaboration_ticket import (
    issue_collaboration_ticket,
)
from app.shared.collab_debug import CRDT_DEBUG_MARKER


# Do not import crdt_routes here; it imports get_ticket_store from this module.
_ticket_debug_marker = "pm08a-crdt-debug-v1"
_ticket_pid = os.getpid()


# Diagnostic logger for Docker — writes to stdout so `docker compose logs` captures it
# Use "uvicorn.error" to go to stderr, captured by Docker log driver
_logger = logging.getLogger("uvicorn.error")


def _log(prefix: str, msg: str) -> None:
    """Print a safe log line to stdout for Docker. No secrets."""
    print(f"[routes] {prefix} {msg}", flush=True)


router = APIRouter(prefix="/collab")

# Close codes (kept for potential future use)
CLOSE_AUTH_TIMEOUT = 4003
CLOSE_INVALID_MESSAGE = 4400
CLOSE_PERMISSION_DENIED = 4003
CLOSE_UPSTREAM_ERROR = 1011

_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def get_workspace_permissions() -> WorkspacePermissionsClient:
    s = get_settings()
    return WorkspacePermissionsClient(
        base_url=s.WORKSPACE_SERVICE_URL,
        timeout=s.WORKSPACE_PERMISSION_TIMEOUT_SECONDS,
    )


# Global ticket store (singleton per service, in-memory)
_ticket_store: InMemoryTicketStore | None = None


def get_ticket_store() -> InMemoryTicketStore:
    global _ticket_store
    if _ticket_store is None:
        _ticket_store = InMemoryTicketStore()
    return _ticket_store


@router.get("/health")
def collab_health():
    return {"status": "ok", "service": "collaboration-service"}


@router.get("/healthz")
def collab_healthz():
    return {"status": "ok", "service": "collaboration-service"}


@router.get("/debug/version")
async def debug_version():
    """Safe diagnostic endpoint — no secrets, no env vars, no tokens."""
    return {
        "service": "collaboration-service",
        "marker": "pm08a-crdt-debug-v1",
        "pid": os.getpid(),
        "ticket_store_type": "in_memory",
        "ticket_store_id": id(get_ticket_store()),
        "crdt_debug_enabled": True,
        "has_on_connect_marker": True,
    }


@router.websocket("/echo")
async def ws_echo(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_json({"type": "ready", "service": "collaboration-service"})
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                await websocket.send_json({"type": "echo", "payload": data})
    except WebSocketDisconnect:
        pass




class TicketResponse(BaseModel):
    ticket: str
    expires_in: int
    ws_path: str
    role: str


@router.post("/{workspace_id}/{document_id}/ticket", response_model=TicketResponse)
async def issue_ticket(
    workspace_id: str,
    document_id: str,
    authorization: str = Header(..., alias="Authorization"),
):
    """Issue a collaboration ticket for a workspace/document.

    Authorization: Bearer <jwt>

    Returns:
    {
      "ticket": "<opaque_id>",
      "expires_in": 60,
      "ws_path": "/collab/crdt/{workspace_id}/{document_id}?ticket=<opaque_id>",
      "role": "owner"
    }

    Errors:
    - 401 if JWT invalid/expired
    - 403 if no permission
    - 500 if workspace service down
    """
    _log("INFO", f"ticket_request ws_id={workspace_id!r} doc_id={document_id!r}")

    try:
        settings = Settings()
        ticket_store = get_ticket_store()
    except Exception as e:
        _log("ERROR", f"ticket_init_failed: {type(e).__name__}: {e}")
        raise

    try:
        result = await issue_collaboration_ticket(
            workspace_id=workspace_id,
            document_id=document_id,
            authorization_header=authorization,
            workspace_service_url=settings.WORKSPACE_SERVICE_URL,
            ticket_store=ticket_store,
            permission_timeout=settings.WORKSPACE_PERMISSION_TIMEOUT_SECONDS,
            ticket_ttl=settings.TICKET_TTL_SECONDS,
        )
        _log("INFO", f"ticket_issued ws_id={workspace_id!r} doc_id={document_id!r} role={result.get('role')} pid={_ticket_pid} store_id={id(get_ticket_store())} marker={_ticket_debug_marker}")
        return TicketResponse(**result)
    except PermissionDenied as e:
        msg = str(e)
        if "invalid" in msg.lower() or "expired" in msg.lower():
            _log("WARNING", f"ticket_permission_denied reason=token_invalid_or_expired ws_id={workspace_id!r} doc_id={document_id!r}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=msg)
        _log("WARNING", f"ticket_permission_denied reason=access_denied ws_id={workspace_id!r} doc_id={document_id!r}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)
    except UpstreamUnavailable:
        _log("WARNING", f"ticket_upstream_unavailable ws_id={workspace_id!r} doc_id={document_id!r}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Workspace service unavailable",
        )
    except Exception as e:
        _log("ERROR", f"ticket_internal_error ws_id={workspace_id!r} doc_id={document_id!r} exc={type(e).__name__}")
        print(f"[routes] TRACE: {traceback.format_exc()}", flush=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")