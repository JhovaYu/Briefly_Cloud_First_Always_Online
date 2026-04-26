from dataclasses import dataclass
from datetime import datetime, timezone, timedelta


@dataclass(frozen=True)
class CollabTicket:
    """An opaque, short-lived collaboration ticket.

    Ticket is associated with a specific workspace, document, user, and role.
    Is not a JWT — is an opaque random string with TTL.
    """
    ticket_id: str
    workspace_id: str
    document_id: str
    user_id: str
    role: str
    created_at: datetime
    expires_at: datetime

    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) > self.expires_at

    def matches(self, workspace_id: str, document_id: str) -> bool:
        return self.workspace_id == workspace_id and self.document_id == document_id