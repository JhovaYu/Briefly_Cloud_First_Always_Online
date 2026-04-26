import asyncio
import time
from typing import Optional

from pycrdt import Doc
from pycrdt.websocket import WebsocketServer, YRoom

from app.domain.collab_room import CollabRoom
from app.ports.crdt_room import RoomManager
from app.ports.document_store import DocumentStore


class PycrdtRoomManager(RoomManager):
    """In-memory room manager using pycrdt-websocket WebsocketServer.

    Each room is a YRoom with in-memory Doc.
    Room key: "{workspace_id}:{document_id}"

    Snapshots are persisted via injected DocumentStore.
    auto_clean_rooms=False so manual snapshot+cleanup happens.

    Supports dirty tracking and periodic snapshot for orphan rooms.
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
        # Dirty state per room: marks when ydoc has unsaved changes
        self._room_dirty: dict[str, bool] = {}
        # Timestamps for orphan detection
        self._room_empty_since: dict[str, float] = {}
        # Periodic task handle
        self._periodic_task: asyncio.Task | None = None
        self._periodic_enabled: bool = False
        self._snapshot_interval: float = 30.0
        self._empty_room_grace: float = 5.0
        # Subscriptions for doc observers (room_key -> sub)
        self._doc_subscriptions: dict[str, object] = {}

    @property
    def server(self) -> WebsocketServer:
        return self._server

    def set_max_snapshot_bytes(self, max_bytes: int) -> None:
        self._max_snapshot_bytes = max_bytes

    def set_periodic_config(
        self, enabled: bool, interval: float, grace: float
    ) -> None:
        self._periodic_enabled = enabled
        self._snapshot_interval = interval
        self._empty_room_grace = grace

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
            # Clean up tracking
            self._room_dirty.pop(room_key, None)
            self._room_empty_since.pop(room_key, None)
            sub = self._doc_subscriptions.pop(room_key, None)
            if sub is not None and room.ydoc is not None:
                try:
                    room.ydoc.unobserve(sub)
                except Exception:
                    pass

    def _mark_dirty(self, room_key: str) -> None:
        """Mark a room as dirty (has unsaved changes)."""
        self._room_dirty[room_key] = True

    def _mark_clean(self, room_key: str) -> None:
        """Mark a room as clean (snapshot saved)."""
        self._room_dirty[room_key] = False

    def _is_dirty(self, room_key: str) -> bool:
        return self._room_dirty.get(room_key, False)

    def _setup_doc_observer(self, room_key: str, ydoc: Doc) -> None:
        """Attach an observer to ydoc to track dirty state."""
        if room_key in self._doc_subscriptions:
            return  # already observing

        def on_update(event):
            self._mark_dirty(room_key)

        try:
            sub = ydoc.observe(on_update)
            self._doc_subscriptions[room_key] = sub
        except Exception:
            pass

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
                        pass

            # Manually create YRoom with the doc
            room = YRoom(ready=True, ydoc=doc)
            self._server.rooms[room_key] = room
            self._mark_clean(room_key)

            # Set up dirty tracking observer
            self._setup_doc_observer(room_key, doc)

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
                self._room_dirty.pop(room_key, None)
                self._room_empty_since.pop(room_key, None)
                sub = self._doc_subscriptions.pop(room_key, None)
                if sub is not None and room.ydoc is not None:
                    try:
                        room.ydoc.unobserve(sub)
                    except Exception:
                        pass

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
        self._mark_clean(room_key)
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

    # ─── Periodic snapshot task ───────────────────────────────────────────

    def start_periodic_snapshot_task(self) -> None:
        """Start the background periodic snapshot task. Idempotent."""
        if self._periodic_task is not None:
            return  # already running
        self._periodic_enabled = True
        self._periodic_task = asyncio.create_task(self._periodic_snapshot_loop())

    def stop_periodic_snapshot_task(self) -> None:
        """Stop the periodic snapshot task."""
        self._periodic_enabled = False
        if self._periodic_task is not None:
            self._periodic_task.cancel()
            self._periodic_task = None

    async def run_periodic_snapshot_once(self) -> None:
        """Run one iteration of periodic snapshot. For testing without sleeps."""
        if self._document_store is None:
            return

        now = time.monotonic()
        for room_key, room in list(self._server.rooms.items()):
            is_empty = len(room.clients) == 0
            is_dirty = self._is_dirty(room_key)

            if is_empty:
                # Track when room became empty
                if room_key not in self._room_empty_since:
                    self._room_empty_since[room_key] = now
                empty_duration = now - self._room_empty_since[room_key]

                if is_dirty:
                    # Dirty + empty → save snapshot
                    lock = self._get_lock(room_key)
                    async with lock:
                        await self._save_and_cleanup(room_key, room)
                        # After save+stop, the room is gone from server
                        if room_key in self._server.rooms:
                            del self._server.rooms[room_key]
                        self._room_dirty.pop(room_key, None)
                        self._room_empty_since.pop(room_key, None)
                        sub = self._doc_subscriptions.pop(room_key, None)
                        if sub is not None and room.ydoc is not None:
                            try:
                                room.ydoc.unobserve(sub)
                            except Exception:
                                pass
                elif empty_duration >= self._empty_room_grace:
                    # Empty, not dirty, grace expired → save clean and remove
                    lock = self._get_lock(room_key)
                    async with lock:
                        if room.ydoc is not None:
                            snapshot = room.ydoc.get_update()
                            if snapshot:
                                max_bytes = self._max_snapshot_bytes
                                if max_bytes is None or len(snapshot) <= max_bytes:
                                    self._document_store.save(room_key, snapshot)
                        self._mark_clean(room_key)
                        try:
                            await room.stop()
                        except Exception:
                            pass
                        if room_key in self._server.rooms:
                            del self._server.rooms[room_key]
                        self._room_empty_since.pop(room_key, None)
                        sub = self._doc_subscriptions.pop(room_key, None)
                        if sub is not None and room.ydoc is not None:
                            try:
                                room.ydoc.unobserve(sub)
                            except Exception:
                                pass
            else:
                # Room has active clients
                self._room_empty_since.pop(room_key, None)
                if is_dirty:
                    # Save dirty room with active clients but don't remove
                    lock = self._get_lock(room_key)
                    async with lock:
                        if room.ydoc is not None:
                            snapshot = room.ydoc.get_update()
                            if snapshot:
                                max_bytes = self._max_snapshot_bytes
                                if max_bytes is None or len(snapshot) <= max_bytes:
                                    self._document_store.save(room_key, snapshot)
                        self._mark_clean(room_key)

    async def _periodic_snapshot_loop(self) -> None:
        """Background loop that periodically saves dirty rooms and cleans empty ones."""
        while self._periodic_enabled:
            try:
                await asyncio.sleep(self._snapshot_interval)
                if not self._periodic_enabled:
                    break
                await self.run_periodic_snapshot_once()
            except asyncio.CancelledError:
                break
            except Exception:
                pass  # don't let errors crash the background task