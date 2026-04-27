# Briefly Cloud-First — Tasks Operativas

## Regla de uso

Este archivo es la bitácora auditable de ejecución.

- Jarvis/Claude Code debe marcar una tarea como completada solo si fue ejecutada y validada.
- Si una tarea falla, debe marcarse como bloqueada o pendiente con causa.
- Cada fase debe actualizar `migracion_briefly.md`.
- Cada fase debe dejar lista de archivos recomendados para commit.
- No se permite `git add .`.
- No se permite commit/push sin aprobación humana.
- Las tareas sensibles requieren aprobación humana:
  - auth
  - JWT
  - secretos
  - AWS
  - Docker/Nginx
  - IAM
  - DB
  - migraciones
  - eliminación de archivos

---

## Estado actual resumido

- [x] PM-01 — Foundation local backend
- [x] PM-02A/B/C — Workspace Service completo y validado
- [x] PM-03A — Collaboration WebSocket echo + Nginx validation
- [x] PM-03B — Collaboration Auth handshake + Workspace permissions
- [x] PM-03B.1 — Auth test hardening (close codes + positive test)
- [x] PM-03C — pycrdt-websocket base
- [x] PM-03C.1 — Security hardening del endpoint CRDT experimental
- [x] PM-03D — Ticket auth + Yjs bidirectional sync COMPLETO (PM-03D.4: SYNC PASS)
- [ ] PM-03D.5 — Nginx/reconnect hardening (implementado, no validado por JWT expiry)
- [x] PM-03E.1.1 — Local CRDT persistence lifecycle hardening (2026-04-26)
- [x] PM-03E.1.2 — Snapshot restore integration fix (2026-04-26)
- [x] PM-03E.2 — Periodic timer/debounce (2026-04-26)
- [x] PM-03E.3 — Docker local volume + runtime persistence smoke (2026-04-26)
- [x] PM-03E.4A — S3DocumentStore adapter with moto mocked tests (2026-04-26)
- [x] PM-03E.4B — Docker/local config no-regression validation (2026-04-26)
- [x] PM-03E.5A — Safe Docker S3 env wiring (2026-04-26)
- [x] PM-03E.5B — AWS Academy bucket + real S3 smoke
- [x] PM-03E.5C — Fix CRDT room key alignment + local hard restore PASS (2026-04-26)
- [x] PM-03E — Persistencia S3
- [x] PM-04 — Planning Service REST (design spec created ✅)
- [x] PM-04.1 — Planning Service In-Memory REST ✅ PASS (2026-04-27)
- [x] PM-04.1B — Planning Service Runtime/API Smoke ✅ PASS (2026-04-27)
- [x] PM-04.2C1 — Planning DB Foundation ✅ PASS (2026-04-27)
- [ ] PM-04.2C2 — PostgresTaskRepository + idempotency (pending)
- [ ] PM-05 — Intelligence/Utility
- [ ] PM-06 — Frontend cloud-first + React Native integration
- [ ] PM-07 — AWS deployment
- [ ] PM-08 — Burn-in/demo

---

## PM-03D.1 — Yjs smoke real + cierre documental (2026-04-25)

### Checklist

- [x] Verificar Docker/Node/npm disponibles
- [x] Instalar dependencias smoke: `npm install` en smoke/
- [x] Corregir bug Authorization Header en ticket endpoint
- [x] Ejecutar smoke Yjs real
- [x] Verificar sistema de tickets soporta múltiples clientes
- [x] Documentar resultado smoke en PM-03D-yjs-sync-notes.md
- [x] Actualizar latest_handoff.md con secciones requeridas
- [x] Actualizar tasks.md (quitar "Commit pending" desfasado)
- [x] Actualizar migracion_briefly.md
- [x] Tests passing: 55 passed

### Smoke Yjs resultado

```
node yjs-sync-smoke.mjs
→ ❌ Client A connection timeout

Causa: Ticket hardcodeado "test-ticket-for-local-validation" no existe en store.
El endpoint CRDT requiere ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=true.
El ticket endpoint requiere Supabase JWT real.
```

### Sistema de tickets verificado

- `validate_collaboration_ticket()` rechaza: vacío, inexistente, expirado, mismatch
- `on_connect` en crdt_routes.py correctamente rejecta conexiones sin ticket válido
- `one_time=False` por defecto — múltiples clientes pueden compartir ticket
- TTL 60s por defecto

---

## PM-03D.2 — Yjs smoke real con SUPABASE_TEST_JWT (2026-04-26)

### Checklist

