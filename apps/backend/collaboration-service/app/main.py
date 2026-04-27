import uvicorn
from fastapi import FastAPI
from contextlib import asynccontextmanager
import asyncio

from app.api import routes
from app.config.settings import Settings
from app.adapters.pycrdt_room_manager import PycrdtRoomManager
from app.api.crdt_routes import create_crdt_app


# Global room manager singleton (started on startup, stopped on shutdown)
_room_manager: PycrdtRoomManager | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start WebsocketServer on startup, stop on shutdown."""
    global _room_manager
    if _room_manager is not None:
        # Start server in background task
        task = asyncio.create_task(_room_manager.server.start())
        # Give it a moment to start
        await asyncio.sleep(0.1)
        # Start periodic snapshot task if enabled
        _settings = Settings()
        if (
            _settings.ENABLE_EXPERIMENTAL_CRDT_ENDPOINT
            and _settings.DOCUMENT_PERIODIC_SNAPSHOT_ENABLED
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
        # Stop periodic task first
        _room_manager.stop_periodic_snapshot_task()
        # Save snapshots for all active rooms before shutdown
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


# Mount CRDT WebSocket endpoint at /collab/crdt/* ONLY when explicitly enabled.
# This endpoint is experimental and does NOT have full auth integrated yet.
# It is NOT safe for production exposure until PM-03D/PM-03E.
_settings = Settings()
if _settings.ENABLE_EXPERIMENTAL_CRDT_ENDPOINT:
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
    _room_manager = manager


@app.get("/health")
def health():
    return {"status": "ok", "service": "collaboration-service"}


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "collaboration-service"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=False)