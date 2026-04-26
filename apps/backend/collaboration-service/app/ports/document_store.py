from abc import ABC, abstractmethod


class DocumentStore(ABC):
    """Port for persisting CRDT document snapshots.

    Snapshot-only store: saves binary CRDT state blobs.
    Does NOT handle update logs (PM-03E.2 scope).
    """

    @abstractmethod
    def save(self, room_key: str, snapshot: bytes) -> None:
        """Save snapshot for a room. Overwrites if exists."""
        ...

    @abstractmethod
    def load(self, room_key: str) -> bytes | None:
        """Load snapshot for a room. Returns None if not found."""
        ...

    @abstractmethod
    def delete(self, room_key: str) -> None:
        """Delete snapshot for a room. No-op if not exists."""
        ...

    @abstractmethod
    def exists(self, room_key: str) -> bool:
        """Check if snapshot exists for a room."""
        ...