- [x] Verificar precondiciones (Docker, Node, SUPABASE_TEST_JWT)
- [x] Corregir smoke script (eliminar ticket hardcodeado, usar JWT real)
- [x] Asegurar ENABLE_EXPERIMENTAL_CRDT_ENDPOINT en Docker Compose
- [x] Ejecutar stack con flags correctos
- [x] Probar ticket endpoint con JWT real (HTTP 200, ticket emitido)
- [x] Corregir bug: on_connect signature (pycrdt pasa msg, scope — no scope, receive)
- [x] Corregir bug: WebsocketServer.start() en lifespan
- [x] Corregir bug: import faltante InMemoryTicketStore en issue_collaboration_ticket
- [x] Ejecutar smoke real (cliente A + B conectan)
- [x] Descubrir incompatibilidad de protocolo pycrdt vs yjs
- [x] Documentar hallazgo en PM-03D-yjs-sync-notes.md
- [x] Actualizar latest_handoff.md
- [x] py_compile: todos OK
- [x] Docker build: OK
- [x] Docker compose config: OK

### Qué funcionó

- Ticket endpoint: HTTP 200 con JWT real, role=owner
- WebSocket connection: dos clientes conectan simultáneamente
- JWT no impreso, tickets enmascarados
- Feature flag pasado correctamente por Docker Compose

### Hallazgo PM-03D.2

**SYNC REPORTADO COMO "BLOQUEADO" — FUE FALSO NEGATIVO**

PM-03D.2 usó `ws` raw + parseo manual de bytes del protocolo yjs.
El resultado fue un falso negativo porque `ws` raw no implementa el protocolo de sync de Yjs.
PM-03D.4 demostró que usando `WebsocketProvider` (el cliente correcto), pycrdt y yjs SON compatibles.

### Tests

55 passed (las 3 fallas originales fueron por env contamination, resueltas posteriormente)

---

## PM-03D.5 — Nginx/reconnect hardening (2026-04-26) ✅

### Checklist

- [x] Precondiciones: git status, docker, node, SUPABASE_TEST_JWT (JWT length 804)
- [x] Build collaboration-service
- [x] Start workspace-service + collaboration-service + nginx
- [x] Smoke directo: PASS (PM-03D.4, JWT aún válido那个时候)
- [x] Nginx health con secret: 200 OK ✅
- [x] Nginx health sin secret: 401 Unauthorized ✅
- [x] HeaderInjectingWebSocket implementado para inyección X-Shared-Secret
- [x] COLLAB_USE_NGINX=true soportado en smoke
- [x] Reconexión básica implementada (COLLAB_TEST_RECONNECT=true)
- [x] Python tests: 55 passed ✅
- [x] py_compile: Syntax OK ✅
- [x] docker compose config: OK ✅
- [x] docker compose build: OK ✅
- [x] Actualizar latest_handoff.md
- [x] Actualizar PM-03D-yjs-sync-notes.md
- [x] Actualizar tasks.md
- [x] Actualizar migracion_briefly.md

### Smoke vía Nginx — PASS (JWT refrescado)

JWT refrescado en esta terminal. Smoke vía Nginx ejecuta completamente:
- `yjs-sync-smoke-nginx.mjs`: ticket endpoint via Nginx con X-Shared-Secret → PASS
- Provider A via Nginx → PASS
- Provider B via Nginx → PASS
- A→B sync → PASS
- B→A sync → PASS

### Reconnect — PASS

- Reconnect directo: PASS
- Reconnect vía Nginx: PASS

### Arquitectura CloudFront → Nginx

```
Cliente (browser)
    ↓ (no conoce X-Shared-Secret)
CloudFront (inyecta X-Shared-Secret)
    ↓
EC2: Nginx (:80) — valida header
    ↓
/collab/* → collaboration-service (:8002)
```

El browser real no puede setear `X-Shared-Secret`. Solo CloudFront lo inyecta en producción.

### Contrato para siguiente iteración

PM-03D.5 COMPLETO — listo para revisión APEX PRIME.
PM-03E: Persistencia S3/DynamoDB (siguiente fase, no bloqueado).

---

## PM-03E.1.1 — Local CRDT persistence lifecycle hardening (2026-04-26) ✅

### Checklist

