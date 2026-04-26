# PM-03E.2 — Periodic Snapshot Timer + Debounce

**Date:** 2026-04-26
**Status:** Implementation complete, pending APEX review

## Objetivo

Resolver el riesgo "Room orphan sin disconnect": rooms que quedan en `server.rooms` con `clients == set` porque el cliente hizo crash sin enviar mensaje de disconnect —这些 cambios se perderían hasta shutdown.

## Decisiones de Diseño

### Dirty Tracking

pycrdt no tiene API de dirty flag. Implementado via `doc.observe()` callback:

```python
def _setup_doc_observer(self, room_key: str, ydoc: Doc) -> None:
    def on_update(event):
        self._mark_dirty(room_key)
    sub = ydoc.observe(on_update)
    self._doc_subscriptions[room_key] = sub
```

Callback recibe `TransactionEvent` con `update: bytes`. Cada update marca la room como dirty.

### Periodic Snapshot Task

```python
async def run_periodic_snapshot_once(self) -> None:
    for room_key, room in list(self._server.rooms.items()):
        is_empty = len(room.clients) == 0
        is_dirty = self._is_dirty(room_key)

        if is_empty:
            # Empty room
            if is_dirty:
                # Dirty + empty → save + remove
            elif empty_duration >= grace:
                # Empty, not dirty, grace expired → save + remove
        else:
            # Room has active clients
            if is_dirty:
                # Save dirty room but do NOT remove
```

### Orphan Cleanup Logic

| Room state | Action |
|---|---|
| Dirty + empty | Save snapshot, remove room from server |
| Empty + grace expired + not dirty | Save snapshot (if any), remove room |
| Empty + within grace | Keep (waiting for reconnect or dirty) |
| Has clients + dirty | Save snapshot, keep room (active) |
| Has clients + clean | No action |

### Grace Period

`_empty_room_grace = 5.0` segundos. Permite que un cliente que se déconecta brevemente (reconnect rápido) no pierda su room.

### Periodic Config

```python
set_periodic_config(enabled=True, interval=30.0, grace=5.0)
start_periodic_snapshot_task()  # idempotente
stop_periodic_snapshot_task()  # cancela task
```

## API Verification

| Hallazgo | Detalle |
|---|---|
| `doc.observe(callback)` | ✅ Funciona — callback recibe `TransactionEvent` |
| `ydoc.get_update()` | ✅ Retorna `bytes` con todos los updates |
| `asyncio.create_task()` | ✅ Crea tarea background |
| `asyncio.create_task()` en test no-async | ❌ `RuntimeError: no running event loop` — test debe ser `async` |
| Task cancel + `task.result()` | ❌ `InvalidStateError` — no llamar `.result()` en task cancelado |
| `time.monotonic()` | ✅ Clock monotonic para duraciones |

## Config Settings

```python
DOCUMENT_SNAPSHOT_INTERVAL_SECONDS: float = 30.0      # intervalo
DOCUMENT_EMPTY_ROOM_GRACE_SECONDS: float = 5.0         # grace
DOCUMENT_PERIODIC_SNAPSHOT_ENABLED: bool = False      # feature flag
MAX_SNAPSHOT_BYTES: int = 52_428_800                   # 50 MB cap
```

## Lifecycle Room (PM-03E.2)

| Evento | ¿Snapshot guardado? |
|---|---|
| Room creada en on_connect | **SÍ — snapshot cargado via `_ensure_room()`** |
| Último cliente disconnect | **SÍ — vía `handle_disconnect()`** |
| Orphan (crash sin disconnect) | **SÍ — vía periodic timer tras grace period** |
| Room con clientes activos + dirty | **SÍ — vía periodic timer (no se remueve)** |
| Service shutdown | **SÍ — lifespan shutdown itera `server.rooms`** |
| `close_room()` manual | **SÍ — save+delete** |

## Tests

```
python -m pytest apps/backend/collaboration-service/tests -v
→ 117 passed in 2.62s ✅
  - test_document_store.py: 19 tests
  - test_room_lifecycle.py: 14 tests
  - test_snapshot_restore.py: 11 tests
  - test_ws_crdt.py: 15 tests
  - test_ws_auth.py: 15 tests
  - test_collab_tickets.py: 19 tests
  - test_ws_echo.py: 6 tests
  - test_periodic_snapshot.py: 18 tests (NEW)
```

### Periodic snapshot test coverage

**TestDirtyTracking:**
- `_mark_dirty` sets flag
- `_mark_clean` clears flag
- unknown room returns False
- new room starts clean

**TestPeriodicSave:**
- dirty room is saved
- clean room not rewritten
- room with active clients NOT removed (saved if dirty)
- empty room beyond grace saved+removed
- empty room within grace kept
- two dirty rooms both saved
- oversized snapshot skipped
- corrupt snapshot handled

**TestPeriodicTaskLifecycle:**
- start is idempotent (no duplicate tasks)
- stop without start no error
- stop cancels task

**TestDocObserverSetup:**
- `_ensure_room` sets up observer
- room loaded from snapshot starts clean

## Validaciones

```
✅ python -m pytest apps/backend/collaboration-service/tests -v → 117 passed
✅ python -m py_compile (todos los archivos) → OK
✅ docker compose config → Validated
✅ docker compose build collaboration-service → Built OK
```

