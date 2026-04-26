"""
Issue a collaboration ticket for a workspace/document.

Calls Workspace Service to validate that the user (identified by JWT in Authorization header)
has permission to collaborate on the document, then issues a short-lived opaque ticket.
"""

import httpx
from app.adapters.in_memory_ticket_store import InMemoryTicketStore
from app.ports.ticket_store import TicketStore
from app.domain.collab_ticket import CollabTicket


async def issue_collaboration_ticket(
    workspace_id: str,
    document_id: str,
    authorization_header: str,
    workspace_service_url: str,
    ticket_store: TicketStore,
    permission_timeout: float = 3.0,
    ticket_ttl: int = 60,
) -> dict:
    """Issue a collaboration ticket.

    Steps:
    1. Call Workspace Service permissions endpoint with JWT
    2. If authorized, generate opaque ticket
    3. Store ticket in ticket_store
    4. Return ticket with ws_path

    Raises:
        PermissionDenied: if Workspace Service returns 401/403/404
        UpstreamUnavailable: if Workspace Service is down
    """
    if not authorization_header.startswith("Bearer "):
        raise PermissionDenied("Invalid authorization header format")

    token = authorization_header[7:]  # strip "Bearer "

    async with httpx.AsyncClient(timeout=permission_timeout) as client:
        headers = {"Authorization": f"Bearer {token}"}
        url = f"{workspace_service_url}/workspaces/{workspace_id}/permissions"
        try:
            response = await client.get(url, headers=headers)
        except (httpx.TimeoutException, httpx.ConnectError) as e:
            raise UpstreamUnavailable("Workspace service unavailable")

    if response.status_code == 401:
        raise PermissionDenied("Token invalid or expired")
    if response.status_code == 403:
        raise PermissionDenied("Access denied")
    if response.status_code == 404:
        raise PermissionDenied("Workspace or document not found")
    if response.status_code >= 500:
        raise UpstreamUnavailable("Workspace service error")

    perms = response.json()
    user_id = perms.get("user_id", "unknown")
    role = perms.get("role", "viewer")

    ticket_id = InMemoryTicketStore.generate_ticket_id()
    ticket = InMemoryTicketStore.create_ticket(
        ticket_id=ticket_id,
        workspace_id=workspace_id,
        document_id=document_id,
        user_id=user_id,
        role=role,
        ttl_seconds=ticket_ttl,
    )
    ticket_store.issue(ticket_id, ticket)

    return {
        "ticket": ticket_id,
        "expires_in": ticket_ttl,
        "ws_path": f"/collab/crdt/{workspace_id}/{document_id}?ticket={ticket_id}",
        "role": role,
    }


class PermissionDenied(Exception):
    """User does not have access to the workspace."""
    pass


class UpstreamUnavailable(Exception):
    """Workspace service unavailable or timed out."""
    pass