# Latest Handoff

## Fase
PM-03E.2 (2026-04-26) — Periodic snapshot timer + debounce

## Contexto previo relevante

- **PM-03A:** WebSocket echo endpoint `/collab/echo`
- **PM-03B:** First-message auth estable en `/collab/{ws_id}/{doc_id}`
- **PM-03C:** pycrdt-websocket base experimental con feature flag
- **PM-03D:** Ticket auth + Yjs bidirectional sync verificado
- **PM-03D.5:** Nginx/reconnect hardening — PASS
- **PM-03E.1:** Local CRDT snapshot persistence foundation
- **PM-03E.1.1:** on_disconnect wireado, lifecycle hardening
- **PM-03E.1.2:** Snapshot restore integration fix (documentación corregida)

## Cambios aplicados en PM-03E.2

### Problema resuelto

**"Room orphan sin disconnect"**: cliente hace crash sin enviar disconnect → room queda huérfana en `server.rooms` con `clients == set` → cambios no guardados hasta shutdown.

### Solución implementada

1. **Dirty tracking**: `doc.observe()` callback marca room como dirty cuando hay cambios sin guardar
2. **Periodic snapshot task**: tarea background cada 30s escanea rooms, persiste las dirty
3. **Orphan cleanup**: rooms vacías pasadas grace period (5s) son guardadas y removidas
4. **Active room preservation**: rooms con clientes activos NO se remueven aunque estén vacías de snapshot

### Fields añadidos a PycrdtRoomManager

```python
_room_dirty: dict[str, bool]           # dirty flag por room
_room_empty_since: dict[str, float]     # timestamp cuando quedó vacía
_periodic_task: asyncio.Task | None    # handle de tarea background
_periodic_enabled: bool                 # flag de habilitación
_snapshot_interval: float = 30.0       # intervalo entre snapshots
_empty_room_grace: float = 5.0         # grace period para rooms huérfanas
_doc_subscriptions: dict[str, object]   # observers de pycrdt
```

### Methods añadidos

| Method | Función |
|---|---|
| `_mark_dirty(room_key)` | Marca room como dirty |
| `_mark_clean(room_key)` | Marca room como clean |
| `_is_dirty(room_key)` | Consulta dirty flag |
| `_setup_doc_observer(room_key, ydoc)` | Attaches `doc.observe()` callback |
| `start_periodic_snapshot_task()` | Inicia tarea periódica (idempotente) |
| `stop_periodic_snapshot_task()` | Detiene tarea periódica |
| `run_periodic_snapshot_once()` | Una iteración del snapshot (testeable) |
| `_periodic_snapshot_loop()` | Loop background con sleep |

### Settings añadidos

```python
DOCUMENT_SNAPSHOT_INTERVAL_SECONDS: float = 30.0    # intervalo timer
DOCUMENT_EMPTY_ROOM_GRACE_SECONDS: float = 5.0       # grace para orphan
DOCUMENT_PERIODIC_SNAPSHOT_ENABLED: bool = False     # feature flag
```

## Snapshot Lifecycle (actualizado PM-03E.2)

| Evento | ¿Snapshot guardado? |
|---|---|
| Room creada en on_connect | **SÍ — snapshot cargado via `_ensure_room()`** |
| Último cliente disconnect | **SÍ — vía `handle_disconnect()`** |
| **Orphan (crash sin disconnect)** | **SÍ — vía periodic timer tras grace period** |
| Room con clientes activos + dirty | **SÍ — vía periodic timer (no se remueve)** |
| Service shutdown | **SÍ — lifespan shutdown itera `server.rooms`** |
| `close_room()` manual | **SÍ — save+delete** |

## Garantías actuales

- Dirty rooms con clientes activos son persistidas periódicamente sin ser removidas
- Rooms huérfanas (vacías por crash) son detectadas tras grace period y removidas tras snapshot
- Rooms con todos los clientes desconectados (disconnect normal) son guardadas antes de cleanup
- Snapshot máximo 50 MB — oversized son skippeados
- Escritura atómica (latest.tmp → rename)
- No S3/DynamoDB/boto3

## Qué NO garantiza todavía

- S3/DynamoDB persistence (fase PM-03E futura)
- Reconnect automático sin pérdida de cambios (requiere cliente + server handshake)
- `DOCUMENT_STORE_TYPE=local` en Docker sin bind mount pierde snapshots en restart

## Tests ejecutados

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
  - test_periodic_snapshot.py: 18 tests (NEW in PM-03E.2)
```

**Periodic snapshot tests cubren:**
- Dirty tracking: `_mark_dirty`, `_mark_clean`, `_is_dirty`
- Periodic save: dirty room saved, clean room not rewritten, oversized skipped
- Orphan cleanup: empty beyond grace → saved+removed; empty within grace → kept
- Active room preservation: room with clients NOT removed even if dirty
- Task lifecycle: idempotent start, stop cancels task, stop without start no error
- Doc observer: `_ensure_room` sets up observer, loaded room starts clean

## Validaciones ejecutadas

```
✅ python -m pytest apps/backend/collaboration-service/tests -v → 117 passed
✅ python -m py_compile pycrdt_room_manager.py → OK
✅ python -m py_compile settings.py → OK
✅ python -m py_compile main.py → OK
✅ docker compose config → Validated
✅ docker compose build collaboration-service → Built OK
```

## Resultado Git

```
M apps/backend/collaboration-service/app/adapters/pycrdt_room_manager.py
M apps/backend/collaboration-service/app/config/settings.py
M apps/backend/collaboration-service/app/main.py
M apps/backend/collaboration-service/tests/test_periodic_snapshot.py
M docs/migration/PM-03E-persistence-design.md
M docs/migration/latest_handoff.md
M migracion_briefly.md
M tasks.md
```

## Contrato para la siguiente iteración

**PM-03E: Persistencia S3/DynamoDB** (fase posterior)

- Reemplazar `LocalFileDocumentStore` por DynamoDB + S3
- Mantener `DocumentStore` port para swap sin cambios en room manager
- No modificar interface `RoomManager`
- No romper tests existentes

**PM-03E.2 listo para revisión APEX.**

## Archivos recomendados para commit

```
M apps/backend/collaboration-service/app/adapters/pycrdt_room_manager.py
M apps/backend/collaboration-service/app/config/settings.py
M apps/backend/collaboration-service/app/main.py
A apps/backend/collaboration-service/tests/test_periodic_snapshot.py
M docs/migration/latest_handoff.md          ← post-update
M docs/migration/PM-03E-persistence-design.md  ← post-update
M migracion_briefly.md                    ← post-update
M tasks.md                                ← post-update
```

## Archivos excluidos

```
auditaciones_comandos.txt
.env, *.log, __pycache__/, *.pyc, node_modules/
.claude/
```

## Riesgos restantes

1. **`id(msg)` como channel_id** — No es Channel real de pycrdt. Suficiente para PM-03E.1.x.
2. **`DOCUMENT_STORE_TYPE=local` en Docker** — Sin bind mount, snapshots se pierden en restart.
3. **No S3/DynamoDB** — fase posterior.
