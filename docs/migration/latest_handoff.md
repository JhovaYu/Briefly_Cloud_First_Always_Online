# Latest Handoff

## Fase
PM-03E.1.2 (2026-04-26) — Snapshot restore integration fix

## Contexto previo relevante

- **PM-03A:** WebSocket echo endpoint `/collab/echo`
- **PM-03B:** First-message auth estable en `/collab/{ws_id}/{doc_id}`
- **PM-03C:** pycrdt-websocket base experimental con feature flag
- **PM-03D:** Ticket auth + Yjs bidirectional sync verificado
- **PM-03D.5:** Nginx/reconnect hardening — PASS
- **PM-03E.1.1:** Local CRDT persistence lifecycle hardening (on_disconnect wireado)

## Bug confirmado y corregido

**PM-03E.1.1 tenía una contradicción:** Decía que "room se crea sin snapshot" y que restore "sería en PM-03E.2", pero `_ensure_room()` YA tenía código de restore. La documentación contradecía la implementación.

**Análisis real:**
- `WebsocketServer.get_room()` retorna room existente si ya existe en `self.rooms` — **no recrea**
- Si preinsertamos la room con snapshot en `server.rooms`, `get_room()` la retorna sin crear una nueva
- El restore FUNCIONA si llamamos `_ensure_room()` en `on_connect` ANTES de que pycrdt llame `get_room()`

**Fix aplicado:**
En `on_connect`, después de validar ticket, se llama `await manager._ensure_room(workspace_id, document_id)` para preinsertar la room con snapshot cargado antes de que pycrdt haga `get_room()`.

## Snapshot Lifecycle (correcto)

| Evento | ¿Snapshot guardado? |
|---|---|
| Room creada (get_room) | **SÍ si preinsertada via on_connect** |
| Último cliente disconnect | SÍ — vía handle_disconnect |
| Service shutdown | SÍ — lifespan shutdown itera server.rooms |
| close_room() manual | SÍ — save+delete |

**Ruta de restore en producción:**
1. Cliente conecta → `on_connect` → `validate_collaboration_ticket()` → `await _ensure_room(ws, doc)` → room preinsertada en `server.rooms` con snapshot
2. pycrdtinternally calls `server.get_room(room_key)` → finds room already in `server.rooms` → returns it (no new YRoom created)
3. YRoom.ydoc ya tiene el snapshot aplicado
4. Cliente recibe sync con contenido restaurado

## Tests

```
python -m pytest apps/backend/collaboration-service/tests -v
→ 99 passed in 2.74s ✅
  - test_document_store.py: 19 tests
  - test_room_lifecycle.py: 14 tests
  - test_snapshot_restore.py: 11 tests (NEW in PM-03E.1.2)
  - test_ws_crdt.py: 15 tests
  - test_ws_auth.py: 15 tests
  - test_collab_tickets.py: 19 tests
  - test_ws_echo.py: 6 tests
```

**Snapshot restore tests cover:**
- save + delete + recreate + load cycle
- room with existing snapshot loads content
- room without snapshot creates empty doc
- two rooms maintain independent snapshots
- corrupt snapshot does not crash service
- close_room saves snapshot before deletion

## Validaciones ejecutadas

```
python -m py_compile (todos los archivos modificados/nuevos)
→ All compile OK ✅

docker compose config → Validated ✅
docker compose build collaboration-service → Built OK ✅
```

## Contrato para la siguiente iteración

**PM-03E.2: Periodic timer (debounce)**

- Implementar tarea periódica (30s) que escanee `server.rooms` y persista las que tengan `clients == set`
- Detecta orphan rooms (cliente crash sin disconnect)
- Mejora `id(msg)` → Channel real detection si es viable

**PM-03E.1.2 listo para revisión APEX.**

## Archivos recomendados para commit

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

## Archivos excluidos

```
auditaciones_comandos.txt
.env, *.log, __pycache__/, *.pyc, node_modules/
.claude/
```

## Riesgos restantes

1. **`id(msg)` como channel_id** — No es Channel real de pycrdt. Limitado para debugging. Suficiente para PM-03E.1.x.
2. **Room orphan sin disconnect** — Cliente crash sin disconnect = room sin snapshot hasta shutdown. PM-03E.2 timer lo resolverá.
3. **`DOCUMENT_STORE_TYPE=local` en Docker** — Sin bind mount de `.data/collab-snapshots`, snapshots se pierden en restart.
4. **No periodic timer todavía** — Snapshot solo en disconnect o shutdown. Timer 30s es PM-03E.2.