## Git Status

```
 M apps/backend/collaboration-service/app/adapters/pycrdt_room_manager.py
 M apps/backend/collaboration-service/app/config/settings.py
 M apps/backend/collaboration-service/app/main.py
 M tasks.md
?? apps/backend/collaboration-service/tests/test_periodic_snapshot.py
```

## Archivos para Commit

```
M apps/backend/collaboration-service/app/adapters/pycrdt_room_manager.py
M apps/backend/collaboration-service/app/config/settings.py
M apps/backend/collaboration-service/app/main.py
A apps/backend/collaboration-service/tests/test_periodic_snapshot.py
M docs/migration/latest_handoff.md
M docs/migration/PM-03E-persistence-design.md
M migracion_briefly.md
M tasks.md
```

## Archivos Excluidos

```
auditaciones_comandos.txt
.env, *.log, __pycache__/, *.pyc, node_modules/
```

## Riesgos Restantes

1. **`id(msg)` como channel_id** — No es Channel real de pycrdt. Suficiente para PM-03E.1.x.
2. **`DOCUMENT_STORE_TYPE=local` en Docker** — Sin bind mount, snapshots se pierden en restart.
3. **No S3/DynamoDB** — fase posterior PM-03E.

## Siguiente Paso Recomendado

**PM-03E: Persistencia S3/DynamoDB**
- Reemplazar `LocalFileDocumentStore` por DynamoDB + S3
- Mantener `DocumentStore` port para swap sin cambios en room manager
- No modificar interface `RoomManager`

## Criterios de Aceptación Cumplidos

- ✅ Dirty tracking via `doc.observe()`
- ✅ Periodic snapshot task (30s, idempotente)
- ✅ `run_periodic_snapshot_once()` testeable sin sleeps
- ✅ Orphan cleanup tras grace period
- ✅ Active rooms preservadas (no removidas)
- ✅ Start/stop lifecycle correcto
- ✅ Settings interval/grace/enabled
- ✅ 18 tests nuevos pasando
- ✅ 117 tests total pasando
- ✅ Docker build OK
- ✅ No S3/DynamoDB/boto3
- ✅ NO commit/push realizado
- ✅ Documentación actualizada a PM-03E.2

---

## PM-03E.3 — Docker Local Volume + Runtime Persistence Smoke (2026-04-26) ✅

### Problema resuelto

`DOCUMENT_STORE_TYPE=local` en Docker sin volumen montado pierde snapshots en cada restart del contenedor.

### Solución implementada

1. **Named volume** `collab-snapshots` montado en `/data/collab-snapshots`
2. **`collaboration-service`** recibe env vars: `DOCUMENT_STORE_TYPE=local`, `DOCUMENT_STORE_PATH=/data/collab-snapshots`, `DOCUMENT_PERIODIC_SNAPSHOT_ENABLED=true`
3. **Smoke test dedicado** `yjs-persistence-smoke.mjs` para validación E2E
4. **`.gitignore`** excluye `.data/` y `*.bin`

### docker-compose.yml changes

```yaml
services:
  collaboration-service:
    volumes:
      - collab-snapshots:/data/collab-snapshots
    environment:
      - DOCUMENT_STORE_TYPE=local
      - DOCUMENT_STORE_PATH=/data/collab-snapshots
      - DOCUMENT_PERIODIC_SNAPSHOT_ENABLED=true
      - DOCUMENT_SNAPSHOT_INTERVAL_SECONDS=30
      - DOCUMENT_EMPTY_ROOM_GRACE_SECONDS=5

volumes:
  collab-snapshots:
```

### Validaciones

```
✅ docker compose config → Validated
✅ docker compose build collaboration-service → Built OK
✅ docker compose up -d collaboration-service → Volume created, service started
✅ Container env verified: DOCUMENT_STORE_TYPE=local, DOCUMENT_STORE_PATH=/data/collab-snapshots, DOCUMENT_PERIODIC_SNAPSHOT_ENABLED=true
✅ node --check yjs-persistence-smoke.mjs → OK
✅ python -m pytest apps/backend/collaboration-service/tests -v → 117 passed
```

### Runtime smoke: SKIPPED

Requiere `SUPABASE_TEST_JWT` fresco. Comando manual:

```bash
cd apps/backend/collaboration-service/smoke
npm install
SUPABASE_TEST_JWT=<tu_jwt> node yjs-persistence-smoke.mjs
```

### Trade-off: named volume vs bind mount

| Opción | Ventaja | Desventaja |
|---|---|---|
| **Named volume** (elegida) | Gestionado por Docker, survives recreate | Menos visible en host |
| **Bind mount** | Visible en host filesystem | Requiere path absoluto, menos portable |

### Criterios de Aceptación Cumplidos

- ✅ Named volume `collab-snapshots` montado en `/data/collab-snapshots`
- ✅ `DOCUMENT_STORE_TYPE=local` configurado en Docker
- ✅ `DOCUMENT_PERIODIC_SNAPSHOT_ENABLED=true` en Docker
- ✅ `.data/` y `*.bin` en `.gitignore`
- ✅ `yjs-persistence-smoke.mjs` creado y sintácticamente válido
- ✅ 117 tests passing
- ✅ Docker build OK
- ✅ NO commit/push realizado
- ✅ Documentación actualizada a PM-03E.3
