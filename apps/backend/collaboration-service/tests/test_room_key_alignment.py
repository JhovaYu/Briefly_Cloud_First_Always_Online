"""
PM-03E.5C tests for room key alignment between PycrdtRoomManager and pycrdt-websocket.

Tests verify:
1. _room_key() returns path-key format "/workspace_id/document_id"
2. _path_to_store_key() converts path-key to store-key "workspace_id:document_id"
3. server.rooms uses path-key; DocumentStore uses store-key
4. No duplicate rooms created between _ensure_room and websocket.get_room
5. Periodic snapshot saves content when room is keyed correctly
"""

import pytest
from unittest.mock import MagicMock

from app.adapters.pycrdt_room_manager import PycrdtRoomManager
from app.adapters.in_memory_document_store import InMemoryDocumentStore
from pycrdt import Doc, Text


class TestRoomKeyAlignment:
    """Test that _room_key returns path-key format used by pycrdt-websocket."""

    @pytest.fixture
    def manager(self):
        return PycrdtRoomManager(document_store=InMemoryDocumentStore())

    def test_room_key_returns_path_format(self, manager):
        """_room_key returns /workspace_id/document_id format."""
        result = manager._room_key("ws-abc", "doc-xyz")
        assert result == "/ws-abc/doc-xyz"

    def test_room_key_simple_ids(self, manager):
        """Simple workspace and document IDs produce correct path."""
        result = manager._room_key("ws1", "doc1")
        assert result == "/ws1/doc1"

    def test_room_key_with_underscores_and_dashes(self, manager):
        """IDs with underscores and dashes are preserved in path."""
        result = manager._room_key("my-workspace", "my_document")
        assert result == "/my-workspace/my_document"


class TestPathToStoreKey:
    """Test conversion from path-key (server.rooms) to store-key (DocumentStore)."""

    @pytest.fixture
    def manager(self):
        return PycrdtRoomManager(document_store=InMemoryDocumentStore())

    def test_path_to_store_key_basic(self, manager):
        """Path /ws/doc converts to store key ws:doc."""
        result = manager._path_to_store_key("/ws/doc")
        assert result == "ws:doc"

    def test_path_to_store_key_with_underscores(self, manager):
        """Path with underscores preserved in store key."""
        result = manager._path_to_store_key("/my_workspace/my_doc")
        assert result == "my_workspace:my_doc"

    def test_path_to_store_key_with_dashes(self, manager):
        """Path with dashes preserved in store key."""
        result = manager._path_to_store_key("/my-workspace/my-doc")
        assert result == "my-workspace:my-doc"

    def test_path_to_store_key_uuid_style(self, manager):
        """UUID-style paths convert correctly."""
        result = manager._path_to_store_key("/f3725e03-2156-4c9f-8781-529bebf6e2dd/e69df82d-4414-4e3b-9c3f-7ba0c09be62e")
        assert result == "f3725e03-2156-4c9f-8781-529bebf6e2dd:e69df82d-4414-4e3b-9c3f-7ba0c09be62e"

    def test_path_to_store_key_invalid_empty(self, manager):
        """Empty segments raise ValueError."""
        with pytest.raises(ValueError):
            manager._path_to_store_key("/ws/")

    def test_path_to_store_key_longer_path(self, manager):
        """4-segment paths like /collab/crdt/ws/doc return ws:doc."""
        result = manager._path_to_store_key("/collab/crdt/ws/doc")
        assert result == "ws:doc"

    def test_path_to_store_key_invalid_no_slash(self, manager):
        """Paths without slash raise ValueError."""
        with pytest.raises(ValueError):
            manager._path_to_store_key("ws-doc")

    def test_path_to_store_key_rejects_4_segments(self, manager):
        """Paths with 4 segments (e.g. /ws/doc/extra) raise ValueError."""
        with pytest.raises(ValueError):
            manager._path_to_store_key("/ws/doc/extra")


