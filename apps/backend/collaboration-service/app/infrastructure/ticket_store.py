"""Neutral ticket store singleton for collaboration-service.

Moved from app.api.routes to break the crdt_routes -> routes circular dependency.
crdt_routes.py and routes.py both need get_ticket_store().
Keeping it at module level here avoids the fragile import cycle.
"""

import os

from app.adapters.in_memory_ticket_store import InMemoryTicketStore

_ticket_store: InMemoryTicketStore | None = None
_ticket_pid = os.getpid()


def get_ticket_store() -> InMemoryTicketStore:
    global _ticket_store
    if _ticket_store is None:
        _ticket_store = InMemoryTicketStore()
    return _ticket_store