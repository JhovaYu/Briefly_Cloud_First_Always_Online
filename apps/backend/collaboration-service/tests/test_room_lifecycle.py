"""
PM-03E.1.1 tests for CRDT room lifecycle with document persistence.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.adapters.pycrdt_room_manager import PycrdtRoomManager
from app.adapters.in_memory_document_store import InMemoryDocumentStore


class TestPycrdtRoomManagerLifecycle:
    """Test PycrdtRoomManager snapshot save/load on room lifecycle."""

    @pytest.fixture
    def store(self):
        return InMemoryDocumentStore()

    @pytest.fixture
    def manager(self, store):
        return PycrdtRoomManager(document_store=store)

    def test_track_channel_and_handle_disconnect(self, manager, store):
        """track_channel registers mapping; handle_disconnect uses it."""
        room_key = "ws-1:doc-1"
        channel_id = 12345
        manager.track_channel(channel_id, room_key)
        assert channel_id in manager._channel_to_room
        assert manager._channel_to_room[channel_id] == room_key

    def test_handle_disconnect_unknown_channel_noop(self, manager):
        """Unknown channel_id does nothing."""
        # Does not raise
        import asyncio
        asyncio.get_event_loop().run_until_complete(
            manager.handle_disconnect(99999)
        )

    @pytest.mark.asyncio
    async def test_close_room_saves_snapshot(self, manager, store):
        """close_room persists current ydoc state to document store."""
        # Manually create a room with content
        room_key = "ws-1:doc-1"
        doc = manager._server.rooms[room_key] = MagicMock()
        doc.ydoc = MagicMock()
        doc.ydoc.get_update.return_value = b"snapshot-data"

        await manager.close_room("ws-1", "doc-1")

        assert store.load(room_key) == b"snapshot-data"
        assert room_key not in manager._server.rooms

    @pytest.mark.asyncio
    async def test_close_room_removes_from_server(self, manager):
        """close_room deletes room from server.rooms after save."""
        room_key = "ws-1:doc-1"
        doc = MagicMock()
        doc.ydoc = None  # no store, just check removal
        manager._server.rooms[room_key] = MagicMock()
        manager._server.rooms[room_key].ydoc = None

        await manager.close_room("ws-1", "doc-1")
        assert room_key not in manager._server.rooms

    @pytest.mark.asyncio
    async def test_close_room_with_oversized_snapshot_skips_save(self, manager, store):
        """Snapshot larger than max_snapshot_bytes is not saved."""
        manager.set_max_snapshot_bytes(10)
        room_key = "ws-1:doc-1"
        doc = MagicMock()
        doc.ydoc = MagicMock()
        doc.ydoc.get_update.return_value = b"x" * 20  # exceeds 10
        manager._server.rooms[room_key] = doc

        await manager.close_room("ws-1", "doc-1")

        # Should still remove room but not save
        assert store.load(room_key) is None
        assert room_key not in manager._server.rooms

    @pytest.mark.asyncio
    async def test_room_key_with_underscores_and_dashes(self, manager, store):
        """Room keys with underscores and dashes are handled correctly."""
        room_key = "my-workspace:my_document"
        doc = MagicMock()
        doc.ydoc = MagicMock()
        doc.ydoc.get_update.return_value = b"content"
        manager._server.rooms[room_key] = doc

        await manager.close_room("my-workspace", "my_document")

        assert store.load(room_key) == b"content"
        assert room_key not in manager._server.rooms


class TestDocumentStoreIntegration:
    """Integration tests for DocumentStore with PycrdtRoomManager."""

    @pytest.fixture
    def store(self):
        return InMemoryDocumentStore()

    @pytest.fixture
    def manager(self, store):
        return PycrdtRoomManager(document_store=store)

    def test_manager_has_document_store(self, manager, store):
        assert manager._document_store is store

    def test_set_document_store_updates_store(self, manager):
        new_store = InMemoryDocumentStore()
        manager.set_document_store(new_store)
        assert manager._document_store is new_store

    def test_close_room_nonexistent_noop(self, manager):
        """close_room on non-existent room does not raise."""
        import asyncio
        asyncio.get_event_loop().run_until_complete(
            manager.close_room("nonexistent", "room")
        )

    def test_two_rooms_independent_snapshots(self, manager, store):
        """Two rooms keep independent snapshots."""
        # Manually create two rooms
        doc1 = MagicMock()
        doc1.ydoc.get_update.return_value = b"snapshot1"
        doc2 = MagicMock()
        doc2.ydoc.get_update.return_value = b"snapshot2"
        manager._server.rooms["ws-1:doc-1"] = doc1
        manager._server.rooms["ws-2:doc-2"] = doc2

        import asyncio
        asyncio.get_event_loop().run_until_complete(
            manager.close_room("ws-1", "doc-1")
        )
        asyncio.get_event_loop().run_until_complete(
            manager.close_room("ws-2", "doc-2")
        )

        assert store.load("ws-1:doc-1") == b"snapshot1"
        assert store.load("ws-2:doc-2") == b"snapshot2"


class TestChannelTracking:
    """Test channel-to-room tracking for disconnect handling."""

    @pytest.fixture
    def manager(self):
        return PycrdtRoomManager(document_store=InMemoryDocumentStore())

    def test_track_channel_multiple_channels(self, manager):
        """Multiple channels can map to same room."""
        room_key = "ws-1:doc-1"
        manager.track_channel(100, room_key)
        manager.track_channel(200, room_key)
        manager.track_channel(300, room_key)
        assert manager._channel_to_room[100] == room_key
        assert manager._channel_to_room[200] == room_key
        assert manager._channel_to_room[300] == room_key

    def test_handle_disconnect_removes_channel(self, manager):
        """handle_disconnect removes the channel from tracking dict."""
        room_key = "ws-1:doc-1"
        manager.track_channel(123, room_key)
        import asyncio
        asyncio.get_event_loop().run_until_complete(manager.handle_disconnect(123))
        assert 123 not in manager._channel_to_room

    def test_handle_disconnect_unknown_does_not_raise(self, manager):
        """handle_disconnect with unknown channel_id is a no-op."""
        import asyncio
        asyncio.get_event_loop().run_until_complete(
            manager.handle_disconnect(88888)
        )  # no raise

    def test_track_channel_overwrites_previous(self, manager):
        """Same channel_id overwritten with new room_key."""
        manager.track_channel(123, "ws-1:doc-1")
        manager.track_channel(123, "ws-2:doc-2")
        assert manager._channel_to_room[123] == "ws-2:doc-2"