from abc import ABC, abstractmethod
from typing import Optional

from app.domain.collab_ticket import CollabTicket


class TicketStore(ABC):
    """Port for issuing and validating collaboration tickets."""

    @abstractmethod
    def issue(self, ticket_id: str, ticket: CollabTicket) -> None:
        """Store a ticket (called after issuing)."""
        ...

    @abstractmethod
    def get(self, ticket_id: str) -> Optional[CollabTicket]:
        """Retrieve a ticket by ID, or None if not found/expired."""
        ...

    @abstractmethod
    def consume(self, ticket_id: str) -> Optional[CollabTicket]:
        """Retrieve and delete a ticket (one-time use)."""
        ...

    @abstractmethod
    def cleanup_expired(self) -> int:
        """Remove all expired tickets. Returns count of removed."""
        ...