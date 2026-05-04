"""
Collaboration-service entry point.

PM-08A: CRDT WebSocket endpoint is now mounted unconditionally.
The /collab/crdt/* mount is required for cloud-first collaboration.
"""

import uvicorn
from fastapi import FastAPI
from contextlib import asynccontextmanager
import asyncio
import os

from app.api import routes
from app.config.settings import Settings
from app.adapters.pycrdt_room_manager import PycrdtRoomManager
from app.api.crdt_routes import create_crdt_app
from app.shared.collab_debug import CRDT_DEBUG_MARKER


# Global room manager singleton (started on startup, stopped on shutdown)
_room_manager: PycrdtRoomManager | None = None

_settings = Settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start WebsocketServer on startup, stop on shutdown."""
    global _room_manager
    if _room_manager is not None:
        task = asyncio.create_task(_room_manager.server.start())
        await asyncio.sleep(0.1)
        _settings = Settings()
        if (
            _settings.DOCUMENT_PERIODIC_SNAPSHOT_ENABLED
            and _room_manager._document_store is not None
        ):
            _room_manager.set_periodic_config(
                enabled=True,
                interval=_settings.DOCUMENT_SNAPSHOT_INTERVAL_SECONDS,
                grace=_settings.DOCUMENT_EMPTY_ROOM_GRACE_SECONDS,
            )
            _room_manager.start_periodic_snapshot_task()
    yield
    if _room_manager is not None:
        _room_manager.stop_periodic_snapshot_task()
        for room_key, room in _room_manager.server.rooms.items():
            if room.ydoc is not None:
                snapshot = room.ydoc.get_update()
                store = _room_manager._document_store
                if store is not None and snapshot:
                    store_key = _room_manager._path_to_store_key(room_key)
                    store.save(store_key, snapshot)
        await _room_manager.server.stop()


app = FastAPI(title="collaboration-service", lifespan=lifespan)
app.include_router(routes.router)


# PM-08A: Mount CRDT WebSocket endpoint unconditionally.
# The smoke test depends on /collab/crdt being mounted in all environments.
# document_store is configured per DOCUMENT_STORE_TYPE setting (memory/local/s3).
document_store = None
if _settings.DOCUMENT_STORE_TYPE == "memory":
    from app.adapters.in_memory_document_store import InMemoryDocumentStore
    document_store = InMemoryDocumentStore()
elif _settings.DOCUMENT_STORE_TYPE == "local":
    from app.adapters.local_file_document_store import LocalFileDocumentStore
    document_store = LocalFileDocumentStore(root=_settings.DOCUMENT_STORE_PATH)
elif _settings.DOCUMENT_STORE_TYPE == "s3":
    if not _settings.AWS_S3_BUCKET_NAME:
        raise ValueError("AWS_S3_BUCKET_NAME is required when DOCUMENT_STORE_TYPE=s3")
    from app.adapters.s3_document_store import S3DocumentStore
    endpoint_url = _settings.AWS_ENDPOINT_URL or None
    document_store = S3DocumentStore(
        bucket=_settings.AWS_S3_BUCKET_NAME,
        region=_settings.AWS_REGION,
        endpoint_url=endpoint_url,
    )
# DOCUMENT_STORE_TYPE="disabled" means no persistence

crdt_app, manager = create_crdt_app(document_store)
if document_store is not None:
    manager.set_max_snapshot_bytes(_settings.MAX_SNAPSHOT_BYTES)
app.mount("/collab/crdt", crdt_app, name="crdt-ws")
print(
    f"[crdt] APP_CREATED path=/collab/crdt store_type={_settings.DOCUMENT_STORE_TYPE} "
    f"marker={CRDT_DEBUG_MARKER} pid={os.getpid()}",
    flush=True,
)
_room_manager = manager


@app.get("/health")
def health():
    return {"status": "ok", "service": "collaboration-service"}


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "collaboration-service"}


@app.get("/collab/debug/version")
async def debug_version():
    """Safe diagnostic endpoint — no secrets, no env vars, no tokens."""
    from app.api.routes import get_ticket_store

    ticket_store = get_ticket_store()
    has_old_ws_route = False
    has_mount_collab_crdt = False
    route_summary = []

    for route in app.routes:
        path = getattr(route, "path", "N/A")
        rtype = type(route).__name__
        route_summary.append({"path": path, "type": rtype})
        if path == "/collab/crdt" and rtype == "Mount":
            has_mount_collab_crdt = True
        # Check for the old WS route pattern under /collab prefix
        if hasattr(route, "path") and route.path == "/collab/{workspace_id}/{document_id}" and rtype == "WebSocketRoute":
            has_old_ws_route = True

    return {
        "service": "collaboration-service",
        "marker": "pm08a-crdt-debug-v1",
        "pid": os.getpid(),
        "ticket_store_type": "in_memory",
        "ticket_store_id": id(ticket_store),
        "crdt_app_created": True,
        "has_mount_collab_crdt": has_mount_collab_crdt,
        "has_old_ws_route": has_old_ws_route,
        "route_count": len(route_summary),
        "route_summary": route_summary,
    }


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=False)