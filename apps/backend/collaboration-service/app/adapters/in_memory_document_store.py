from typing import Self

from app.ports.document_store import DocumentStore


class InMemoryDocumentStore(DocumentStore):
    """In-memory document store for unit tests and development.

    NOT persistent — data lost on process restart.
    """

    def __init__(self) -> None:
        self._store: dict[str, bytes] = {}

    def save(self, room_key: str, snapshot: bytes) -> None:
        self._store[room_key] = snapshot

    def load(self, room_key: str) -> bytes | None:
        return self._store.get(room_key)

    def delete(self, room_key: str) -> None:
        self._store.pop(room_key, None)

    def exists(self, room_key: str) -> bool:
        return room_key in self._store

    def __repr__(self) -> str:
        return f"InMemoryDocumentStore(keys={list(self._store.keys())})"