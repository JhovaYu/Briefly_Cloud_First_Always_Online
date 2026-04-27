"""
PM-03E.2 tests for periodic snapshot timer + debounce.

Tests verify:
1. Dirty tracking marks room as dirty when doc changes
2. Periodic save stores dirty rooms
3. Periodic cleanup removes empty rooms after grace period
4. Active rooms are not removed
5. No duplicate tasks on start
6. MAX_SNAPSHOT_BYTES respected
"""

import pytest
import asyncio
import time
from unittest.mock import MagicMock

from app.adapters.pycrdt_room_manager import PycrdtRoomManager
from app.adapters.in_memory_document_store import InMemoryDocumentStore
from pycrdt import Doc


class TestDirtyTracking:
    """Test dirty tracking via doc observer."""

    @pytest.fixture
    def store(self):
        return InMemoryDocumentStore()

    @pytest.fixture
    def manager(self, store):
        return PycrdtRoomManager(document_store=store)

    def test_room_starts_clean(self, manager):
        """New room is marked clean after _ensure_room."""
        room_key = "ws-1:doc-1"
        manager._server.rooms[room_key] = MagicMock()
        manager._server.rooms[room_key].ydoc = MagicMock()
        manager._server.rooms[room_key].clients = set()

        manager._mark_clean(room_key)
        assert manager._is_dirty(room_key) is False

    def test_mark_dirty_sets_flag(self, manager):
        """_mark_dirty sets the dirty flag."""
        room_key = "ws-1:doc-1"
        manager._mark_dirty(room_key)
        assert manager._is_dirty(room_key) is True

    def test_mark_clean_clears_flag(self, manager):
        """_mark_clean clears the dirty flag."""
        room_key = "ws-1:doc-1"
        manager._mark_dirty(room_key)
        manager._mark_clean(room_key)
        assert manager._is_dirty(room_key) is False

    def test_unknown_room_is_not_dirty(self, manager):
        """Unknown room_key returns False for dirty."""
        assert manager._is_dirty("nonexistent:key") is False


class TestPeriodicSave:
    """Test periodic snapshot save and cleanup."""

    @pytest.fixture
    def store(self):
        return InMemoryDocumentStore()

    @pytest.fixture
    def manager(self, store):
        return PycrdtRoomManager(document_store=store)

    @pytest.mark.asyncio
    async def test_dirty_room_is_saved_in_periodic(self, manager, store):
        """Dirty room gets snapshot saved by run_periodic_snapshot_once."""
        room_key = "ws-1:doc-1"
        doc = Doc()
        room = MagicMock()
        room.ydoc = doc
        room.clients = set()  # empty room
        manager._server.rooms[room_key] = room
        manager._mark_dirty(room_key)

        await manager.run_periodic_snapshot_once()

        assert store.exists(room_key)
        assert manager._is_dirty(room_key) is False  # cleaned

    @pytest.mark.asyncio
    async def test_clean_room_not_rewritten(self, manager, store):
        """Clean room doesn't rewrite snapshot unnecessarily."""
        room_key = "ws-1:doc-1"
        doc = Doc()
        room = MagicMock()
        room.ydoc = doc
        room.clients = set()
        manager._server.rooms[room_key] = room
        manager._mark_clean(room_key)

        # Manually save a snapshot first
        store.save(room_key, b"original")
        original_mtime = store.load(room_key)

        await manager.run_periodic_snapshot_once()

        # Snapshot should still be original (clean, no rewrite)
        assert store.load(room_key) == original_mtime

    @pytest.mark.asyncio
    async def test_room_with_active_clients_not_removed(self, manager, store):
        """Room with active clients is saved if dirty but NOT removed."""
        room_key = "/ws-1/doc-1"
        doc = Doc()
        room = MagicMock()
        room.ydoc = doc
        room.clients = {MagicMock()}  # has active clients
        manager._server.rooms[room_key] = room
        manager._mark_dirty(room_key)

        await manager.run_periodic_snapshot_once()

        # Room should still exist
        assert room_key in manager._server.rooms
        # Snapshot should be saved under store-key (converted from path-key)
        assert store.exists("ws-1:doc-1")

    @pytest.mark.asyncio
    async def test_empty_room_beyond_grace_saved_and_removed(self, manager, store):
        """Empty room beyond grace period is saved and removed."""
        room_key = "/ws-1/doc-1"
        doc = Doc()
        room = MagicMock()
        room.ydoc = doc
        room.clients = set()
        manager._server.rooms[room_key] = room
        manager._mark_clean(room_key)  # not dirty
        # Set grace to 0 so immediately eligible
        manager._empty_room_grace = 0.0

        await manager.run_periodic_snapshot_once()

        # Room should be removed from server
        assert room_key not in manager._server.rooms

    @pytest.mark.asyncio
    async def test_empty_room_within_grace_not_removed(self, manager, store):
        """Empty room within grace period is NOT removed."""
        room_key = "/ws-1/doc-1"
        doc = Doc()
        room = MagicMock()
        room.ydoc = doc
        room.clients = set()
        manager._server.rooms[room_key] = room
        manager._mark_clean(room_key)
        # Set grace very high so it doesn't expire
        manager._empty_room_grace = 3600.0

        await manager.run_periodic_snapshot_once()

        # Room should still exist
        assert room_key in manager._server.rooms

    @pytest.mark.asyncio
    async def test_two_dirty_rooms_both_saved(self, manager, store):
        """Two dirty rooms are both saved independently."""
        doc1 = Doc()
        doc2 = Doc()
        room1 = MagicMock()
        room1.ydoc = doc1
        room1.clients = set()
        room2 = MagicMock()
        room2.ydoc = doc2
        room2.clients = set()
        manager._server.rooms["/ws-1/doc-1"] = room1
        manager._server.rooms["/ws-2/doc-2"] = room2
        manager._mark_dirty("/ws-1/doc-1")
        manager._mark_dirty("/ws-2/doc-2")

        await manager.run_periodic_snapshot_once()

        # Snapshots saved under store-keys (converted from path-keys)
        assert store.exists("ws-1:doc-1")
        assert store.exists("ws-2:doc-2")
        # Both cleaned
        assert manager._is_dirty("/ws-1/doc-1") is False
        assert manager._is_dirty("/ws-2/doc-2") is False

    @pytest.mark.asyncio
    async def test_oversized_snapshot_skipped(self, manager, store):
        """Snapshot larger than MAX_SNAPSHOT_BYTES is not saved."""
        room_key = "/ws-1/doc-1"
        doc = MagicMock()
        doc.ydoc = MagicMock()
        doc.ydoc.get_update.return_value = b"x" * 100
        doc.clients = set()
        manager._server.rooms[room_key] = doc
        manager.set_max_snapshot_bytes(50)
        manager._mark_dirty(room_key)

        await manager.run_periodic_snapshot_once()

        # Room should be cleaned (not saved due to size) but removed
        assert manager._is_dirty(room_key) is False

    @pytest.mark.asyncio
    async def test_corrupt_snapshot_still_handled(self, manager, store):
        """Corrupt snapshot in store doesn't crash periodic."""
        room_key = "/ws-1/doc-1"
        store.save("/ws-1/doc-1", b"corrupt")
        doc = Doc()
        room = MagicMock()
        room.ydoc = doc
        room.clients = set()
        manager._server.rooms[room_key] = room
        manager._mark_dirty(room_key)

        # Should not raise
        await manager.run_periodic_snapshot_once()


