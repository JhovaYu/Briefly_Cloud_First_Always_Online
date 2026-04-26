from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/collab")


@router.get("/health")
def collab_health():
    return {"status": "ok", "service": "collaboration-service"}


@router.get("/healthz")
def collab_healthz():
    return {"status": "ok", "service": "collaboration-service"}


@router.websocket("/echo")
async def ws_echo(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_json({"type": "ready", "service": "collaboration-service"})
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                await websocket.send_json({"type": "echo", "payload": data})
    except WebSocketDisconnect:
        pass
