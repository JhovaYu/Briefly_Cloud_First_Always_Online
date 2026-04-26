# PM-03D — Yjs Sync Notes

## Objetivo

Validar que dos clientes Yjs puedan sincronizar cambios a través del endpoint CRDT experimental `/collab/crdt/{workspace_id}/{document_id}` usando el sistema de tickets opacos.

## Dependencias usadas

- **yjs** ^13.6.0 — CRDT engine
- **y-websocket** ^1.5.0 — WebSocket provider for Yjs
- **ws** ^8.14.0 — WebSocket client

## Cómo correr el smoke

```bash
cd apps/backend/collaboration-service/smoke
npm install  # instalar dependencias

# En terminal 1: levantar con flag
cd apps/backend/collaboration-service
ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=true python -m uvicorn app.main:app --host 0.0.0.0 --port 8002

# En terminal 2: correr smoke test
cd apps/backend/collaboration-service/smoke
node yjs-sync-smoke.mjs
```

## Variables requeridas

- `SUPABASE_TEST_JWT` — JWT real de Supabase (NO imprimir ni guardar)
- `ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=true` — habilita mount de `/collab/crdt`
- `COLLAB_WS_URL=ws://localhost:8002/collab/crdt` — URL del endpoint CRDT
- `COLLAB_BASE_URL=http://localhost:8002` — URL base para HTTP
- `COLLAB_WORKSPACE_ID` y `COLLAB_DOCUMENT_ID` — IDs del workspace/document a usar

## Cómo obtener SUPABASE_TEST_JWT

En la terminal donde se ejecuta el smoke:
```bash
# Verificar que está cargado:
powershell -Command "if (-not $env:SUPABASE_TEST_JWT) { throw 'No está' }; Write-Host 'Length:' $env:SUPABASE_TEST_JWT.Length"
```

**NO imprimir el token.** Solo verificar longitud.

## Resultado PM-03D.2 (2026-04-26)

### Qué sí funcionó

1. **Ticket endpoint** — `POST /collab/{ws_id}/{doc_id}/ticket` emite tickets opacos reales con HTTP 200. Requiere `Authorization: Bearer <JWT>` válido contra Workspace Service.

2. **WebSocket connection** — Dos clientes WebSocket raw conectan simultáneamente a `/collab/crdt/{ws_id}/{doc_id}?ticket=<opaque>` usando `ws` library. Ambos reciben handshake de aceptación.

3. **Auth flow completo:**
   - Cliente → POST ticket (JWT en header, no query string) → ticket opaco
   - Cliente → WS connect con `?ticket=<opaque>` → on_connect valida → accept
   - JWT no impreso, no loggeado, no en URL

4. **Feature flag** — `ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=false` por defecto. Docker Compose pasa el flag correctamente desde env.

5. **Docker Compose config** — `ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=true` visible en `docker compose config`.

### Qué falló

**Yjs bidirectional sync A→B y B→A — BLOCKED**

pycrdt-websocket (servidor Python) y yjs/y-protocols (cliente JavaScript) usan formatos de mensaje binario estructuralmente incompatibles.

### Evidencia del mismatch

```
pycrdt genera para sync step1 con sv vacío:
  [SYNC_TYPE=0, SYNC_KIND=0 (1 byte fijo), varuint(len=1), data_byte=0]
  = 4 bytes: [0, 0, 1, 0]

yjs/y-protocols writeSyncStep1 genera:
  [SYNC_TYPE=0 (varuint), syncKind=0 (varuint), stateVector_bytes]
  Para sv vacío: [0, 0] (2 bytes)

Server responde [0, 0, 1, 0]
yjs readSyncMessage intenta:
  readVarUint → 0 (sync_type)
  readVarUint → 0 (syncKind)
  readVarUint → 1 (len)
  readVarUint8Array → necesita leer 1 byte pero quedan 0 bytes → "Unexpected end of array"
```

### Impacto

PM-03D **NO puede cerrarse como "Yjs sync real" todavía**.
El endpoint CRDT y el sistema de tickets funcionan.
Pero un cliente yjs no puede sincronizar con el servidor pycrdt.

### Opciones de decisión (para PM-03D.3)

| Opción | Descripción | Complexity |
|---|---|---|
| A | Translation layer entre pycrdt y yjs wire protocol | ALTA — requiere reimplementar sync codec |
| B | Usar servidor y-websocket (Node.js) en lugar de pycrdt-websocket | MEDIA — switch de servidor, yjs client funciona directo |
| C | Usar cliente Python (pycrdt) en lugar de yjs | BAJA — mismo stack, pero limita clientes |
| D | Hocuspocus (TipTap) como servidor de colaboración | MEDIA — requiere evaluación |
| E | Mantener como spike fallido, no continuar realtime | CERO — decision gate puede decidir no continuar |

### Próximo paso recomendado

**PM-03D.3 — Decision gate**
Evaluar opciones A-E antes de invertir en PM-03E (persistencia S3/DynamoDB).

**NO ejecutar PM-03E hasta que la estrategia realtime esté definida.**

---

## Resultado PM-03D.1 (2026-04-25)

```
=== PM-03D Yjs Sync Smoke Test ===

Connecting Client A...
  Client A status: connecting
  Client A status: connecting
  ...
❌ TEST ERROR: Client A connection timeout
```

**Causa:** El endpoint CRDT requiere `ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=true` para estar montado. El smoke usó un ticket hardcodeado `test-ticket-for-local-validation` que no existe en el ticket store.

## Limitaciones conocidas

- El smoke test smoke/node_modules/ NO debe commitearse
- El workspace/document de test debe existir en Workspace Service real
- `one_time=False` por defecto — múltiples clientes pueden compartir ticket (no es riesgo de seguridad)
- pycrdt-websocket yjs sync NO funciona sin adapter de protocolo

## Decisiones registradas

| Fecha | Decisión | Impacto |
|---|---|---|
| 2026-04-25 | Ticket store usa `one_time=False` por defecto | Múltiples clientes pueden compartir ticket |
| 2026-04-25 | on_connect valida ticket de query string | Sin ticket válido, conexión rechazada |
| 2026-04-25 | TTL default 60s | Tickets expiran rápido, requieren re-obtención |
| 2026-04-25 | Header(..., alias="Authorization") | OpenAPI genera header correcto |
| 2026-04-26 | on_connect(msg, scope) — orden de params | pycrdt llama (msg, scope), no (scope, receive) |
| 2026-04-26 | WebsocketServer.start() en lifespan | Servidor necesita start() explícito |
| 2026-04-26 | pycrdt/yjs incompatibilidad de protocolo | Yjs bidirectional sync bloqueado |

## Contrato para siguiente iteración (PM-03D.3)

PM-03D.3 debe:
1. Decision gate sobre estrategia realtime (opciones A-E)
2. NO implementar PM-03E todavía
3. Documentar decisión y causa

PM-03E queda como siguiente fase después de decisión de arquitectura.
