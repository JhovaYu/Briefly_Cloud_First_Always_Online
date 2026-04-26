# Latest Handoff

## Fase
PM-03D.2 — Yjs smoke real con SUPABASE_TEST_JWT + compatibilidad pycrdt/yjs

## Contexto previo relevante

- **PM-03A:** WebSocket echo endpoint `/collab/echo`
- **PM-03B:** First-message auth estable en `/collab/{ws_id}/{doc_id}`
- **PM-03C:** pycrdt-websocket base experimental con feature flag
- **PM-03D:** Ticket auth (sistema de tickets opacos) implementado
- **PM-03D.1:** Intentó smoke real pero usó ticket hardcodeado que no existía en store
- **PM-03D.2:** Ejecutó smoke con JWT real — descubrió incompatibilidad de protocolo

## Objetivo ejecutado

Ejecutar smoke Yjs real con SUPABASE_TEST_JWT:
1. ✅ SUPABASE_TEST_JWT verificado (presente, no impreso)
2. ✅ Ticket endpoint emite tickets reales (HTTP 200 con JWT válido)
3. ✅ Dos clientes WebSocket conectan con tickets válidos
4. ✅ JWT no impreso ni guardado
5. ✅ Tickets enmascarados (solo últimos 4 caracteres)
6. ❌ Yjs bidirectional sync — BLOQUEADO por incompatibilidad de protocolo
7. ✅ Nginx auth barrier funciona (X-Shared-Secret requerido)

## Cambios aplicados

### 1. Fix: on_connect signature para pycrdt-websocket API

**Archivo:** `app/api/crdt_routes.py`

pycrdt-websocket 0.16.0 llama `on_connect(msg, scope)` (ASGI message first).
El callback debe ser `async def on_connect(msg: dict, scope: dict)` — no `scope, receive`.

```python
# Antes (error de API):
async def on_connect(scope: dict, receive: dict) -> bool:

# Después (correcto):
async def on_connect(msg: dict, scope: dict) -> bool:
```

### 2. Fix: lifespan para iniciar WebsocketServer

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

### 3. Fix: import faltante en issue_collaboration_ticket

**Archivo:** `app/use_cases/issue_collaboration_ticket.py`

```python
# Añadido:
from app.adapters.in_memory_ticket_store import InMemoryTicketStore
```

Sin este import, el endpoint de tickets fallaba con `500: name 'InMemoryTicketStore' is not defined`.

### 4. Feature flag en Docker Compose

**Archivo:** `docker-compose.yml`

```yaml
environment:
  - ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=${ENABLE_EXPERIMENTAL_CRDT_ENDPOINT:-false}
  - TICKET_TTL_SECONDS=${TICKET_TTL_SECONDS:-60}
```

### 5. Smoke script reescrito

**Archivo:** `smoke/yjs-sync-smoke.mjs`

- Lee SUPABASE_TEST_JWT desde env (no hardcodeado)
- Obtiene tickets reales del endpoint
- Conecta dos clientes WebSocket raw (no y-websocket provider)
- No imprime JWT ni tickets completos
- Documenta incompatibilidad de protocolo

## Ticket auth status

**PASS** — El sistema de tickets funciona correctamente:

- `POST /collab/{ws_id}/{doc_id}/ticket` emite tickets opacos de 43+ chars
- `Authorization: Bearer <jwt>` valida contra Workspace Service
- Ticket se almacena en InMemoryTicketStore con TTL 60s
- on_connect valida: existe, no expirado, match workspace+document
- JWT no se imprime, no se guarda, no va en query string

## Yjs smoke status

- **Ticket endpoint:** PASS (200 con JWT real, role=owner)
- **WebSocket connection:** PASS (cliente A y B conectan con tickets válidos)
- **Yjs bidirectional sync:** BLOCKED — incompatibilidad de protocolo pycrdt vs yjs

**Detalles del bloqueo:**

pycrdt-websocket codifica mensajes sync como:
```
[SYNC_TYPE=0, SYNC_KIND(1-byte fixed), varuint(len), data]
Ejemplo para sync step1 con sv vacío: [0, 0, 1, 0]  (4 bytes)
```