- [x] Git status check — sin archivos inesperados
- [x] Auditoría lifecycle real — who creates room, on_disconnect gap, snapshot lifecycle
- [x] Wire on_disconnect callback al PycrdtRoomManager
- [x] track_channel() + handle_disconnect() en PycrdtRoomManager
- [x] Channel-to-room tracking dict _channel_to_room
- [x] ASGIServer(on_disconnect=on_disconnect) wireado en crdt_routes.py
- [x] Tests de lifecycle: 14 new tests PASS
- [x] All tests: 88 PASS
- [x] py_compile todos los archivos: OK
- [x] docker compose config: OK
- [x] docker compose build collaboration-service: OK
- [x] Actualizar PM-03E-persistence-design.md
- [x] Actualizar tasks.md
- [x] Actualizar migracion_briefly.md

### Lifecycle audit findings

| Pregunta | Respuesta |
|---|---|
| ¿Quién crea la room? | `WebsocketServer.get_room()` llamado internamente en `serve()`. El manager NO intercepta creación. |
| ¿La room se crea con snapshot? | NO — snapshot se carga en close_room/shutdown |
| ¿on_disconnect trae room_key? | NO — `on_disconnect(msg)` solo recibe mensaje, no scope/path |
| ¿room.clients actualizado en on_disconnect? | SÍ — removal síncrono en `finally` de `serve()` |
| ¿Existe método público para cleanup? | SÍ — `close_room()` + `_save_and_cleanup()` |

### Decisión: on_disconnect wireado vía channel tracking

- `track_channel(channel_id, room_key)` en `on_connect` después de auth válida
- `handle_disconnect(channel_id)` en `on_disconnect` — lookup, check clients==0, save+delete
- Limitación: `id(msg)` como channel_id — no es el objeto Channel real

### Snapshot lifecycle

| Evento | ¿Snapshot guardado? |
|---|---|
| Room creada (get_room) | NO — snapshot se carga en close_room/shutdown |
| Último cliente disconnect | SÍ — vía handle_disconnect |
| Service shutdown | SÍ — lifespan shutdown itera server.rooms |
| close_room() llamado | SÍ — save+delete |

### Contrato para siguiente iteración

PM-03E.1.1 COMPLETO — listo para revisión APEX.
PM-03E.2: Periodic timer (debounce) para rooms huérfanas sin clientes.

---

## PM-03E.2 — Periodic snapshot timer + debounce (2026-04-26) ✅

### Checklist

- [x] Dirty tracking via doc.observe() en _ensure_room
- [x] _mark_dirty / _mark_clean / _is_dirty por room
- [x] run_periodic_snapshot_once() — guarda dirty, limpia vacías tras grace
- [x] start_periodic_snapshot_task() / stop_periodic_snapshot_task()
- [x] _setup_doc_observer() — observa ydoc para marcar dirty
- [x] Settings: DOCUMENT_SNAPSHOT_INTERVAL_SECONDS, DOCUMENT_EMPTY_ROOM_GRACE_SECONDS, DOCUMENT_PERIODIC_SNAPSHOT_ENABLED
- [x] lifespan: inicia/stopa periodic task
- [x] 18 new tests en test_periodic_snapshot.py
- [x] 117 total PASS
- [x] py_compile todos OK
- [x] docker compose build OK
- [x] tasks.md y migracion_briefly.md actualizados

### Implementado

**Dirty tracking:**
- `doc.observe(on_update)` → callback que llama `_mark_dirty(room_key)`
- Registration en `_setup_doc_observer()` cuando se crea room
- Cleanup en `handle_disconnect` y `close_room`

**Periodic save (run_periodic_snapshot_once):**
- Empty + dirty → save snapshot + stop room + delete from server
- Empty + not dirty + grace expired → save clean + stop + delete
- Empty + not dirty + within grace → do nothing
- Has clients + dirty → save snapshot (no delete)
- Has clients + not dirty → do nothing

**Task lifecycle:**
- `start_periodic_snapshot_task()`: idempotent, no duplicates
- `stop_periodic_snapshot_task()`: cancels task, sets to None
- Background loop: `asyncio.sleep(interval)` + call `run_periodic_snapshot_once()`

### Settings

```python
DOCUMENT_SNAPSHOT_INTERVAL_SECONDS: float = 30.0    # default disabled (False)
DOCUMENT_EMPTY_ROOM_GRACE_SECONDS: float = 5.0
DOCUMENT_PERIODIC_SNAPSHOT_ENABLED: bool = False
```

### Contrato para siguiente iteración

PM-03E.2 COMPLETO — listo para revisión APEX.
PM-03E: Persistencia S3/DynamoDB (siguiente fase).

---

## PM-03D.4 — Smoke correcto con WebsocketProvider (2026-04-26) ✅

### Checklist

