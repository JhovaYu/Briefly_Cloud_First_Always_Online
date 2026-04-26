# Latest Handoff

## Fase
PM-03D.5 (2026-04-26 retry) — Nginx/reconnect hardening — JWT refrescado, todos los tests PASS

## Contexto previo relevante

- **PM-03A:** WebSocket echo endpoint `/collab/echo`
- **PM-03B:** First-message auth estable en `/collab/{ws_id}/{doc_id}`
- **PM-03C:** pycrdt-websocket base experimental con feature flag
- **PM-03D:** Ticket auth (sistema de tickets opacos) implementado
- **PM-03D.4:** SYNC PASS — bidirectional Yjs sync via WebsocketProvider directo a :8002
- **PM-03D.5 intento previo:** Todos los tests funcionaron pero fallaron en JWT expiry

## Objetivo ejecutado

PM-03D.5 retry con JWT fresco:
1. Smoke directo contra `collaboration-service` :8002
2. Smoke vía Nginx `/collab/crdt`
3. Reconnect directo
4. Reconnect vía Nginx
5. Tests Python + Docker build

## Smoke directo

```
Ticket endpoint:   PASS
Provider A conn:  PASS
Provider B conn:  PASS
A -> B sync:      PASS
B -> A sync:      PASS

SYNC PASS: bidirectional text sync verified
```

**Entorno:**
```
COLLAB_BASE_URL=http://localhost:8002
COLLAB_WS_BASE_URL=ws://localhost:8002/collab/crdt
```

## Smoke vía Nginx

```
Ticket endpoint:   PASS
Provider A conn:  PASS
Provider B conn:  PASS
A -> B sync:      PASS
B -> A sync:      PASS

SYNC PASS: bidirectional text sync via Nginx verified
```

**Entorno:**
```
COLLAB_BASE_URL=http://localhost
COLLAB_WS_BASE_URL=ws://localhost/collab/crdt
SHARED_SECRET=changeme
```

**Archivo:** `yjs-sync-smoke-nginx.mjs` (variante dedicada para Nginx con `X-Shared-Secret` injection en ticket fetch y WebSocket)

**Nota de arquitectura:** El archivo base `yjs-sync-smoke.mjs` NO funciona en modo Nginx debido a dos bugs conocidos:
1. `WORKSPACE_SERVICE_URL` derivation falla cuando `COLLAB_BASE_URL=http://localhost` (el replace `:8002→:8001` no matchea)
2. El fetch del ticket no inyecta `X-Shared-Secret` header (Nginx lo requiere para `/collab/*`)

La variante `yjs-sync-smoke-nginx.mjs` resuelve ambos. Ambos bugs están documentados y no afectan al flujo de producción (el cliente real usa CloudFront que inyecta el header).

## Reconnect directo

```
=== Reconnect Test ===
Destroying Provider B...
Fetching fresh ticket B2 for same room...
Provider B2 reconnected: PASS
B2 sees current state: PASS (textB2="Hello from B")
B2 -> A (reconnect): PASS (textA="Hello from B2")

Provider B2 reconnect: PASS
```

## Reconnect vía Nginx

```
=== Reconnect Test via Nginx ===
Destroying Provider B...
Fetching fresh ticket B2 for same room (via Nginx)...
Provider B2 reconnected: PASS
B2 sees current state: PASS (textB2="Hello from B")
B2 -> A (reconnect): PASS (textA="Hello from B2")

Provider B2 reconnect: PASS
```

## Validaciones ejecutadas

```
python -m pytest apps/backend/collaboration-service/tests -v
→ 55 passed in 2.64s ✅

python -m py_compile routes.py crdt_routes.py main.py settings.py
→ ALL_COMPILED_OK ✅

docker compose config → Validated OK ✅
docker compose build collaboration-service → Built OK ✅

Health checks:
curl http://localhost:8002/health → 200 ✅
curl http://localhost/collab/health -H "X-Shared-Secret: changeme" → 200 ✅
curl http://localhost/collab/health → 401 ✅
curl http://localhost/collab/health -H "X-Shared-Secret: wrong" → 401 ✅
```

## Resultado Git

```
 M apps/backend/collaboration-service/smoke/yjs-sync-smoke.mjs
 M docs/migration/PM-03D-yjs-sync-notes.md
 M docs/migration/latest_handoff.md
 M migracion_briefly.md
 M tasks.md
?? apps/backend/collaboration-service/smoke/yjs-sync-smoke-nginx.mjs
?? auditaciones_comandos.txt
```

## Riesgos / bloqueos

1. **JWT expirará nuevamente** — El `SUPABASE_TEST_JWT` actual expira. Necesitará refresh en futuras iteraciones.

## Contrato para la siguiente iteración

**PM-03E:** Persistencia S3/DynamoDB — siguiente fase activa. PM-03D.5 completo y verificado.

**PM-03D.5 listo para revisión APEX PRIME.**

## Archivos recomendados para commit

```
A apps/backend/collaboration-service/smoke/yjs-sync-smoke-nginx.mjs
M apps/backend/collaboration-service/smoke/yjs-sync-smoke.mjs
M docs/migration/PM-03D-yjs-sync-notes.md
M docs/migration/latest_handoff.md
M migracion_briefly.md
M tasks.md
```

## Archivos excluidos

```
apps/backend/collaboration-service/smoke/node_modules/
apps/backend/collaboration-service/smoke/package-lock.json (en .gitignore)
auditaciones_comandos.txt
.env, *.log, __pycache__/, *.pyc
```
