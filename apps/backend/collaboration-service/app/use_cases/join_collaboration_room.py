from app.domain.collab_room import CollabRoom
from app.ports.crdt_room import RoomManager


async def join_collaboration_room(
    room_manager: RoomManager,
    workspace_id: str,
    document_id: str,
) -> CollabRoom:
    """Join or create a collaboration room.

    Returns a CollabRoom representing the session.
    The room is created lazily when the first client connects.
    """
    room = CollabRoom(workspace_id=workspace_id, document_id=document_id)
    return room


async def leave_collaboration_room(
    room_manager: RoomManager,
    workspace_id: str,
    document_id: str,
) -> None:
    """Check if a room should be closed (no clients left).

    With auto_clean_rooms=True, rooms are cleaned up automatically
    when the last client disconnects.
    """
    pass  # auto-clean handles this