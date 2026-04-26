from abc import ABC, abstractmethod
from typing import AsyncIterator


class RoomManager(ABC):
    """Port for managing collaboration rooms (CRDT document sessions)."""

    @abstractmethod
    async def get_room_info(self, workspace_id: str, document_id: str) -> dict:
        """Get info about a room (connection count, etc.)."""
        ...

    @abstractmethod
    async def close_room(self, workspace_id: str, document_id: str) -> None:
        """Explicitly close a room (e.g., document deleted)."""
        ...

    @abstractmethod
    async def list_rooms(self) -> list[dict]:
        """List all active rooms with metadata."""
        ...