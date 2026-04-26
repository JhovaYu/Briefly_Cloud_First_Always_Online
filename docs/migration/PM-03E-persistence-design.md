# PM-03E.1.2 — Local CRDT Persistence Foundation + Restore Integration

**Date:** 2026-04-26
**Status:** Implementation complete, pending APEX review

## Objetivo

Implementar persistencia local mínima para Collaboration CRDT usando snapshot-only.
Esta fase permite que un documento colaborativo:
1. Guardar snapshot binario del `Doc` CRDT
2. Cargar snapshot al crear una room
3. Sobrevivir a limpieza/recreación de room dentro del servicio

**PM-03E.1.2 corrige la documentación contradictoria de PM-03E.1.1:**
- Restore SÍ funciona via `_ensure_room()` llamado en `on_connect`
- El bug era documentación, no código

## Decisiones de Diseño

### DocumentStore Port

`app/ports/document_store.py` con interfaz mínima:

```python
class DocumentStore(ABC):
    def save(room_key: str, snapshot: bytes) -> None
    def load(room_key: str) -> bytes | None
    def delete(room_key: str) -> None
    def exists(room_key: str) -> bool
```

### Implementaciones

| Adapter | Uso | Persistencia |
|---|---|---|
| `InMemoryDocumentStore` | Tests unitarios | No — diccionario en memoria |
| `LocalFileDocumentStore` | Desarrollo local | Filesystem — `{root}/{workspace_id}/{document_id}/latest.bin` |

### Restricciones Aplicadas

- **NO BaseYStore** — snapshot-only manual
- **NO S3/DynamoDB/boto3** — scope de esta fase
- **NO debounce/timer** — PM-03E.2
- **Path traversal mitigado** — room_key validado con regex `^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$`
- **Escritura atómica** — `latest.tmp` → `latest.bin` rename

### Configuración

```python
DOCUMENT_STORE_TYPE: str = "memory"  # "memory" | "local" | "disabled"
DOCUMENT_STORE_PATH: str = ".data/collab-snapshots"
MAX_SNAPSHOT_BYTES: int = 52_428_800  # 50 MB
```

### PycrdtRoomManager Changes

- `auto_clean_rooms=False` — cleanup manual en disconnect
- `asyncio.Lock` por `room_key` — thread-safe room creation
- `_ensure_room()` — carga snapshot, crea YRoom con ydoc Aplicado, inserta en `server.rooms`
- `_save_and_cleanup()` — guarda snapshot antes de limpiar room
- `set_document_store()` — inyección de store post-construcción
- `track_channel()` / `handle_disconnect()` — cleanup on disconnect

### Snapshot Restore — Cómo funciona

**Ruta real de restore:**

1. Cliente conecta → `on_connect` → `validate_collaboration_ticket()` → `await _ensure_room(ws, doc)`
2. `_ensure_room()`: carga snapshot del DocumentStore, crea Doc, aplica snapshot, crea YRoom(ydoc=doc), inserta en `server.rooms[room_key]`
3. pycrdtinternally calls `server.get_room(room_key)` → encuentra room ya en `server.rooms` → retorna existente (no recrea)
4. YRoom.ydoc YA tiene el snapshot aplicado
5. Cliente recibe sync con contenido restaurado

**Key insight:** `WebsocketServer.get_room()` retorna existente si `name in self.rooms`. Si preinsertamos la room con snapshot, reutiliza esa room sin crear nueva.

### Lifecycle Room

| Evento | ¿Snapshot guardado? |
|---|---|
| Room creada en on_connect | **SÍ — snapshot cargado via _ensure_room** |
| Último cliente disconnect | SÍ — vía handle_disconnect |
| Service shutdown | SÍ — lifespan shutdown itera server.rooms |
| close_room() manual | SÍ — save+delete |

## API Verification Real (pycrdt-websocket v0.16.0)

| Hallazgo | Detalle |
|---|---|
| `WebsocketServer(auto_clean_rooms=False)` | ✅ Funciona — rooms nunca auto-borradas |
| `WebsocketServer.rooms` | ✅ Es `dict[str, YRoom]` — accesible directamente |
| `WebsocketServer.get_room()` | ✅ Retorna existente si ya en rooms, sino crea nueva |
| `YRoom(ready=True/False)` | ✅ Funciona — controla ready event |
| `YRoom.ydoc` | ✅ atributo público, `Doc` instance |
| `YRoom(ydoc=doc)` | ✅ Usa el doc proporcionado, no crea nuevo |
| `room.clients` | ✅ `set()` — removal sincrono en finally de serve() |
| `server.delete_room(name=...)` | ✅ Acepta `name` o `room` como keyword |
| `doc.get_update()` | ✅ Retorna `bytes` de updates desde estado inicial |
| `doc.apply_update(snapshot)` | ✅ Aplica update binario al Doc |
| `ASGIServer(on_disconnect=)` | ✅ Callback: `Callable[[dict], None\|Awaitable[None]]` |

