# Latest Handoff

## Fase
PM-03D.4 (2026-04-26) — Yjs sync smoke con WebsocketProvider — SYNC PASS

## Contexto previo relevante

- **PM-03A:** WebSocket echo endpoint `/collab/echo`
- **PM-03B:** First-message auth estable en `/collab/{ws_id}/{doc_id}`
- **PM-03C:** pycrdt-websocket base experimental con feature flag
- **PM-03D:** Ticket auth (sistema de tickets opacos) implementado
- **PM-03D.2:** Ejecutó smoke con `ws` raw — halló incompatibilidad (falso positivo posterior)
- **PM-03D.4:** Reescribió smoke con `WebsocketProvider` — SYNC PASS (2026-04-26)

## Objetivo ejecutado

 smoke Yjs con WebsocketProvider:
1. ✅ SUPABASE_TEST_JWT verificado (presente, no impreso)
2. ✅ Ticket endpoint emite tickets reales (HTTP 200 con JWT válido)
3. ✅ Dos providers conectan con tickets válidos (WebsocketProvider, no raw ws)
4. ✅ A→B sync: PASS
5. ✅ B→A sync: PASS
6. ✅ JWT no impreso, tickets enmascarados
7. ✅ 55 Python tests passing

## Cambios aplicados

### 1. Smoke reescrito con WebsocketProvider

**Archivo:** `smoke/yjs-sync-smoke.mjs`

Usa `WebsocketProvider` de `y-websocket` en lugar de `ws` raw con parseo manual de protocolo.

```javascript
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';

const provider = new WebsocketProvider(
  'ws://localhost:8002/collab/crdt',  // incluye /collab/crdt como prefix
  `${workspaceId}/${documentId}`,      // room name como segundo argumento
  doc,
  { WebSocketPolyfill: WebSocket, params: { ticket: ticketId } }
);
```

**Key finding:** `WS_BASE` debe ser `ws://host/collab/crdt`, no `ws://host/`.
El mount point `/collab/crdt` es parte del URL.

### 2. Fix: on_connect signature para pycrdt-websocket API

**Archivo:** `app/api/crdt_routes.py`

pycrdt-websocket 0.16.0 llama `on_connect(msg, scope)` (ASGI message first).
El callback debe ser `async def on_connect(msg: dict, scope: dict)` — no `scope, receive`.

```python
# Antes (error de API):
async def on_connect(scope: dict, receive: dict) -> bool:

# Después (correcto):
async def on_connect(msg: dict, scope: dict) -> bool:
```

### 3. Fix: lifespan para iniciar WebsocketServer

**Archivo:** `app/main.py`

WebsocketServer necesita `start()` antes de servir conexiones.
Sin lifespan, el servidor nunca arranca y conexiones fallan con 500.

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _room_manager
    if _room_manager is not None:
        task = asyncio.create_task(_room_manager.server.start())
        await asyncio.sleep(0.1)
    yield
    if _room_manager is not None:
        await _room_manager.server.stop()
```

### 4. Fix: import faltante en issue_collaboration_ticket

**Archivo:** `app/use_cases/issue_collaboration_ticket.py`

```python
# Añadido:
from app.adapters.in_memory_ticket_store import InMemoryTicketStore
```

Sin este import, el endpoint de tickets fallaba con `500: name 'InMemoryTicketStore' is not defined`.

### 5. Feature flag en Docker Compose

**Archivo:** `docker-compose.yml`

```yaml
environment:
  - ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=${ENABLE_EXPERIMENTAL_CRDT_ENDPOINT:-false}
  - TICKET_TTL_SECONDS=${TICKET_TTL_SECONDS:-60}
```

## Ticket auth status

**PASS** — El sistema de tickets funciona correctamente:

- `POST /collab/{ws_id}/{doc_id}/ticket` emite tickets opacos de 43+ chars
- `Authorization: Bearer <jwt>` valida contra Workspace Service
- Ticket se almacena en InMemoryTicketStore con TTL 60s
- on_connect valida: existe, no expirado, match workspace+document
- JWT no se imprime, no se guarda, no va en query string

## Yjs smoke status

- **Ticket endpoint:** PASS (200 con JWT real, role=owner)
- **Provider A connection:** PASS
- **Provider B connection:** PASS
- **A → B sync:** PASS
- **B → A sync:** PASS

**SYNC PASS: bidirectional text sync verified**

**Nota:** PM-03D.2 fue un falso negativo. El smoke anterior usó `ws` raw + parseo manual de bytes del protocolo. Con `WebsocketProvider` (el cliente correcto), `pycrdt-websocket` y `yjs` SON compatibles.

## Validaciones ejecutadas

```
python -m pytest apps/backend/collaboration-service/tests -v → 55 passed
docker compose config                  → Validated OK
docker compose build collaboration-service → Built OK
curl http://localhost:8002/health     → {"status":"ok"}
node smoke/yjs-sync-smoke.mjs          → SYNC PASS
```

## Archivos modificados (PM-03D.4)

```
M docs/migration/PM-03D-yjs-sync-notes.md
M docs/migration/latest_handoff.md
M migracion_briefly.md
M tasks.md
A apps/backend/collaboration-service/smoke/.gitignore
A apps/backend/collaboration-service/smoke/package.json
A apps/backend/collaboration-service/smoke/yjs-sync-smoke.mjs
```

## Archivos nuevos (ticket auth — ya commitados en commits anteriores)

```
M apps/backend/collaboration-service/app/adapters/in_memory_ticket_store.py
M apps/backend/collaboration-service/app/domain/collab_ticket.py
M apps/backend/collaboration-service/app/ports/ticket_store.py
M apps/backend/collaboration-service/app/use_cases/issue_collaboration_ticket.py
M apps/backend/collaboration-service/app/use_cases/validate_collaboration_ticket.py
M apps/backend/collaboration-service/app/api/routes.py
M apps/backend/collaboration-service/app/api/crdt_routes.py
M apps/backend/collaboration-service/app/config/settings.py
M apps/backend/collaboration-service/app/main.py
M apps/backend/collaboration-service/tests/test_collab_tickets.py
```

**Excluido:** `apps/backend/collaboration-service/smoke/node_modules/` (eliminado del workspace)

## Tests

**55 passed**

## Contrato para la siguiente iteración

**PM-03E — Persistencia S3/DynamoDB** (desbloqueado — PM-03D sync bidireccional verificado)

Opciones:
- S3/DynamoDB para snapshots y debounce
- Persistencia de room state

**PM-03D.5 opcional:** Nginx/reconnect hardening si se requiere para producción.

## Archivos excluidos del commit

```
apps/backend/collaboration-service/smoke/node_modules/   (no existe — eliminado)
apps/backend/collaboration-service/smoke/package-lock.json (en .gitignore)
.env, *.log, __pycache__/, *.pyc
```

## Archivos incluidos en el commit

```bash
git add \
  docs/migration/PM-03D-yjs-sync-notes.md \
  docs/migration/latest_handoff.md \
  migracion_briefly.md \
  tasks.md \
  apps/backend/collaboration-service/smoke/.gitignore \
  apps/backend/collaboration-service/smoke/package.json \
  apps/backend/collaboration-service/smoke/yjs-sync-smoke.mjs
```