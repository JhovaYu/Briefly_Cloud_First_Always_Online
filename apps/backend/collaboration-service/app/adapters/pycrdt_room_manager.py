from pycrdt.websocket import WebsocketServer

from app.domain.collab_room import CollabRoom
from app.ports.crdt_room import RoomManager


class PycrdtRoomManager(RoomManager):
    """In-memory room manager using pycrdt-websocket WebsocketServer.

    Each room is a YRoom with in-memory Doc (no persistence in this implementation).
    Room key: "{workspace_id}:{document_id}"
    """

    def __init__(self) -> None:
        self._server = WebsocketServer(
            auto_clean_rooms=True,
            rooms_ready=True,
        )

    @property
    def server(self) -> WebsocketServer:
        return self._server

    def _room_key(self, workspace_id: str, document_id: str) -> str:
        return f"{workspace_id}:{document_id}"

    async def get_room_info(self, workspace_id: str, document_id: str) -> dict:
        room_key = self._room_key(workspace_id, document_id)
        room = self._server.rooms.get(room_key)
        if room is None:
            return {"exists": False, "client_count": 0, "workspace_id": workspace_id, "document_id": document_id}
        return {
            "exists": True,
            "client_count": len(room.clients),
            "workspace_id": workspace_id,
            "document_id": document_id,
        }

    async def close_room(self, workspace_id: str, document_id: str) -> None:
        room_key = self._room_key(workspace_id, document_id)
        if room_key in self._server.rooms:
            await self._server.delete_room(name=room_key)

    async def list_rooms(self) -> list[dict]:
        result = []
        for room_key, room in self._server.rooms.items():
            workspace_id, document_id = room_key.split(":", 1)
            result.append({
                "workspace_id": workspace_id,
                "document_id": document_id,
                "client_count": len(room.clients),
                "room_key": room_key,
            })
        return result