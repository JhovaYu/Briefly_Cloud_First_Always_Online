import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.domain.collab_ticket import CollabTicket
from app.ports.ticket_store import TicketStore


class InMemoryTicketStore(TicketStore):
    """In-memory ticket store with TTL and optional one-time use.

    For production, replace with Redis-backed implementation.
    """

    def __init__(self, ttl_seconds: int = 60, one_time: bool = False):
        self._store: dict[str, CollabTicket] = {}
        self._ttl_seconds = ttl_seconds
        self._one_time = one_time

    def issue(self, ticket_id: str, ticket: CollabTicket) -> None:
        self._store[ticket_id] = ticket

    def get(self, ticket_id: str) -> Optional[CollabTicket]:
        ticket = self._store.get(ticket_id)
        if ticket is None:
            return None
        if ticket.is_expired():
            self._store.pop(ticket_id, None)
            return None
        return ticket

    def consume(self, ticket_id: str) -> Optional[CollabTicket]:
        ticket = self.get(ticket_id)
        if ticket is not None and self._one_time:
            self._store.pop(ticket_id, None)
        return ticket

    def cleanup_expired(self) -> int:
        now = datetime.now(timezone.utc)
        expired = [
            tid for tid, t in self._store.items()
            if now > t.expires_at
        ]
        for tid in expired:
            self._store.pop(tid, None)
        return len(expired)

    @staticmethod
    def generate_ticket_id() -> str:
        """Generate a cryptographically random opaque ticket ID."""
        return secrets.token_urlsafe(32)

    @staticmethod
    def create_ticket(
        ticket_id: str,
        workspace_id: str,
        document_id: str,
        user_id: str,
        role: str,
        ttl_seconds: int = 60,
    ) -> CollabTicket:
        now = datetime.now(timezone.utc)
        return CollabTicket(
            ticket_id=ticket_id,
            workspace_id=workspace_id,
            document_id=document_id,
            user_id=user_id,
            role=role,
            created_at=now,
            expires_at=now + timedelta(seconds=ttl_seconds),
        )