class TestEnsureRoomForPath:
    """Test _ensure_room_for_path uses exact ASGI scope path as room key."""

    @pytest.fixture
    def store(self):
        return InMemoryDocumentStore()

    @pytest.fixture
    def manager(self, store):
        return PycrdtRoomManager(document_store=store)

    @pytest.mark.asyncio
    async def test_ensure_room_for_path_uses_exact_path_key(self, manager):
        """_ensure_room_for_path stores room under the exact path_key, not reconstructed."""
        room, key = await manager._ensure_room_for_path("/collab/crdt/ws1/doc1", "ws1", "doc1")
        assert key == "/collab/crdt/ws1/doc1"
        assert "/collab/crdt/ws1/doc1" in manager._server.rooms
        # Should NOT be stored under /ws1/doc1
        assert "/ws1/doc1" not in manager._server.rooms
        assert "ws1:doc1" not in manager._server.rooms

    @pytest.mark.asyncio
    async def test_ensure_room_for_path_loads_from_store_key(self, manager, store):
        """_ensure_room_for_path loads snapshot using store_key ws:doc, regardless of path_key."""
        # Save snapshot under store-key
        doc = Doc()
        text = doc["content"] = Text()
        text.insert(0, "hello from ensure_room_for_path")
        snapshot = doc.get_update()
        store.save("ws1:doc1", snapshot)

        # _ensure_room_for_path with different path format
        room, key = await manager._ensure_room_for_path("/collab/crdt/ws1/doc1", "ws1", "doc1")
        assert key == "/collab/crdt/ws1/doc1"

        # Room content restored
        text_in_room = room.ydoc.get("content", type=Text)
        assert text_in_room is not None
        assert str(text_in_room) == "hello from ensure_room_for_path"

    @pytest.mark.asyncio
    async def test_ensure_room_for_path_idempotent(self, manager):
        """Calling _ensure_room_for_path twice with same path_key returns same room."""
        room1, key1 = await manager._ensure_room_for_path("/collab/crdt/ws1/doc1", "ws1", "doc1")
        room2, key2 = await manager._ensure_room_for_path("/collab/crdt/ws1/doc1", "ws1", "doc1")
        assert room1 is room2
        assert key1 == key2 == "/collab/crdt/ws1/doc1"
        assert len(manager._server.rooms) == 1

    @pytest.mark.asyncio
    async def test_ensure_room_for_path_different_paths_same_ws_doc(self, manager):
        """Two different path_keys for same ws/doc create two separate rooms."""
        room1, key1 = await manager._ensure_room_for_path("/ws1/doc1", "ws1", "doc1")
        room2, key2 = await manager._ensure_room_for_path("/collab/crdt/ws1/doc1", "ws1", "doc1")
        assert key1 == "/ws1/doc1"
        assert key2 == "/collab/crdt/ws1/doc1"
        assert room1 is not room2
        assert len(manager._server.rooms) == 2


class TestEnsureRoomUsesPathKey:
    """Test that _ensure_room creates room under path-key in server.rooms."""

    @pytest.fixture
    def store(self):
        return InMemoryDocumentStore()

    @pytest.fixture
    def manager(self, store):
        return PycrdtRoomManager(document_store=store)

    @pytest.mark.asyncio
    async def test_ensure_room_creates_under_path_key(self, manager):
        """_ensure_room stores room under /ws/doc format, not ws:doc."""
        room, key = await manager._ensure_room("ws1", "doc1")
        assert key == "/ws1/doc1"
        assert "/ws1/doc1" in manager._server.rooms
        # Should NOT be stored under store-key
        assert "ws1:doc1" not in manager._server.rooms

    @pytest.mark.asyncio
    async def test_ensure_room_loads_from_store_key(self, manager, store):
        """Snapshot loaded from store uses store-key, room stored under path-key."""
        # Save snapshot under store-key
        doc = Doc()
        text = doc["content"] = Text()
        text.insert(0, "hello")
        snapshot = doc.get_update()
        store.save("ws1:doc1", snapshot)

        # _ensure_room loads from store and creates room under path-key
        room, key = await manager._ensure_room("ws1", "doc1")
        assert key == "/ws1/doc1"
        assert "/ws1/doc1" in manager._server.rooms

    @pytest.mark.asyncio
    async def test_no_duplicate_rooms_same_ws_doc(self, manager):
        """Calling _ensure_room twice doesn't create duplicate rooms."""
        room1, key1 = await manager._ensure_room("ws1", "doc1")
        room2, key2 = await manager._ensure_room("ws1", "doc1")
        assert room1 is room2
        assert key1 == key2 == "/ws1/doc1"
        # Only one entry
        assert len(manager._server.rooms) == 1


