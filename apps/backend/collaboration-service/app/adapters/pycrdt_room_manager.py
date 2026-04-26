import asyncio
from typing import Optional

from pycrdt import Doc
from pycrdt.websocket import WebsocketServer, YRoom

from app.domain.collab_room import CollabRoom
from app.ports.crdt_room import RoomManager
from app.ports.document_store import DocumentStore


class PycrdtRoomManager(RoomManager):
    """In-memory room manager using pycrdt-websocket WebsocketServer.

    Each room is a YRoom with in-memory Doc (no persistence in this implementation).
    Room key: "{workspace_id}:{document_id}"

    Snapshots are persisted via injected DocumentStore.
    auto_clean_rooms=False so manual snapshot+cleanup happens on disconnect.
    """

    def __init__(self, document_store: Optional[DocumentStore] = None) -> None:
        self._document_store: DocumentStore | None = document_store
        self._server = WebsocketServer(
            auto_clean_rooms=False,
            rooms_ready=True,
        )
        self._locks: dict[str, asyncio.Lock] = {}
        self._max_snapshot_bytes: int | None = None
        # Track channel -> room_key for on_disconnect callback
        self._channel_to_room: dict[int, str] = {}

    @property
    def server(self) -> WebsocketServer:
        return self._server

    def set_max_snapshot_bytes(self, max_bytes: int) -> None:
        self._max_snapshot_bytes = max_bytes

    def _room_key(self, workspace_id: str, document_id: str) -> str:
        return f"{workspace_id}:{document_id}"

    def _get_lock(self, room_key: str) -> asyncio.Lock:
        if room_key not in self._locks:
            self._locks[room_key] = asyncio.Lock()
        return self._locks[room_key]

    def track_channel(self, channel_id: int, room_key: str) -> None:
        """Register a channel as belonging to a room. Called on connect."""
        self._channel_to_room[channel_id] = room_key

    async def handle_disconnect(self, channel_id: int) -> None:
        """Handle client disconnect: save snapshot if room has no clients, then cleanup.

        Called by the ASGIServer on_disconnect callback.
        """
        room_key = self._channel_to_room.pop(channel_id, None)
        if room_key is None:
            return

        lock = self._get_lock(room_key)
        async with lock:
            room = self._server.rooms.get(room_key)
            if room is None:
                return
            if room.clients:
                return  # still has other clients
            # Last client disconnected — save snapshot and remove room
            await self._save_and_cleanup(room_key, room)
            del self._server.rooms[room_key]

    async def _ensure_room(
        self, workspace_id: str, document_id: str
    ) -> tuple[YRoom, str]:
        """Ensure room exists with snapshot loaded, returning (room, room_key).

        If room doesn't exist yet, creates it with any stored snapshot applied.
        Acquires lock per room_key for thread-safe room creation.
        """
        room_key = self._room_key(workspace_id, document_id)
        lock = self._get_lock(room_key)

        async with lock:
            # Check if room already exists in server
            if room_key in self._server.rooms:
                return self._server.rooms[room_key], room_key

            # Create new Doc and apply snapshot if available
            doc = Doc()
            store = self._document_store
            if store is not None:
                snapshot = store.load(room_key)
                if snapshot is not None:
                    try:
                        doc.apply_update(snapshot)
                    except Exception:
                        # Corrupt snapshot: start fresh, log but don't crash
                        pass

            # Manually create YRoom with the doc
            room = YRoom(ready=True, ydoc=doc)
            self._server.rooms[room_key] = room

            return room, room_key

    async def get_room_info(self, workspace_id: str, document_id: str) -> dict:
        room_key = self._room_key(workspace_id, document_id)
        room = self._server.rooms.get(room_key)
        if room is None:
            return {
                "exists": False,
                "client_count": 0,
                "workspace_id": workspace_id,
                "document_id": document_id,
            }
        return {
            "exists": True,
            "client_count": len(room.clients),
            "workspace_id": workspace_id,
            "document_id": document_id,
        }

    async def close_room(self, workspace_id: str, document_id: str) -> None:
        room_key = self._room_key(workspace_id, document_id)
        lock = self._get_lock(room_key)
        async with lock:
            if room_key in self._server.rooms:
                room = self._server.rooms[room_key]
                await self._save_and_cleanup(room_key, room)
                del self._server.rooms[room_key]

    async def _save_and_cleanup(self, room_key: str, room: YRoom) -> None:
        """Save snapshot and stop room."""
        if room.ydoc is None:
            return
        snapshot = room.ydoc.get_update()
        if self._max_snapshot_bytes and len(snapshot) > self._max_snapshot_bytes:
            return  # skip oversized snapshot
        store = self._document_store
        if store is not None:
            store.save(room_key, snapshot)
        try:
            await room.stop()
        except Exception:
            pass

    async def list_rooms(self) -> list[dict]:
        result = []
        for room_key, room in self._server.rooms.items():
            parts = room_key.split(":", 1)
            if len(parts) != 2:
                continue
            workspace_id, document_id = parts
            result.append({
                "workspace_id": workspace_id,
                "document_id": document_id,
                "client_count": len(room.clients),
                "room_key": room_key,
            })
        return result

    def set_document_store(self, store: DocumentStore) -> None:
        self._document_store = store