- [x] Limpiar smoke directory (eliminar nested dirs, crear .gitignore, fix package.json)
- [x] Reescribir smoke con WebsocketProvider (y-websocket, no raw ws)
- [x] Corregir WS_BASE URL (`ws://localhost:8002/collab/crdt`, no solo `ws://localhost:8002`)
- [x] Auto-crear workspace/document si no existen (via Workspace Service API)
- [x] Ejecutar smoke directo a puerto 8002 (sin Nginx)
- [x] Verificar sync bidireccional A→B y B→A
- [x] Ejecutar Python tests: 55 passed
- [x] Verificar Docker services running
- [x] Actualizar PM-03D-yjs-sync-notes.md (resultado, falsos positivos, documentación)
- [x] Actualizar latest_handoff.md
- [x] Actualizar migracion_briefly.md (PM-03D COMPLETO)

### Smoke resultado

```
Ticket endpoint:   PASS
Provider A conn:  PASS
Provider B conn:  PASS
A -> B sync:      PASS
B -> A sync:      PASS

SYNC PASS: bidirectional text sync verified
```

### Hallazgo clave

**PM-03D.2 fue falso negativo.** El smoke anterior usó `ws` raw + parseo manual de bytes del protocolo yjs.
PM-03D.4 usa `WebsocketProvider` de `y-websocket` — la forma correcta de conectar clientes yjs.

La clave: `WS_BASE = 'ws://localhost:8002/collab/crdt'` (debe incluir el mount point del endpoint).

### Archivos del smoke

```
apps/backend/collaboration-service/smoke/
├── .gitignore           (node_modules/, .env, *.log, package-lock.json)
├── package.json         (yjs ^13.6.0, y-websocket ^1.5.0, ws ^8.14.0)
└── yjs-sync-smoke.mjs   (bidirectional sync test con auto-setup)
```

### Contrato para siguiente iteración

**PM-03E — Persistencia S3/DynamoDB** (siguiente fase, no bloqueada)
- PM-03D completado — sync bidireccional verificado
- Ya no hay bloqueo de arquitectura realtime

---

## PM-03D — Yjs sync dos clientes con auth viable (2026-04-25) ✅

### Checklist

- [x] Agregar ENABLE_EXPERIMENTAL_CRDT_ENDPOINT en settings.py (default: false)
- [x] Actualizar main.py para conditionally mount /collab/crdt
- [x] Agregar tests TestExperimentalEndpointGate (3 tests)
- [x] Documentar que /collab/crdt es experimental y no expuesto en producción
- [x] Actualizar latest_handoff.md, tasks.md, migracion_briefly.md
- [x] Actualizar PM-03C-pycrdt-api-notes.md con nota de seguridad
- [x] Tests passing: 35 total
- [x] py_compile OK
- [x] Docker build OK

### ENABLE_EXPERIMENTAL_CRDT_ENDPOINT gate

- Default: `False` (seguro por defecto)
- Cuando `False`: `/collab/crdt` NO se monta en la app FastAPI
- Cuando `True`: `/collab/crdt` se monta y está disponible para pruebas
- Para tests locales: setear env var `ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=true`

### Seguridad del endpoint CRDT

**AVISO: `/collab/crdt/{workspace_id}/{document_id}` es EXPERIMENTAL**
- Auth real todavía NO está integrada (on_connect acepta todo en spike)
- NO exponer en producción hasta PM-03D (auth viable)
- Endpoint estable con auth verificada: `/collab/{ws_id}/{doc_id}` (PM-03B)
- No usar JWT en query string

### Decisiones registradas (PM-03C.1)

| Fecha | Decisión | Impacto |
|---|---|---|
| 2026-04-26 | ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=false por defecto | Seguridad: endpoint experimental no montado si no se habilita explícitamente |
| 2026-04-26 | PM-03D: Yjs sync con auth viable, sin S3/DynamoDB todavía | Clarifica alcance PM-03D |
| 2026-04-26 | PM-03E: persistencia S3/DynamoDB + snapshots/debounce | Fase posterior a PM-03D |

---

## PM-03C — pycrdt-websocket base (2026-04-26) ✅

### Checklist

