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
- `COLLAB_WS_BASE_URL=ws://localhost:8002/collab/crdt` — URL del endpoint CRDT
- `COLLAB_BASE_URL=http://localhost:8002` — URL base para HTTP

El smoke crea workspace/document automáticamente si no existen.

## PM-03D.5 — Nginx/reconnect hardening (2026-04-26)

### Objetivo

Validar el camino real de demo para colaboración:
- cliente smoke → Nginx `/collab/crdt` → collaboration-service → pycrdt-websocket
- Reconexión básica del WebsocketProvider

### Cambios implementados

**`yjs-sync-smoke.mjs` — tres modos de operación:**

```bash
# Directo (default):
node yjs-sync-smoke.mjs

# Via Nginx con X-Shared-Secret:
COLLAB_USE_NGINX=true SHARED_SECRET=changeme node yjs-sync-smoke.mjs

# Con reconnect test:
COLLAB_TEST_RECONNECT=true node yjs-sync-smoke.mjs
```

**HeaderWebSocket para inyección de secreto:**

```javascript
class HeaderInjectingWebSocket extends WebSocket {
  constructor(url, protocols) {
    super(url, protocols, {
      headers: { 'X-Shared-Secret': SHARED_SECRET },
    });
  }
}
```

**Flujo reconnect implementado:**

```javascript
// 1. Destruir Provider B
providerB.destroy();

// 2. Obtener ticket fresco B2 para el MISMO room
const rB2 = await getTicket(workspaceId, documentId);
const ticketB2 = rB2.ticket;

// 3. Crear nuevo Y.Doc B2 + Provider B2
providerB = new WebsocketProvider(actualWsBase, `${workspaceId}/${documentId}`, docB2, {
  WebSocketPolyfill: wsClass, params: { ticket: ticketB2 },
});

// 4. Verificar que B2 recibe estado acumulado
// textB2.toString() === "Hello from B"

// 5. B2 escribe texto nuevo → A recibe actualización
docB2.transact(() => { textB2.insert(0, 'Hello from B2'); });
// textA.toString() === "Hello from B2" ✅
```

### Validaciones Nginx

```
curl http://localhost/collab/health -H "X-Shared-Secret: changeme"
→ 200 OK ✅

curl http://localhost/collab/health
→ 401 Unauthorized ✅

curl http://localhost/collab/health -H "X-Shared-Secret: wrong"
→ 401 Unauthorized ✅
```

### Smoke vía Nginx — PASS (2026-04-26 retry)

Con JWT refrescado, el smoke vía Nginx pasa completamente:
- Workspace creation → directo a :8001 (JWT valida OK)
- Ticket fetch → via Nginx con `X-Shared-Secret` header inyectado
- WebSocket sync → via Nginx con `HeaderInjectingWebSocket`

**Archivo dedicado:** `yjs-sync-smoke-nginx.mjs` — variante con `X-Shared-Secret` injection en ticket fetch y reconnect support.

**Bug conocido en `yjs-sync-smoke.mjs` para modo Nginx:** El archivo base NO funciona en modo Nginx debido a:
1. `WORKSPACE_SERVICE_URL` derivation: `HTTP_BASE.replace(':8002', ':8001')` no matchea cuando `COLLAB_BASE_URL=http://localhost`
2. Ticket fetch sin `X-Shared-Secret` header → Nginx retorna 401

Usar `yjs-sync-smoke-nginx.mjs` para pruebas Nginx.

### Arquitectura CloudFront → Nginx → Service

```
Browser/Cliente
    ↓ (no conoce X-Shared-Secret)
CloudFront
    ↓ (inyecta X-Shared-Secret header)
EC2: Nginx (:80)
    ↓ (valida X-Shared-Secret)
    → /collab/* → collaboration-service (:8002)
```

En producción:
- CloudFront inyecta `X-Shared-Secret` hacia EC2/Nginx
- El cliente NO conoce el secret
- El browser no puede setear ese header manualmente

En desarrollo/local:
- El smoke test usa `HeaderInjectingWebSocket` para probar vía Nginx
- El secreto se pasa via `SHARED_SECRET=changeme` env var

### Resultado PM-03D.5 (2026-04-26 retry con JWT fresco)

- Smoke directo: SYNC PASS ✅
- Smoke vía Nginx: SYNC PASS ✅
- Reconnect directo: PASS ✅
- Reconnect vía Nginx: PASS ✅
- Python tests: 55 passed ✅
- Docker build: OK ✅

PM-03D.5 COMPLETO — listo para revisión APEX PRIME.

---

## Contrato para siguiente iteración

**PM-03E — Persistencia S3/DynamoDB** (siguiente fase — no bloqueado)

PM-03D.5:
- Todos los tests PASS ✅
- Documentación actualizada ✅
-listo para commit

**PM-03D.5 listo para APEX PRIME.**

---

## Resultado PM-03D.4 (2026-04-26) — SYNC PASS

**Conclusión:** `pycrdt-websocket` (servidor Python) y `y-websocket` (cliente JS) SON compatibles cuando se usa `WebsocketProvider` correctamente.

### Qué se usó

```javascript
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';

const provider = new WebsocketProvider(
  'ws://localhost:8002/collab/crdt',  // ⚠️ MUST include /collab/crdt prefix
  `${workspaceId}/${documentId}`,      // room name as second arg
  doc,
  {
    WebSocketPolyfill: WebSocket,
    params: { ticket: ticketId },
  }
);
```

### Key finding