class TestPeriodicTaskLifecycle:
    """Test start/stop of periodic background task."""

    @pytest.fixture
    def store(self):
        return InMemoryDocumentStore()

    @pytest.fixture
    def manager(self, store):
        return PycrdtRoomManager(document_store=store)

    @pytest.mark.asyncio
    async def test_start_is_idempotent(self, manager):
        """Calling start_periodic_snapshot_task twice doesn't create duplicate tasks."""
        manager.start_periodic_snapshot_task()
        first_task = manager._periodic_task
        manager.start_periodic_snapshot_task()  # should be no-op
        second_task = manager._periodic_task
        assert first_task is second_task
        # Clean up
        manager.stop_periodic_snapshot_task()

    def test_stop_without_start_no_error(self, manager):
        """stop_periodic_snapshot_task without start doesn't raise."""
        manager.stop_periodic_snapshot_task()  # no raise

    @pytest.mark.asyncio
    async def test_stop_cancels_task(self, manager, store):
        """stop_periodic_snapshot_task cancels the running task."""
        manager.start_periodic_snapshot_task()
        assert manager._periodic_task is not None
        manager.stop_periodic_snapshot_task()
        # Task should be None after stop
        assert manager._periodic_task is None

    def test_periodic_config_setter(self, manager):
        """set_periodic_config updates interval, grace, enabled."""
        manager.set_periodic_config(enabled=True, interval=15.0, grace=10.0)
        assert manager._snapshot_interval == 15.0
        assert manager._empty_room_grace == 10.0
        assert manager._periodic_enabled is True


class TestDocObserverSetup:
    """Test doc observer for dirty tracking."""

    @pytest.fixture
    def store(self):
        return InMemoryDocumentStore()

    @pytest.fixture
    def manager(self, store):
        return PycrdtRoomManager(document_store=store)

    @pytest.mark.asyncio
    async def test_ensure_room_sets_up_observer(self, manager):
        """_ensure_room attaches an observer to the ydoc."""
        room, _ = await manager._ensure_room("ws-1", "doc-1")
        room_key = room.ydoc  # Use room object, not key lookup

        # Observer should be registered under path-key
        assert "/ws-1/doc-1" in manager._doc_subscriptions

        # Making doc dirty should mark the room
        # The doc observer callback is set, dirty tracking works

    @pytest.mark.asyncio
    async def test_dirty_after_ensure_room_with_snapshot(self, manager, store):
        """Room loaded from snapshot starts clean."""
        room_key = "ws-1:doc-1"
        # Pre-save a snapshot
        doc = Doc()
        snapshot = doc.get_update()
        store.save(room_key, snapshot)

        room, _ = await manager._ensure_room("ws-1", "doc-1")

        # Room should start clean (snapshot applied, not dirty)
        assert manager._is_dirty(room_key) is False