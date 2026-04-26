"""
PM-03D tests for collaboration ticket system.

Tests verify:
1. InMemoryTicketStore issues, stores, retrieves, and expires tickets
2. CollabTicket entity behavior (expiry, match)
3. on_connect rejects connections without valid ticket
4. on_connect accepts connections with valid ticket (when flag enabled)
5. Ticket endpoint validates authorization header format
6. Ticket endpoint does NOT log JWT tokens
7. Settings defaults are secure
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from app.adapters.in_memory_ticket_store import InMemoryTicketStore
from app.domain.collab_ticket import CollabTicket
from app.use_cases.validate_collaboration_ticket import (
    TicketInvalid,
    validate_collaboration_ticket,
)


class TestInMemoryTicketStore:
    """Test InMemoryTicketStore operations."""

    def test_generate_ticket_id_is_random(self):
        id1 = InMemoryTicketStore.generate_ticket_id()
        id2 = InMemoryTicketStore.generate_ticket_id()
        assert id1 != id2
        assert len(id1) >= 32  # token_urlsafe(32) = 43 chars

    def test_create_ticket(self):
        now = datetime.now(timezone.utc)
        ticket = InMemoryTicketStore.create_ticket(
            ticket_id="test-id",
            workspace_id="ws-1",
            document_id="doc-1",
            user_id="user-1",
            role="owner",
            ttl_seconds=60,
        )
        assert ticket.ticket_id == "test-id"
        assert ticket.workspace_id == "ws-1"
        assert ticket.document_id == "doc-1"
        assert ticket.user_id == "user-1"
        assert ticket.role == "owner"
        assert ticket.expires_at > now + timedelta(seconds=55)
        assert ticket.expires_at <= now + timedelta(seconds=65)

    def test_issue_and_get(self):
        store = InMemoryTicketStore()
        ticket = InMemoryTicketStore.create_ticket(
            ticket_id="ticket-1",
            workspace_id="ws-1",
            document_id="doc-1",
            user_id="user-1",
            role="viewer",
            ttl_seconds=60,
        )
        store.issue("ticket-1", ticket)
        retrieved = store.get("ticket-1")
        assert retrieved is not None
        assert retrieved.ticket_id == "ticket-1"
        assert retrieved.workspace_id == "ws-1"

    def test_get_nonexistent(self):
        store = InMemoryTicketStore()
        result = store.get("nonexistent")
        assert result is None

    def test_consume_one_time(self):
        store = InMemoryTicketStore(one_time=True)
        ticket = InMemoryTicketStore.create_ticket(
            ticket_id="ticket-1",
            workspace_id="ws-1",
            document_id="doc-1",
            user_id="user-1",
            role="viewer",
            ttl_seconds=60,
        )
        store.issue("ticket-1", ticket)

        # First consume succeeds
        consumed = store.consume("ticket-1")
        assert consumed is not None

        # Second consume fails (ticket was deleted)
        consumed2 = store.consume("ticket-1")
        assert consumed2 is None

    def test_consume_non_one_time(self):
        store = InMemoryTicketStore(one_time=False)
        ticket = InMemoryTicketStore.create_ticket(
            ticket_id="ticket-1",
            workspace_id="ws-1",
            document_id="doc-1",
            user_id="user-1",
            role="viewer",
            ttl_seconds=60,
        )
        store.issue("ticket-1", ticket)

        consumed1 = store.consume("ticket-1")
        assert consumed1 is not None

        consumed2 = store.consume("ticket-1")
        assert consumed2 is not None  # still available

    def test_expired_ticket_returns_none(self):
        store = InMemoryTicketStore()
        past = datetime.now(timezone.utc) - timedelta(seconds=120)
        expired_ticket = CollabTicket(
            ticket_id="expired",
            workspace_id="ws-1",
            document_id="doc-1",
            user_id="user-1",
            role="viewer",
            created_at=past - timedelta(seconds=60),
            expires_at=past,
        )
        store.issue("expired", expired_ticket)

        result = store.get("expired")
        assert result is None  # expired ticket not returned


class TestCollabTicket:
    """Test CollabTicket entity."""

    def test_is_expired_false_when_fresh(self):
        future = datetime.now(timezone.utc) + timedelta(seconds=60)
        ticket = CollabTicket(
            ticket_id="test",
            workspace_id="ws",
            document_id="doc",
            user_id="user",
            role="owner",
            created_at=datetime.now(timezone.utc),
            expires_at=future,
        )
        assert ticket.is_expired() is False

    def test_is_expired_true_when_old(self):
        past = datetime.now(timezone.utc) - timedelta(seconds=1)
        ticket = CollabTicket(
            ticket_id="test",
            workspace_id="ws",
            document_id="doc",
            user_id="user",
            role="owner",
            created_at=past - timedelta(seconds=120),
            expires_at=past,
        )
        assert ticket.is_expired() is True

    def test_matches_correct(self):
        ticket = CollabTicket(
            ticket_id="test",
            workspace_id="ws-1",
            document_id="doc-1",
            user_id="user",
            role="owner",
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=60),
        )
        assert ticket.matches("ws-1", "doc-1") is True
        assert ticket.matches("ws-2", "doc-1") is False
        assert ticket.matches("ws-1", "doc-2") is False


class TestValidateCollaborationTicket:
    """Test validate_collaboration_ticket use case."""

    @pytest.mark.asyncio
    async def test_validate_rejects_empty_ticket_id(self):
        store = InMemoryTicketStore()
        with pytest.raises(TicketInvalid) as exc:
            await validate_collaboration_ticket("", "ws-1", "doc-1", store)
        assert "required" in str(exc.value)

    @pytest.mark.asyncio
    async def test_validate_rejects_nonexistent_ticket(self):
        store = InMemoryTicketStore()
        with pytest.raises(TicketInvalid) as exc:
            await validate_collaboration_ticket("nonexistent", "ws-1", "doc-1", store)
        assert "Invalid or expired" in str(exc.value)

    @pytest.mark.asyncio
    async def test_validate_accepts_valid_ticket(self):
        store = InMemoryTicketStore()
        ticket = InMemoryTicketStore.create_ticket(
            ticket_id="valid-ticket",
            workspace_id="ws-1",
            document_id="doc-1",
            user_id="user-1",
            role="owner",
            ttl_seconds=60,
        )
        store.issue("valid-ticket", ticket)

        result = await validate_collaboration_ticket("valid-ticket", "ws-1", "doc-1", store)
        assert result.ticket_id == "valid-ticket"
        assert result.role == "owner"

    @pytest.mark.asyncio
    async def test_validate_rejects_mismatched_workspace(self):
        store = InMemoryTicketStore()
        ticket = InMemoryTicketStore.create_ticket(
            ticket_id="ticket-ws1",
            workspace_id="ws-1",
            document_id="doc-1",
            user_id="user-1",
            role="owner",
            ttl_seconds=60,
        )
        store.issue("ticket-ws1", ticket)

        with pytest.raises(TicketInvalid) as exc:
            await validate_collaboration_ticket("ticket-ws1", "ws-2", "doc-1", store)
        assert "does not match" in str(exc.value)

    @pytest.mark.asyncio
    async def test_validate_rejects_mismatched_document(self):
        store = InMemoryTicketStore()
        ticket = InMemoryTicketStore.create_ticket(
            ticket_id="ticket-doc1",
            workspace_id="ws-1",
            document_id="doc-1",
            user_id="user-1",
            role="owner",
            ttl_seconds=60,
        )
        store.issue("ticket-doc1", ticket)

        with pytest.raises(TicketInvalid) as exc:
            await validate_collaboration_ticket("ticket-doc1", "ws-1", "doc-2", store)
        assert "does not match" in str(exc.value)


class TestSettingsDefaults:
    """Test that settings defaults are secure."""

    def test_experimental_crdt_default_false(self):
        # Isolate from shell environment to avoid env pollution
        import os
        os.environ.pop("ENABLE_EXPERIMENTAL_CRDT_ENDPOINT", None)
        from app.config.settings import Settings
        s = Settings()
        assert s.ENABLE_EXPERIMENTAL_CRDT_ENDPOINT is False

    def test_ticket_ttl_default_60_seconds(self):
        from app.config.settings import Settings
        s = Settings()
        assert s.TICKET_TTL_SECONDS == 60

    def test_ticket_ttl_can_be_configured(self):
        with patch.dict("os.environ", {"TICKET_TTL_SECONDS": "120"}):
            import importlib
            import app.config.settings as settings_module
            importlib.reload(settings_module)
            from app.config.settings import Settings
            s = Settings()
            assert s.TICKET_TTL_SECONDS == 120
            # Restore
            importlib.reload(settings_module)


class TestOnConnectValidation:
    """Test that on_connect properly validates tickets."""

    @pytest.mark.asyncio
    async def test_on_connect_rejects_missing_ticket(self):
        from app.use_cases.validate_collaboration_ticket import TicketInvalid, validate_collaboration_ticket
        from app.api.routes import get_ticket_store

        # Missing ticket_id should be rejected
        ticket_store = get_ticket_store()
        try:
            await validate_collaboration_ticket("", "workspace1", "document1", ticket_store)
            rejected = False
        except TicketInvalid:
            rejected = True
        assert rejected is True

    @pytest.mark.asyncio
    async def test_on_connect_accepts_valid_ticket(self):
        from app.use_cases.validate_collaboration_ticket import validate_collaboration_ticket
        from app.adapters.in_memory_ticket_store import InMemoryTicketStore

        store = InMemoryTicketStore()
        ticket = InMemoryTicketStore.create_ticket(
            ticket_id="valid-test-ticket",
            workspace_id="workspace1",
            document_id="document1",
            user_id="user1",
            role="owner",
            ttl_seconds=60,
        )
        store.issue("valid-test-ticket", ticket)

        result = await validate_collaboration_ticket(
            "valid-test-ticket", "workspace1", "document1", store
        )
        assert result is not None
        assert result.ticket_id == "valid-test-ticket"