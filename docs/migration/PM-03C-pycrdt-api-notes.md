# PM-03C — pycrdt/pycrdt-websocket API Notes

**Date:** 2026-04-25
**Source:** v0.16.0 installed, source inspected at `site-packages/pycrdt/websocket/`

---

## Key Classes Found

### `WebsocketServer` (`websocket_server.py`)

Manages rooms as `dict[str, YRoom]`. Used as async context manager.

```python
class WebsocketServer:
    rooms: dict[str, YRoom]
    auto_clean_rooms: bool
    started: Event  # async event when server has started

    def __init__(
        self,
        rooms_ready: bool = True,
        auto_clean_rooms: bool = True,
        exception_handler: Callable[[Exception, Logger], bool] | None = None,
        log: Logger | None = None,
        provider_factory: ProviderFactory | None = None,  # called when room needs external sync
    )

    async def get_room(self, name: str) -> YRoom  # get or create + start
    async def start()
    async def stop()
    async def serve(websocket: Channel)  # internal use, called by ASGIServer
```

Key behavior:
- `auto_clean_rooms=True`: deletes room when last client disconnects
- `serve(websocket)` uses `websocket.path` as room name
- Rooms persist until empty (with auto_clean) or until explicitly deleted
- Exception handler: return `True` to swallow exception, `False` to re-raise

### `YRoom` (`yroom.py`)

A single collaborative room with in-memory `Doc`. Not a singleton — one per room name.

```python
class YRoom:
    clients: set[Channel]  # connected clients
    ydoc: Doc              # CRDT document (one per YRoom)
    awareness: Awareness
    on_message: Callable[[bytes], Awaitable[bool] | bool] | None

    def __init__(
        self,
        ready: bool = True,
        ystore: BaseYStore | None = None,
        exception_handler: Callable[[Exception, Logger], bool] | None = None,
        log: Logger | None = None,
        ydoc: Doc | None = None,
        provider_factory: ProviderFactory | None = None,
    )

    async def serve(channel: Channel)  # serve a single client connection
```

Key behavior:
- `on_message`: callback called for each message. If returns `True`, message is SKIPPED and not forwarded to Yjs sync
- When clients connect, YRoom sends `SYNC_STEP1` (Yjs state vector)
- Clients reply with `SYNC_STEP2` (diff), YRoom applies it
- All connected clients receive broadcasts of applied updates
- Binary protocol: `YMessageType.SYNC` and `YMessageType.AWARENESS`

### `ASGIServer` (`asgi_server.py`)

ASGI app wrapping a `WebsocketServer`. Provides `on_connect` / `on_disconnect` callbacks.

```python
class ASGIServer:
    def __init__(
        self,
        websocket_server: WebsocketServer,
        on_connect: Callable[[dict[str, Any], dict[str, Any]], Awaitable[bool] | bool] | None = None,
        on_disconnect: Callable[[dict[str, Any]], Awaitable[None] | None] | None = None,
    )

    # ASGI app: async def __call__(scope, receive, send)
    # If on_connect returns True → connection rejected (no websocket.accept sent)
    # If on_connect returns False/None → websocket.accept + serve
    # Scope dict has: type, path, headers, etc.
```

### `HttpxWebsocket` (`websocket.py`)

Bridge between httpx WS and pycrdt `Channel` protocol:

```python
class HttpxWebsocket(Channel):
    def __init__(self, websocket, path: str)
    async def send(message: bytes)
    async def recv() -> bytes
    @property path: str
```

---

## Protocol Notes

- **Binary only** — not JSON. `YMessageType.SYNC` (0) and `YMessageType.AWARENESS` (1)
- Client connects at path like `/room-name`
- Room name = path from URL (e.g., `/{workspace_id}/{document_id}`)
- No built-in auth — implemented via `on_connect` callback or `on_message` filter
- Persistence: optional `ystore` (implements `BaseYStore`), no built-in S3/DynamoDB

---

## Decision for PM-03C

**Approach:** Create experimental endpoint `/collab/crdt/{workspace_id}/{document_id}` that uses ASGIServer + WebsocketServer with `on_connect` callback for auth (token from query string). Existing `/collab/{workspace_id}/{document_id}` stays unchanged for PM-03B auth compatibility.

**Why:**
1. `on_connect` callback can validate token BEFORE accepting WebSocket (clean rejection possible)
2. No JSON vs binary conflict — CRDT endpoint is pure binary from connect
3. Existing auth endpoint keeps working for PM-03B client compatibility
4. `on_connect` gets full `scope` dict — can read query params
5. `provider_factory` can be used for external sync later

**Limitation:** Token in query string (`?token=...`) — but this is internal service-to-service via Nginx with X-Shared-Secret protection, so acceptable for PM-03C spike.

**NOT implementing for PM-03C:**
- S3/DynamoDB persistence (PM-03E)
- Client-side Yjs integration (PM-03D)
- Real Supabase JWT validation in CRDT endpoint (using fake validation for spike)

---

## ⚠️ SECURITY WARNING — EXPERIMENTAL ENDPOINT

**`/collab/crdt/{workspace_id}/{document_id}` is EXPERIMENTAL**

This endpoint is **NOT safe for production exposure** until PM-03D (auth viable).

**Protection mechanism:**
- `ENABLE_EXPERIMENTAL_CRDT_ENDPOINT` setting in `settings.py`
- Default: `False` (secure by default)
- When `False`: endpoint is NOT mounted at all
- When `True`: endpoint is mounted for local testing only

**Production endpoint with verified auth:** `/collab/{workspace_id}/{document_id}` (PM-03B, first-message JSON auth)

**Never expose `/collab/crdt` in production until PM-03D is complete with auth integration.**

---

## Phase Scope Clarification

| Phase | Focus | Status |
|---|---|---|
| PM-03C | pycrdt-websocket base, room manager in-memory | ✅ Done |
| PM-03C.1 | Security hardening: ENABLE_EXPERIMENTAL_CRDT_ENDPOINT gate | ✅ Done |
| PM-03D | Yjs sync with two real clients + viable auth | Next |
| PM-03E | Persistence: S3/DynamoDB + snapshots/debounce | Future |

---

## Files to Create

```
apps/backend/collaboration-service/
  app/
    domain/
      collab_room.py        # CollabRoom entity
    ports/
      crdt_room.py          # RoomManager port
    adapters/
      pycrdt_room_manager.py  # in-memory WebsocketServer wrapper
    use_cases/
      join_collaboration_room.py
    api/
      crdt_routes.py        # /collab/crdt/{ws_id}/{doc_id}
```

## Tests

`test_ws_crdt.py` — minimal tests for room isolation, two clients, disconnect cleanup.