## Tests

```
python -m pytest apps/backend/collaboration-service/tests -v
→ 99 passed in 2.74s ✅
  - test_document_store.py: 19 tests (InMemory + LocalFile)
  - test_room_lifecycle.py: 14 tests (channel tracking, close_room)
  - test_snapshot_restore.py: 11 tests (restore cycle, pre-creation)
  - test_ws_crdt.py: 15 tests
  - test_ws_auth.py: 15 tests
  - test_collab_tickets.py: 19 tests
  - test_ws_echo.py: 6 tests
```

### Snapshot restore tests cover:
- save + delete + recreate + load cycle
- room with existing snapshot loads content before client sync
- room without snapshot creates empty doc
- two rooms maintain independent snapshots
- corrupt snapshot does not crash service
- close_room saves snapshot before deletion

## Validaciones

```
✅ python -m pytest apps/backend/collaboration-service/tests -v → 99 passed
✅ python -m py_compile (todos los archivos)
✅ docker compose config → Validado
✅ docker compose build collaboration-service → Built OK
```

## Git Status Final

```
M  apps/backend/collaboration-service/app/adapters/pycrdt_room_manager.py
M  apps/backend/collaboration-service/app/api/crdt_routes.py
M  apps/backend/collaboration-service/app/config/settings.py
M  apps/backend/collaboration-service/app/main.py
M  docs/migration/latest_handoff.md
M  migracion_briefly.md
M  tasks.md
?? apps/backend/collaboration-service/app/adapters/in_memory_document_store.py
?? apps/backend/collaboration-service/app/adapters/local_file_document_store.py
?? apps/backend/collaboration-service/app/ports/document_store.py
?? apps/backend/collaboration-service/tests/test_document_store.py
?? apps/backend/collaboration-service/tests/test_room_lifecycle.py
?? apps/backend/collaboration-service/tests/test_snapshot_restore.py
?? docs/migration/PM-03E-persistence-design.md
```

## Archivos para Commit

```
A apps/backend/collaboration-service/app/adapters/in_memory_document_store.py
A apps/backend/collaboration-service/app/adapters/local_file_document_store.py
A apps/backend/collaboration-service/app/ports/document_store.py
A apps/backend/collaboration-service/tests/test_document_store.py
A apps/backend/collaboration-service/tests/test_room_lifecycle.py
A apps/backend/collaboration-service/tests/test_snapshot_restore.py
M apps/backend/collaboration-service/app/adapters/pycrdt_room_manager.py
M apps/backend/collaboration-service/app/api/crdt_routes.py
M apps/backend/collaboration-service/app/config/settings.py
M apps/backend/collaboration-service/app/main.py
A docs/migration/PM-03E-persistence-design.md
M docs/migration/latest_handoff.md
M migracion_briefly.md
M tasks.md
```

## Archivos Excluidos

```
auditaciones_comandos.txt
.env, *.log, __pycache__/, *.pyc, node_modules/
```

## Riesgos Restantes

1. **`id(msg)` como channel_id** — No es Channel real de pycrdt. Limitado para debugging. Suficiente para PM-03E.1.x.
2. **Room orphan sin disconnect** — Cliente crash sin disconnect = no snapshot hasta shutdown. PM-03E.2 timer lo resolverá.
3. **`DOCUMENT_STORE_TYPE=local` en Docker** — Sin bind mount, snapshots se pierden en restart.

## Siguiente Paso Recomendado

**PM-03E.2: Debounce/Periodic Save Timer**
- Implementar tarea periódica (30s) que escanee `server.rooms` y persista las que tengan `clients == set`
- Detecta orphan rooms (cliente crash sin disconnect)
- Mejora `id(msg)` → Channel real detection si es viable

## Criterios de Aceptación Cumplidos

- ✅ `DocumentStore` port existe
- ✅ `InMemoryDocumentStore` pasa tests
- ✅ `LocalFileDocumentStore` pasa tests
- ✅ `PycrdtRoomManager` puede cargar snapshot antes de entregar room
- ✅ `PycrdtRoomManager` puede guardar snapshot antes de limpiar room
- ✅ `on_connect` precrea room con snapshot
- ✅ `auto_clean_rooms=False` configurado
- ✅ No se introduce AWS/DynamoDB/boto3
- ✅ No se rompe PM-03D.5
- ✅ Tests Python pasan (99)
- ✅ Docker build pasa
- ✅ NO commit/push realizado
- ✅ Documentación deja de estar contradictoria