yjs/y-protocols espera:
```
[SYNC_TYPE(varuint), syncKind(varuint), stateVector(varuint8array)]
```

La diferencia es `SYNC_KIND` como byte fijo vs varuint. Esto hace que `readSyncMessage` de y-protocols falle al parsear respuestas del servidor pycrdt. La sync bidireccional real de Y.Doc entre pycrdt-server y yjs-client NO es posible sin capa de traducción de protocolo.

**Evidencia:**
```
# pycrdt genera para sync step1 con sv vacío: [0, 0, 1, 0]  (4 bytes)
# yjs/y-protocols writeSyncStep1 genera: [0, 0, varuint(sv_len), sv_bytes]
# El servidor responde [0, 0, 1, 0] pero yjs espera [0, 0, varuint, sv_bytes]
# → readSyncMessage falla: Unexpected end of array
```

## Compatibilidad pycrdt / yjs

| Aspecto | pycrdt-websocket 0.16.0 | yjs + y-protocols |
|---|---|---|
| SYNC message format | `[0, syncKind_fixed, len, data]` | `[0, syncKind_varuint, sv_varuint8array]` |
| syncKind encoding | 1 byte fijo | varuint |
| State vector | raw bytes prefixed with len | varuint8array |
| Awareness | Separate message type 1 | y-protocols awareness |
| **Compatible?** | **NO** | **NO** |

**Implicación:** Un cliente yjs NO puede sync con un servidor pycrdt-websocket sin adapter/translation layer.

## Archivos modificados

```
 M apps/backend/collaboration-service/app/api/crdt_routes.py
 M apps/backend/collaboration-service/app/api/routes.py
 M apps/backend/collaboration-service/app/config/settings.py
 M apps/backend/collaboration-service/app/main.py
 M apps/backend/collaboration-service/tests/test_ws_crdt.py  (env isolation fix)
 M docker-compose.yml
 M docs/migration/latest_handoff.md
 M migracion_briefly.md
 M tasks.md
```

## Archivos nuevos (untracked)

```
?? apps/backend/collaboration-service/app/adapters/in_memory_ticket_store.py
?? apps/backend/collaboration-service/app/domain/collab_ticket.py
?? apps/backend/collaboration-service/app/ports/ticket_store.py
?? apps/backend/collaboration-service/app/use_cases/issue_collaboration_ticket.py
?? apps/backend/collaboration-service/app/use_cases/validate_collaboration_ticket.py
?? apps/backend/collaboration-service/tests/test_collab_tickets.py
?? docs/migration/PM-03D-yjs-sync-notes.md
```

**Excluido: `apps/backend/collaboration-service/smoke/`** (node_modules/ + workspace IDs hardcoded)

## Validaciones ejecutadas

```
python -m pytest apps/backend/collaboration-service/tests -v → 55 passed
python -m py_compile routes.py        → OK
python -m py_compile crdt_routes.py   → OK
python -m py_compile main.py          → OK
python -m py_compile issue_collaboration_ticket.py → OK
python -m py_compile validate_collaboration_ticket.py → OK
docker compose config                  → Validated OK (ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=true)
docker compose build collaboration-service → Built OK
curl http://localhost/collab/health -H "X-Shared-Secret: changeme" → 200 OK
curl http://localhost/collab/health → 401 Unauthorized
node smoke/yjs-sync-smoke.mjs → SMOKE PASSED (auth+connection infrastructure)
```

## Tests

**55 passed**

Las 3 fallas originales (PM-03D.2) fueron por contaminación de entorno.
Fix: `test_setting_default_is_false` y `test_crdt_endpoint_not_mounted_by_default` ahora aíslan el entorno con `os.environ.pop("ENABLE_EXPERIMENTAL_CRDT_ENDPOINT", None)` antes de importar Settings.
Los tests no son bugs de código — son tests que leen el entorno real y necesitan aislamiento.

## Resultado Git

