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
    yield
    if _room_manager is not None:
        await _room_manager.server.stop()


app = FastAPI(title="collaboration-service", lifespan=lifespan)
app.include_router(routes.router)


# Mount CRDT WebSocket endpoint at /collab/crdt/* ONLY when explicitly enabled.
# This endpoint is experimental and does NOT have full auth integrated yet.
# It is NOT safe for production exposure until PM-03D/PM-03E.
_settings = Settings()
if _settings.ENABLE_EXPERIMENTAL_CRDT_ENDPOINT:
    crdt_app, manager = create_crdt_app()
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