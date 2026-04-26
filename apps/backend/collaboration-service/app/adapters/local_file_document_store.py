import os
import re
import shutil
from pathlib import Path

from app.ports.document_store import DocumentStore

ROOM_KEY_PATTERN = re.compile(r"^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$")


class LocalFileDocumentStore(DocumentStore):
    """Local filesystem document store for development and demo.

    Stores snapshots as binary files on disk.
    NOT for production multi-instance deployments.
    """

    def __init__(self, root: str = ".data/collab-snapshots") -> None:
        self._root = Path(root).resolve()
        self._root.mkdir(parents=True, exist_ok=True)

    def _validate_room_key(self, room_key: str) -> None:
        if not ROOM_KEY_PATTERN.match(room_key):
            raise ValueError(f"Invalid room_key format: {room_key!r}")

    def _room_dir(self, room_key: str) -> Path:
        workspace_id, document_id = room_key.split(":", 1)
        return self._root / workspace_id / document_id

    def _snapshot_path(self, room_key: str) -> Path:
        return self._room_dir(room_key) / "latest.bin"

    def save(self, room_key: str, snapshot: bytes) -> None:
        self._validate_room_key(room_key)
        dir_path = self._room_dir(room_key)
        dir_path.mkdir(parents=True, exist_ok=True)
        tmp_path = dir_path / "latest.tmp"
        final_path = dir_path / "latest.bin"
        tmp_path.write_bytes(snapshot)
        tmp_path.replace(final_path)

    def load(self, room_key: str) -> bytes | None:
        self._validate_room_key(room_key)
        path = self._snapshot_path(room_key)
        if not path.exists():
            return None
        return path.read_bytes()

    def delete(self, room_key: str) -> None:
        self._validate_room_key(room_key)
        dir_path = self._room_dir(room_key)
        if dir_path.exists():
            shutil.rmtree(dir_path)

    def exists(self, room_key: str) -> bool:
        self._validate_room_key(room_key)
        return self._snapshot_path(room_key).exists()

    def __repr__(self) -> str:
        return f"LocalFileDocumentStore(root={self._root!r})"