class TestPeriodicSnapshotWithRealContent:
    """Test that periodic snapshot saves non-empty content when keyed correctly."""

    @pytest.fixture
    def store(self):
        return InMemoryDocumentStore()

    @pytest.fixture
    def manager(self, store):
        return PycrdtRoomManager(document_store=store)

    @pytest.mark.asyncio
    async def test_periodic_snapshot_saves_nonempty_doc(self, manager, store):
        """A doc with text produces snapshot > 2 bytes when saved by periodic."""
        room, key = await manager._ensure_room("ws1", "doc1")

        # Write content to the room's ydoc using pycrdt Text API
        text = room.ydoc["content"] = Text()
        text.insert(0, "Hello from periodic snapshot")

        # Mark dirty
        manager._mark_dirty(key)

        # Run periodic snapshot
        await manager.run_periodic_snapshot_once()

        # Snapshot should exist and be > 2 bytes
        store_key = manager._path_to_store_key(key)
        assert store.exists(store_key)
        saved = store.load(store_key)
        assert saved is not None
        assert len(saved) > 2, f"Snapshot was {len(saved)} bytes, expected > 2"

    @pytest.mark.asyncio
    async def test_periodic_snapshot_preserves_content_on_restore(self, manager, store):
        """Content saved by periodic can be restored to a new room."""
        # Create room and add content using pycrdt Text API
        room1, key1 = await manager._ensure_room("ws1", "doc1")
        text1 = room1.ydoc["content"] = Text()
        text1.insert(0, "Persistence test content")

        manager._mark_dirty(key1)
        await manager.run_periodic_snapshot_once()

        store_key = manager._path_to_store_key(key1)
        saved_snapshot = store.load(store_key)
        assert saved_snapshot is not None
        assert len(saved_snapshot) > 2

        # Create new manager/room and verify restore
        manager2 = PycrdtRoomManager(document_store=store)
        room2, key2 = await manager2._ensure_room("ws1", "doc1")

        # The new room's ydoc should have the restored content
        text2 = room2.ydoc.get("content", type=Text)
        assert text2 is not None, "Restored doc should have content text"
        assert str(text2) == "Persistence test content"


class TestCloseRoomWithPathKey:
    """Test close_room works with path-key to store-key conversion."""

    @pytest.fixture
    def store(self):
        return InMemoryDocumentStore()

    @pytest.fixture
    def manager(self, store):
        return PycrdtRoomManager(document_store=store)

    @pytest.mark.asyncio
    async def test_close_room_saves_via_store_key(self, manager, store):
        """close_room saves using store-key and removes path-key from server.rooms."""
        room, key = await manager._ensure_room("ws1", "doc1")
        text = room.ydoc["content"] = Text()
        text.insert(0, "Close room test")

        await manager.close_room("ws1", "doc1")

        # Room removed from server (path-key)
        assert key not in manager._server.rooms
        # Snapshot saved under store-key
        store_key = "ws1:doc1"
        assert store.exists(store_key)
        saved = store.load(store_key)
        assert saved is not None
        assert len(saved) > 2


class TestListRoomsWithPathKey:
    """Test list_rooms returns correct keys after path-key migration."""

    @pytest.fixture
    def store(self):
        return InMemoryDocumentStore()

    @pytest.fixture
    def manager(self, store):
        return PycrdtRoomManager(document_store=store)

    @pytest.mark.asyncio
    async def test_list_rooms_returns_path_keys(self, manager):
        """list_rooms returns path-key format."""
        await manager._ensure_room("ws1", "doc1")
        await manager._ensure_room("ws2", "doc2")

        rooms = await manager.list_rooms()
        keys = [r["room_key"] for r in rooms]
        assert "/ws1/doc1" in keys
        assert "/ws2/doc2" in keys


class TestShutdownSaveWithPathKey:
    """Test that shutdown save converts path-key to store-key."""

    @pytest.fixture
    def store(self):
        return InMemoryDocumentStore()

    @pytest.fixture
    def manager(self, store):
        return PycrdtRoomManager(document_store=store)

    @pytest.mark.asyncio
    async def test_shutdown_save_uses_store_key(self, manager, store):
        """Shutdown iterates server.rooms (path-key) and saves to store (store-key)."""
        room, key = await manager._ensure_room("ws1", "doc1")
        text = room.ydoc["content"] = Text()
        text.insert(0, "Shutdown save test")

        # Simulate shutdown save (iterating server.rooms and calling store.save)
        for room_key, room in manager._server.rooms.items():
            if room.ydoc is not None:
                snapshot = room.ydoc.get_update()
                if snapshot:
                    store_key = manager._path_to_store_key(room_key)
                    store.save(store_key, snapshot)

        store_key = "ws1:doc1"
        assert store.exists(store_key)
        saved = store.load(store_key)
        assert len(saved) > 2
