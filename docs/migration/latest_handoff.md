# Latest Handoff

## Fase
PM-03C.1 — Security hardening del endpoint CRDT experimental

## Objetivo ejecutado
Aplicar hardening mínimo de seguridad al endpoint CRDT experimental antes de commitear PM-03C.
Se agregó gate ENABLE_EXPERIMENTAL_CRDT_ENDPOINT con default=False (seguro por defecto).
El endpoint `/collab/crdt/{workspace_id}/{document_id}` NO se monta si el flag está en false.

## Cambios aplicados

### ENABLE_EXPERIMENTAL_CRDT_ENDPOINT gate

**settings.py:**
```python
ENABLE_EXPERIMENTAL_CRDT_ENDPOINT: bool = False
```

**main.py:**
```python
if _settings.ENABLE_EXPERIMENTAL_CRDT_ENDPOINT:
    crdt_app, _ = create_crdt_app()
    app.mount("/collab/crdt", crdt_app, name="crdt-ws")
```

**Tests nuevos (TestExperimentalEndpointGate):**
- `test_setting_default_is_false`: Verifica que el default es False
- `test_crdt_endpoint_not_mounted_by_default`: Verifica que /collab/crdt NO se monta cuando flag=False
- `test_crdt_endpoint_mounted_when_flag_true`: Verifica que /collab/crdt SÍ se monta cuando flag=True

## API pycrdt-websocket verificada (v0.16.0)

Import path en Windows: `from pycrdt.websocket import` (namespace issue con `pycrdt_websocket`)

```python
from pycrdt.websocket import WebsocketServer, ASGIServer, YRoom

# WebsocketServer
rooms: dict[str, YRoom]  # rooms en memoria, key = "{ws_id}:{doc_id}"
auto_clean_rooms: bool   # True = borra room cuando último cliente sale
async get_room(name: str) -> YRoom  # crea + inicia room si no existe
async serve(websocket: Channel)  # interno, llamado por ASGIServer

# YRoom
clients: set[Channel]    # clientes conectados
ydoc: Doc                # CRDT document (uno por room)
on_message: Callable[[bytes], Awaitable[bool] | bool] | None  # filtro de mensajes

# ASGIServer
__init__(websocket_server, on_connect=fn, on_disconnect=fn)
# on_connect(scope, receive) -> bool: True=reject, False=accept
# Sirve WebSocket en scope["path"] como room name
```

## Seguridad del endpoint CRDT

**AVISO: `/collab/crdt/{workspace_id}/{document_id}` es EXPERIMENTAL**
- Auth real todavía NO está integrada (on_connect acepta todo en spike)
- NO exponer en producción hasta PM-03D (auth viable)
- Endpoint estable con auth verificada: `/collab/{ws_id}/{doc_id}` (PM-03B)
- No usar JWT en query string

## Fase Scope Clarification

| Phase | Focus | Status |
|---|---|---|
| PM-03C | pycrdt-websocket base, room manager in-memory | ✅ Done |
| PM-03C.1 | Security hardening: ENABLE_EXPERIMENTAL_CRDT_ENDPOINT gate | ✅ Done |
| PM-03D | Yjs sync with two real clients + viable auth | Next |
| PM-03E | Persistence: S3/DynamoDB + snapshots/debounce | Future |

## Archivos modificados/creados

```
apps/backend/collaboration-service/app/config/settings.py       (ENABLE_EXPERIMENTAL_CRDT_ENDPOINT)
apps/backend/collaboration-service/app/main.py                 (conditional mount)
apps/backend/collaboration-service/tests/test_ws_crdt.py      (3 tests nuevos)
```

## Validaciones ejecutadas

```
python -m pytest tests/ -v
→ 35 passed in 2.39s (test_ws_crdt.py: 16, test_ws_auth.py: 15, test_ws_echo.py: 6)

python -m py_compile (todos archivos)
→ Syntax OK

docker compose config
→ Validated OK

docker compose build collaboration-service
→ Built successfully
```

## Resultado Git

```bash
M  apps/backend/collaboration-service/app/config/settings.py
M  apps/backend/collaboration-service/app/main.py
 M  apps/backend/collaboration-service/app/adapters/__init__.py
 M  apps/backend/collaboration-service/app/domain/__init__.py
 M  apps/backend/collaboration-service/app/ports/__init__.py
 M  apps/backend/collaboration-service/requirements.txt
 M  docs/migration/latest_handoff.md
 M  migracion_briefly.md
 M  tasks.md
?? apps/backend/collaboration-service/app/adapters/pycrdt_room_manager.py
?? apps/backend/collaboration-service/app/api/crdt_routes.py
?? apps/backend/collaboration-service/app/domain/collab_room.py
?? apps/backend/collaboration-service/app/ports/crdt_room.py
?? apps/backend/collaboration-service/app/use_cases/join_collaboration_room.py
?? apps/backend/collaboration-service/tests/test_ws_crdt.py
?? docs/migration/PM-03C-pycrdt-api-notes.md
```

## Riesgos restantes
- Endpoint `/collab/crdt` (cuando está habilitado) tiene auth simplificada — solo para testing local
- PM-03D requiere validación con cliente Yjs real para verificar sync completo

## Bloqueos
Ninguno bloqueante. PM-03D requiere cliente Yjs para validación completa.

## Próximo paso recomendado
PM-03D — Yjs sync con auth viable. Persistencia S3/DynamoDB queda para PM-03E.

## Archivos recomendados para commit

```bash
git add \
  apps/backend/collaboration-service/requirements.txt \
  apps/backend/collaboration-service/app/config/settings.py \
  apps/backend/collaboration-service/app/main.py \
  apps/backend/collaboration-service/app/adapters/__init__.py \
  apps/backend/collaboration-service/app/adapters/pycrdt_room_manager.py \
  apps/backend/collaboration-service/app/api/crdt_routes.py \
  apps/backend/collaboration-service/app/domain/__init__.py \
  apps/backend/collaboration-service/app/domain/collab_room.py \
  apps/backend/collaboration-service/app/ports/__init__.py \
  apps/backend/collaboration-service/app/ports/crdt_room.py \
  apps/backend/collaboration-service/app/use_cases/join_collaboration_room.py \
  apps/backend/collaboration-service/tests/test_ws_crdt.py \
  docs/migration/PM-03C-pycrdt-api-notes.md \
  docs/migration/latest_handoff.md \
  tasks.md \
  migracion_briefly.md
```

## Archivos excluidos

```
.claude/
.mcp.json
briefly-architecture-repomix.md
**/__pycache__/
*.pyc
.env
```