**WS_BASE URL debe ser `ws://host/collab/crdt`, no `ws://host/`**

El primer segmento del path se usa como room name en WebsocketProvider.
El segundo segmento (`/collab/crdt`) es el mount point del endpoint ASGI.

Path efectivo: `ws://localhost:8002/collab/crdt/{workspace_id}/{document_id}?ticket=...`

### Resultado smoke

```
Ticket endpoint:   PASS
Provider A conn:  PASS
Provider B conn:  PASS
A -> B sync:      PASS
B -> A sync:      PASS

SYNC PASS: bidirectional text sync verified
```

### Archivos del smoke

```
apps/backend/collaboration-service/smoke/
├── .gitignore           (node_modules/, .env, *.log, package-lock.json)
├── package.json         (yjs ^13.6.0, y-websocket ^1.5.0, ws ^8.14.0)
└── yjs-sync-smoke.mjs   (bidirectional sync test con auto-setup de workspace)
```

### Validaciones

- 55 Python tests: passed
- Ticket endpoint: HTTP 200 con JWT real
- Provider A connects: PASS
- Provider B connects: PASS
- A→B sync: PASS
- B→A sync: PASS
- No JWT printed
- No ticket printed in full

### PM-03D.4 vs PM-03D.2

| Aspecto | PM-03D.2 (falso negativo) | PM-03D.4 (correcto) |
|---|---|---|
| Cliente WS | `ws` raw | `WebsocketProvider` |
| Room name | Manual en URL | Segundo argumento del provider |
| Sync protocol | Parseo manual de bytes | Yjs sync automático via provider |
| WebsocketProvider params | N/A | `{ WebSocketPolyfill, params: { ticket } }` |
| WS_BASE URL | `ws://host/` | `ws://host/collab/crdt` |
| Resultado | "BLOCKED" (falso) | SYNC PASS (correcto) |

---

## Resultado PM-03D.2 (2026-04-26) — FALSO NEGATIVO

**Este resultado fue posteriormente identificado como falso positivo.**

### Qué funcionó

1. **Ticket endpoint** — `POST /collab/{ws_id}/{doc_id}/ticket` emite tickets opacos reales con HTTP 200. Requiere `Authorization: Bearer <JWT>` válido contra Workspace Service.

2. **WebSocket connection** — Dos clientes WebSocket raw conectan simultáneamente a `/collab/crdt/{ws_id}/{doc_id}?ticket=<opaque>` usando `ws` library. Ambos reciben handshake de aceptación.

3. **Auth flow completo:**
   - Cliente → POST ticket (JWT en header, no query string) → ticket opaco
   - Cliente → WS connect con `?ticket=<opaque>` → on_connect valida → accept
   - JWT no impreso, no loggeado, no en URL

4. **Feature flag** — `ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=false` por defecto. Docker Compose pasa el flag correctamente desde env.

### Qué falló (falso)

**Yjs bidirectional sync A→B y B→A — "BLOCKED"**

El smoke PM-03D.2 usó `ws` raw + parseo manual de bytes del protocolo yjs para intentar verificar sync.
Esto reportó incompatibilidad, pero el resultado fue un falso negativo porque:

- `ws` raw no implementa el protocolo de sync de Yjs
- El parseo manual de bytes no representa el comportamiento real de un cliente Yjs
- `WebsocketProvider` de `y-websocket` maneja el protocolo correctamente

### Opciones evaluadas en PM-03D.3 (decision gate)

| Opción | Descripción | Resolution |
|---|---|---|
| A | Translation layer entre pycrdt y yjs wire protocol | NO NECESARIA — ya es compatible |
| B | Usar servidor y-websocket (Node.js) | NO NECESARIA — pycrdt funciona |
| C | Usar cliente Python (pycrdt) | NO NECESARIA — yjs funciona |
| D | Hocuspocus (TipTap) | NO EVALUADA — pycrdt ya funciona |
| E | Abandonar realtime | NO — sync funciona |

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

---

## Limitaciones conocidas

- El smoke test `smoke/node_modules/` NO debe commitearse
- `one_time=False` por defecto — múltiples clientes pueden compartir ticket (no es riesgo de seguridad)
- Workspace/document de test se crean automáticamente via Workspace Service API

## Decisiones registradas

| Fecha | Decisión | Impacto |
|---|---|---|
| 2026-04-25 | Ticket store usa `one_time=False` por defecto | Múltiples clientes pueden compartir ticket |
| 2026-04-25 | on_connect valida ticket de query string | Sin ticket válido, conexión rechazada |
| 2026-04-25 | TTL default 60s | Tickets expiran rápido, requieren re-obtención |
| 2026-04-25 | Header(..., alias="Authorization") | OpenAPI genera header correcto |
| 2026-04-26 | on_connect(msg, scope) — orden de params | pycrdt llama (msg, scope), no (scope, receive) |
| 2026-04-26 | WebsocketServer.start() en lifespan | Servidor necesita start() explícito |
| 2026-04-26 | PM-03D.2 faux negatif — ws raw vs WebsocketProvider | Compatibilidad real confirmada con PM-03D.4 |
| 2026-04-26 | PM-03D.4 SYNC PASS — pycrdt + y-websocket compatibles | PM-03E desbloqueado |

## Contrato para siguiente iteración

**PM-03E — Persistencia S3/DynamoDB** (siguiente fase — no bloqueado)

PM-03D COMPLETO — sync bidireccional verificado con `WebsocketProvider`.

**PM-03D.5 opcional:** Nginx/reconnect hardening si se requiere para producción.