```
 M apps/backend/collaboration-service/app/api/crdt_routes.py
 M apps/backend/collaboration-service/app/api/routes.py
 M apps/backend/collaboration-service/app/config/settings.py
 M apps/backend/collaboration-service/app/main.py
 M apps/backend/collaboration-service/tests/test_ws_crdt.py
 M docker-compose.yml
 M docs/migration/latest_handoff.md
 M migracion_briefly.md
 M tasks.md
?? apps/backend/collaboration-service/app/adapters/in_memory_ticket_store.py
?? apps/backend/collaboration-service/app/domain/collab_ticket.py
?? apps/backend/collaboration-service/app/ports/ticket_store.py
?? apps/backend/collaboration-service/app/use_cases/issue_collaboration_ticket.py
?? apps/backend/collaboration-service/app/use_cases/validate_collaboration_ticket.py
?? apps/backend/collaboration-service/tests/test_collab_tickets.py
?? docs/migration/PM-03D-yjs-sync-notes.md
```

**Importante:** `apps/backend/collaboration-service/` tiene archivos en git working tree (M = modificados de commits previos de PM-03C). Los archivos ?? son nuevos locales necesarios para PM-03D ticket auth.

## Riesgos / bloqueos

| Riesgo | Severity | Mitigación |
|---|---|---|
| pycrdt-websocket no es compatible con yjs client-side | ALTO | Hallazgo documentado. Decision gate requerido antes de PM-03E |
| 3 tests fallan por env contamination | BAJO | Código OK; tests leen env real. Fix: aislar Settings en tests |
| smoke/node_modules/ en workspace | BAJO | No commitear node_modules/ |
| workspace/document test-ws/test-doc no existe en Supabase real | MEDIO | Usar workspace real creado para smoke |

## Contrato para la siguiente iteración

**PM-03D.3 — Decision gate sobre estrategia realtime**

Opciones a evaluar:
1. Usar servidor compatible con y-websocket (e.g. y-websocket server en Node.js)
2. Crear translation layer entre pycrdt y yjs wire protocol
3. Usar Hocuspocus (TipTap) solo para Collaboration
4. Adoptar yjs + y-websocket como cliente, pycrdt-websocket como server, con adapter
5. Mantener pycrdt-websocket y usar cliente Python (pycrdt) en lugar de yjs

**NO ejecutar PM-03E todavía.**
PM-03E requiere decisión de arquitectura realtime resuelta.

## Archivos recomendados para commit

### Commit seguro: ticket auth infrastructure

```bash
git add \
  apps/backend/collaboration-service/app/domain/collab_ticket.py \
  apps/backend/collaboration-service/app/ports/ticket_store.py \
  apps/backend/collaboration-service/app/adapters/in_memory_ticket_store.py \
  apps/backend/collaboration-service/app/use_cases/issue_collaboration_ticket.py \
  apps/backend/collaboration-service/app/use_cases/validate_collaboration_ticket.py \
  apps/backend/collaboration-service/app/api/routes.py \
  apps/backend/collaboration-service/app/api/crdt_routes.py \
  apps/backend/collaboration-service/app/config/settings.py \
  apps/backend/collaboration-service/app/main.py \
  apps/backend/collaboration-service/tests/test_collab_tickets.py \
  apps/backend/collaboration-service/tests/test_ws_crdt.py \
  docker-compose.yml \
  docs/migration/PM-03D-yjs-sync-notes.md \
  docs/migration/latest_handoff.md \
  tasks.md \
  migracion_briefly.md
```

**Nota:** Los archivos source viven actualmente en Docker image build context.
Verificar que los archivos locales coincidan con los del build.

### Archivos a excluir del commit

```
apps/backend/collaboration-service/smoke/node_modules/   (NO commitear)
apps/backend/collaboration-service/smoke/yjs-sync-smoke.mjs  (revisar antes — usa workspace/doc IDs de smoke)
```

### Archivos pendientes de verificar

- `tests/test_ws_crdt.py` — ver si los tests de gate pasan sin env contamination
- `apps/backend/collaboration-service/smoke/package.json` — depende de si se quiere el smoke en repo

## Archivos excluidos

```
apps/backend/collaboration-service/smoke/           (NO commitear: node_modules/ + workspace IDs)
.claude/
.mcp.json
**/__pycache__/
*.pyc
.env
```
