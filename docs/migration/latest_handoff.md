# Latest Handoff

## Fase
PM-03B.1 — Auth test hardening

## Objetivo ejecutado
Endurecer tests de auth WebSocket de PM-03B. Tests ahora verifican close codes específicos, tienen test positivo `auth_ok` con fake permission client, y limpian imports no usados.

## Cambios aplicados

### Tests reescritos (`tests/test_ws_auth.py`)
- Tests negativos ahora usan context manager correcto (`with client.websocket_connect(...) as ws`)
- Cada test verifica `WebSocketDisconnect.code` contra el close code esperado:
  - invalid JSON → 4400
  - wrong message type → 4400
  - empty token → 4003
  - missing token → 4003
- Test positivo `auth_ok_ping_pong`: fake permission client + patch en `get_workspace_permissions`
- Test `permission_denied_closes_with_4003`: fake lanza PermissionDenied → verifica 4003
- Test `upstream_unavailable_closes_with_1011`: fake lanza UpstreamUnavailable → verifica 1011
- Test token not leaked: itera sobre todos los mensajes

### Limpieza (`routes.py`)
- Removidos imports no usados: `AuthTimeout`, `InvalidAuthMessage`

## Archivos modificados

```
apps/backend/collaboration-service/tests/test_ws_auth.py  (reescrito)
apps/backend/collaboration-service/app/api/routes.py     (imports)
```

## Validaciones ejecutadas

```
python -m pytest apps/backend/collaboration-service/tests -v
→ 19 passed in 2.36s

python -m py_compile routes.py adapters/workspace_client.py use_cases/authenticate_collaboration.py
→ Syntax OK
```

## Resultado Git

```bash
M apps/backend/collaboration-service/tests/test_ws_auth.py
M apps/backend/collaboration-service/app/api/routes.py
```

## Riesgos restantes
- Tests requieren Docker para validación runtime completa (no blocking)
- PM-03C (pycrdt) aún pendiente

## Próximo paso recomendado
PM-03C — pycrdt-websocket base (después de approval de PM-03B.1)

## Archivos recomendados para commit
```bash
git add \
  apps/backend/collaboration-service/tests/test_ws_auth.py \
  apps/backend/collaboration-service/app/api/routes.py \
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
```