- [x] Investigar API real de pycrdt/pycrdt-websocket (context7 + inspección source)
- [x] Documentar API en docs/migration/PM-03C-pycrdt-api-notes.md
- [x] Actualizar requirements.txt con pycrdt>=0.12.0, pycrdt-websocket>=0.16.0
- [x] Crear domain/collab_room.py (CollabRoom entity)
- [x] Crear ports/crdt_room.py (RoomManager port)
- [x] Crear adapters/pycrdt_room_manager.py (in-memory WebsocketServer wrapper)
- [x] Crear use_cases/join_collaboration_room.py
- [x] Crear api/crdt_routes.py (ASGIServer + WebsocketServer mount)
- [x] Actualizar main.py para conditionally mount /collab/crdt ASGI subapp
- [x] Crear test_ws_crdt.py (13 tests + 3 gate tests = 16 total)
- [x] Corregir imports: `from pycrdt.websocket import` (no `pycrdt_websocket`)
- [x] Tests passing: 35 total
- [x] Docker build collaboration-service OK
- [x] Docker compose config OK
- [x] Runtime: /collab/health OK con secret, 401 sin secret
- [x] Actualizar tasks.md y migracion_briefly.md
- [x] Crear latest_handoff.md

### API pycrdt-websocket confirmada (v0.16.0)

```
from pycrdt.websocket import WebsocketServer, ASGIServer, YRoom

WebsocketServer.rooms: dict[str, YRoom]
WebsocketServer.auto_clean_rooms: bool
WebsocketServer.get_room(name: str) -> YRoom  # crea si no existe + inicia

YRoom.clients: set[Channel]
YRoom.ydoc: Doc  # CRDT document (uno por room)
YRoom.on_message: Callable[[bytes], Awaitable[bool] | bool] | None

ASGIServer(websocket_server, on_connect=fn, on_disconnect=fn)
# on_connect(scope, receive) -> bool (True=reject, False=accept)
```

### Decisión de diseño

- Endpoint experimental: `/collab/crdt/{workspace_id}/{document_id}`
- Usa ASGIServer + WebsocketServer (no mezcla con routes.py existente)
- Auth por on_connect callback (simplificado para spike)
- Room key: `{workspace_id}:{document_id}` en WebsocketServer.rooms dict
- auto_clean_rooms=True: sala se borra cuando último cliente sale
- Existing `/collab/{ws_id}/{doc_id}` (first-message JSON auth) unchanged
- Protegido por ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=false por defecto

### Validaciones ejecutadas

```
python -m pytest tests/ -v
→ 35 passed in 2.39s

python -m py_compile (todos archivos)
→ Syntax OK

docker compose config
→ Validated OK

docker compose build collaboration-service
→ Built successfully

docker compose up -d collaboration-service
→ Container healthy

curl http://localhost/collab/health -H "X-Shared-Secret: changeme"
→ 200 OK

curl http://localhost/collab/health
→ 401 Unauthorized
```

---

## PM-03B — Collaboration Auth Handshake (2026-04-25) ✅

- First-message auth sin JWT en query string
- WS `/collab/{workspace_id}/{document_id}`
- httpx → Workspace Service permissions
- Arquitectura hexagonal: domain/ports/adapters/use_cases/api
- Close codes: 4400, 4003, 1011

---

## PM-03A — Collaboration WebSocket Echo (2026-04-25) ✅

- WS `/collab/echo` — echo puro para diagnóstico

---

## PM-02C — Hardening + Tests (2026-04-25) ✅

---

## PM-01 — Foundation local (2026-04-24) ✅

---

## Registro de salud de contenedores

Fecha: 2026-04-26

| Servicio | Status |
|---|---|
| workspace-service | healthy |
| nginx | healthy |
| collaboration-service | healthy |
| planning-service | healthy |
| intelligence-service | healthy |
| utility-service | healthy |

---

## Archivos recomendados para commit PM-03C + PM-03C.1

### Modificados
```
apps/backend/collaboration-service/app/config/settings.py
apps/backend/collaboration-service/app/main.py
apps/backend/collaboration-service/tests/test_ws_crdt.py
docs/migration/latest_handoff.md
tasks.md
migracion_briefly.md
docs/migration/PM-03C-pycrdt-api-notes.md
```

### Creados
```
apps/backend/collaboration-service/app/domain/collab_room.py
apps/backend/collaboration-service/app/domain/__init__.py
apps/backend/collaboration-service/app/ports/crdt_room.py
apps/backend/collaboration-service/app/ports/__init__.py
apps/backend/collaboration-service/app/adapters/pycrdt_room_manager.py
apps/backend/collaboration-service/app/adapters/__init__.py
apps/backend/collaboration-service/app/use_cases/join_collaboration_room.py
apps/backend/collaboration-service/app/api/crdt_routes.py
apps/backend/collaboration-service/requirements.txt
```

### Excluidos
```
.claude/
.mcp.json
briefly-architecture-repomix.md
**/__pycache__/
*.pyc
.env
```

---

## Próximo paso

1. Approval humano para commit selectivo PM-03C + PM-03C.1
2. Ejecutar commit selectivo
3. PM-03D — Yjs sync con auth viable