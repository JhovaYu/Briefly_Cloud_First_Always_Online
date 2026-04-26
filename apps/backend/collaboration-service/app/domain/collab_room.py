from dataclasses import dataclass


@dataclass(frozen=True)
class CollabRoom:
    """A collaboration room represents a shared document session.

    Room key is "{workspace_id}:{document_id}" for in-memory management.
    """
    workspace_id: str
    document_id: str

    @property
    def room_key(self) -> str:
        return f"{self.workspace_id}:{self.document_id}"

    @property
    def ws_path(self) -> str:
        """WebSocket path component for this room."""
        return f"{self.workspace_id}/{self.document_id}"