import uvicorn
from fastapi import FastAPI

from app.api import routes
from app.config.settings import Settings
from app.adapters.pycrdt_room_manager import PycrdtRoomManager
from app.api.crdt_routes import create_crdt_app

app = FastAPI(title="collaboration-service")
app.include_router(routes.router)


# Mount CRDT WebSocket endpoint at /collab/crdt/* ONLY when explicitly enabled.
# This endpoint is experimental and does NOT have full auth integrated yet.
# It is NOT safe for production exposure until PM-03D/PM-03E.
_settings = Settings()
if _settings.ENABLE_EXPERIMENTAL_CRDT_ENDPOINT:
    crdt_app, _ = create_crdt_app()
    app.mount("/collab/crdt", crdt_app, name="crdt-ws")


@app.get("/health")
def health():
    return {"status": "ok", "service": "collaboration-service"}


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "collaboration-service"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=False)