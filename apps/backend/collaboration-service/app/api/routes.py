import asyncio
import json

from fastapi import APIRouter, Header, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.adapters.in_memory_ticket_store import InMemoryTicketStore
from app.adapters.workspace_client import WorkspacePermissionsClient
from app.config.settings import Settings
from app.domain.errors import PermissionDenied, UpstreamUnavailable
from app.use_cases.authenticate_collaboration import authenticate_collaboration
from app.use_cases.issue_collaboration_ticket import (
    issue_collaboration_ticket,
)


router = APIRouter(prefix="/collab")

# Close codes (exported for tests)
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


@router.websocket("/{workspace_id}/{document_id}")
async def ws_collab(
    websocket: WebSocket,
    workspace_id: str,
    document_id: str,
):
    await websocket.accept()

    settings = get_settings()

    try:
        raw = await asyncio.wait_for(
            websocket.receive_text(),
            timeout=settings.COLLAB_AUTH_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        await websocket.close(code=CLOSE_AUTH_TIMEOUT)
        return

    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        await websocket.close(code=CLOSE_INVALID_MESSAGE)
        return

    if not isinstance(msg, dict) or msg.get("type") != "auth":
        await websocket.close(code=CLOSE_INVALID_MESSAGE)
        return

    token = msg.get("token", "")
    if not token or not isinstance(token, str):
        await websocket.close(code=CLOSE_PERMISSION_DENIED)
        return

    permissions = get_workspace_permissions()

    try:
        perms = await authenticate_collaboration(
            workspace_id=workspace_id,
            token=token,
            workspace_permissions=permissions,
        )
    except PermissionDenied:
        await websocket.close(code=CLOSE_PERMISSION_DENIED)
        return
    except UpstreamUnavailable:
        await websocket.close(code=CLOSE_UPSTREAM_ERROR)
        return

    await websocket.send_json({
        "type": "auth_ok",
        "workspace_id": perms["workspace_id"],
        "document_id": document_id,
        "role": perms["role"],
    })

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
    settings = Settings()
    ticket_store = get_ticket_store()

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
        return TicketResponse(**result)
    except PermissionDenied as e:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except UpstreamUnavailable:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Workspace service unavailable",
        )
    except Exception as e:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))