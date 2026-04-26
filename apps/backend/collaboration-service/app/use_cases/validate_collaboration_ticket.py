"""
Validate a collaboration ticket for WebSocket connection.
"""

from app.domain.collab_ticket import CollabTicket
from app.ports.ticket_store import TicketStore


async def validate_collaboration_ticket(
    ticket_id: str,
    workspace_id: str,
    document_id: str,
    ticket_store: TicketStore,
) -> CollabTicket:
    """Validate a collaboration ticket for a WebSocket connection.

    Returns the CollabTicket if valid.
    Raises TicketInvalid if missing, expired, or mismatched workspace/document.
    """
    if not ticket_id:
        raise TicketInvalid("Ticket is required")

    ticket = ticket_store.get(ticket_id)

    if ticket is None:
        raise TicketInvalid("Invalid or expired ticket")

    if ticket.is_expired():
        raise TicketInvalid("Ticket has expired")

    if not ticket.matches(workspace_id, document_id):
        raise TicketInvalid("Ticket does not match workspace/document")

    return ticket


class TicketInvalid(Exception):
    """Ticket is invalid, expired, or does not match the requested room."""
    pass