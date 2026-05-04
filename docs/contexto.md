# Contexto Briefly — Migración Cloud-First (Estado Actual)

## Proyecto
Briefly — aplicación de notas colaborativas en tiempo real.

## Estado actual del sistema
- Arquitectura original: P2P / local-first
- Tecnologías: Yjs + WebRTC + Electron + almacenamiento local
- No existe backend cloud autoritativo implementado
- No existen microservicios desplegados
- Solo existe integración parcial con Supabase Auth

## Objetivo de la migración
Migrar a arquitectura:
- Cloud-first
- Always-online
- Backend autoritativo en AWS
- Compatible con requisitos académicos:
  - AWS Academy Learner Lab
  - Presupuesto: $50 USD
  - 5 microservicios obligatorios
  - Demo de 3 usuarios durante 2 horas

## Arquitectura aprobada (v2.1)

### Infraestructura
- EC2 t3.medium (o superior) como host único
- Docker Compose con 5 microservicios
- Nginx como reverse proxy
- CloudFront como punto de entrada único
- VPC con subred pública (sin NAT Gateway)
- DynamoDB (tablas por servicio)
- S3 (frontend + snapshots)
- Supabase Auth (v1)

### Microservicios
1. Workspace Service
2. Collaboration Service (pycrdt-websocket)
3. Planning Service
4. Intelligence Service
5. Utility Service

### Decisiones críticas
- Backend: Python 3.12 + FastAPI
- Reemplazo de Hocuspocus → pycrdt-websocket
- TLS termina en CloudFront
- EC2 usa HTTP (puerto 80)
- Nginx valida X-Shared-Secret
- Planning NO usa realtime (usa REST + React Query)
- Sin soporte offline soberano en v1

## Documento de arquitectura
Archivo principal:
briefly-architecture-cloud-first-plan-v2.1.md

Este documento define:
- arquitectura completa
- decisiones técnicas
- riesgos
- runbook de demo

## Documento de ejecución
Archivo:
migracion_briefly.md

Define:
- fases de implementación
- checklist por fase
- criterios de aceptación
- runbook operativo
- reglas para agentes

## Herramienta de ejecución
- Claude Code + Minimax M2.7
- Plugins activos:
  - serena
  - feature-dev
  - security-guidance
  - context7
  - pyright-lsp
  - claude-md-management
  - remember
  - typescript-lsp (cuando aplique)
  - playwright (solo fases finales)

## Estado actual de implementación

### PM-08A — Backend CRDT Cloud Smoke (PASS)
**Alcance:** collaboration-service en EC2 + Docker Compose
**Resultado:** SYNC PASS

- `/collab/crdt` montado incondicionalmente (eliminación de `ENABLE_EXPERIMENTAL_CRDT_ENDPOINT`)
- WebSocketRoute vieja eliminada en `routes.py`
- Ticket store movido a `app/infrastructure/ticket_store.py` (neutral singleton)
- `get_ticket_store` importado desde infraestructura en `crdt_routes.py` y `routes.py`
- `ENABLE_EXPERIMENTAL_CRDT_ENDPOINT` eliminado de `settings.py`
- Logs CRDT verbosos (ASGI_SCOPE, PARSED) gateados tras `_CRDT_DIAGNOSTICS=False`
- Security debt PM-09 documentado en `crdt_routes.py` (ticket en query string)
- Debug endpoint `/collab/debug/version` consolidado en `main.py` (app-level only)

** Smoke test Node/y-websocket:**
```
Ticket fetch:     PASS
Provider A:       PASS
Provider B:       PASS
Initial sync:     PASS
A -> B sync:      PASS
B -> A sync:      PASS
SYNC PASS
```

### PM-08B.1 — Desktop CloudYjsProvider Wiring (COMMITTED)
**Alcance:** apps/desktop
**Resultado:** build PASS, manual E2E smoke PASS

- `CloudYjsProvider.ts` spike creado (y-websocket WebsocketProvider wrapper)
- `AppServices.ts` actualizado: cloud mode, fail-fast guard, destroy lifecycle, cache key separation
- `PoolWorkspace.tsx` actualizado: construye `cloudContext` de `cloudWorkspaceId + getAccessToken`
- `App.tsx` actualizado: pasa `getAccessToken` a PoolWorkspace
- `vite.config.ts` actualizado: proxy `/collab` con `ws: true`, `secure: !useCloudProxy`
- `package.json` actualizado: `y-websocket` + `ws` en dependencies
- Fail-fast: lanza error si `COLLAB_USE_CLOUD_PROVIDER=true` pero falta `cloudContext`
- Observabilidad: logs estructurados `{ room, mode }` sin secrets

### PM-08B.2 — Desktop E2E Two-Browser Smoke (PASS)
**Alcance:** localhost + Vite proxy → collaboration-service
**Resultado:** SYNC PASS bidireccional

- Browser A (normal) + Browser B (incognito), misma cuenta, mismo workspace
- Ticket POST `/collab/{workspaceId}/{documentId}/ticket` → 200
- WS `/collab/crdt/{workspaceId}/{documentId}` conectado (101 Switching Protocols)
- Console logs observados:
  - `[AppServices] COLLAB_USE_CLOUD_PROVIDER=true, cloudContext present, using CloudYjsProvider`
  - `[CloudYjsProvider] ticket_fetch attempted`
  - `[CloudYjsProvider] ticket_fetch success`
  - `[CloudYjsProvider] WS connecting`
  - `[CloudYjsProvider] ws_connected`
- Room usada: `{workspaceId}/{documentId}` (mismo valor, smoke de documento único)
- Texto escrito en A → apareció en B ✓
- Texto escrito en B → apareció en A ✓
- Sin fallback a y-webrtc/P2P observado

### PM-08C — Cloud/Local Routing QA (PASS)
**Alcance:** Playwright MCP browser-based validation
**Resultado:** PASS

**Pruebas ejecutadas:**
- Backend health: `/collab/health` → `{"status":"ok"}`, `/collab/debug/version` → `has_mount_collab_crdt: true`
- Local pool `c_post_fix`: `local_pool_detected: true`, `p2p_adapter_used: true`, **no** POST `/collab/c_post_fix/.../ticket`
- Cloud UUID `b9e0369a-574e-40f7-b6b5-385fb1007fcb`: `POST /collab/{uuid}/{uuid}/ticket` → 200, WS connected
- Two-context cloud sync: `sync_A_to_B: PASS`, `sync_B_to_A: PASS`

**Routing observados:**
- Pool arbitrario/local → `YjsWebRTCAdapter` (P2P)
- Cloud workspace UUID → `CloudYjsProvider` (WebSocket)
- Sin mezcla: no se observó P2P para cloud UUID ni cloud POST para pools locales

**Deuda PM-08C:**

| Severidad | Hallazgo |
|-----------|----------|
| 🔴 CRÍTICO | Primera conexión WS devuelve `500 Unexpected response code` en handshake. Retry succeede. Indica posible race condition o límite de conexiones en collaboration-service. |
| 🟡 ALTO | P2P signaling `ws://localhost:4444` siempre unavailable. **Expected behavior** cuando no corre servidor P2P local. No clasificar como fallo cloud. |
| 🟡 ALTO | TipTap: `@tiptap/extension-collaboration` incompatible con `@tiptap/extension-undo-redo`. |
| 🟢 MEDIO | Validar que Nginx production proxy (`wss://briefly.ddns.net/collab/crdt`) rutea igual que Vite dev proxy (`ws://localhost:5173/collab/crdt`). |
| 🔵 BAJO | No había segundo workspace cloud UUID disponible para validar aislamiento entre rooms. |

**Validación sync A↔B (PM-08B.2):**
- Texto escrito en Tab A ("PM08C playwright A") apareció en Tab B ✓
- Texto escrito en Tab B ("PM08C playwright B") apareció en Tab A ✓

### PM-08D — Cloud Workspace Creation from Dashboard (PASS)
**Alcance:** HomeDashboard + App.tsx — creación de workspaces cloud desde UI
**Resultado:** PASS end-to-end

**Implementación:**
- `App.tsx` pasa `workspaceService` + `cloudProviderEnabled` a `HomeDashboard`
- `HomeDashboard` hydrate: `workspaceService.listWorkspaces()` en mount cuando `COLLAB_USE_CLOUD_PROVIDER=true`
- `HomeDashboard.handleCreate`: cloud path llama `workspaceService.createWorkspace(name)` → UUID real
- Error path: si `createWorkspace` falla, **NO** hace fallback a P2P — muestra `role=alert` con mensaje de error
- P2P legacy intacto: cuando `cloudProviderEnabled=false`, crea `pool-*` con `ws://localhost:4444`

**Validación Playwright MCP:**
- Crear workspace "PM08D Playwright 0504A" → `POST /api/workspace/workspaces` → 201 Created
- ID creado: UUID real (`ec064326-1891-4ef7-b201-60c276423b4d`), **no** `pool-*`
- `CloudYjsProvider` activado: `COLLAB_USE_CLOUD_PROVIDER=true, cloudContext present, using CloudYjsProvider`
- Ticket: `POST /collab/{uuid}/{uuid}/ticket` → 200
- WS connected: `ws://localhost:5173/collab/crdt/{uuid}/{uuid}`
- Dashboard en segundo contexto (incógnito): workspace visible **sin añadir manualmente**
- No se observó `pool-*` creado en modo cloud
- Error path: catch sin fallback, `return` temprano, UI error visible

**Commit:** `f83e061 feat(desktop): create cloud workspaces from dashboard`

**Deuda PM-08D / PM-09A:**

| Severidad | Hallazgo |
|-----------|----------|
| 🟡 MEDIO | WS transient failure: primera conexión WebSocket puede cerrarse antes de establecerse ("WebSocket is closed before connection established"), luego reconecta y conecta exitosamente. Race condition conocida en CloudYjsProvider lifecycle. |
| 🔵 BAJO | TipTap: `@tiptap/extension-collaboration` incompatible con `@tiptap/extension-undo-redo`. No bloquea E2E. |
| 🔵 BAJO | `localStorage` puede contener pools legacy viejos (`pool-*`). Limpiar `fluent-pools` manualmente si se quiere reset visual. |
| 🔵 BAJO | Tickets/query strings aparecen en access logs del servidor. PM-09: mover ticket a primer mensaje WebSocket. |

**Próximo paso:** PM-09A — CloudYjsProvider reconnect lifecycle + workspace isolation + TipTap undo-redo fix.

### PM-09A — Cloud CRDT Invalid/Expired Ticket Fix (PASS)
**Alcance:** collaboration-service — evitar HTTP 500 al recibir ticket inválido o expirado
**Resultado:** PASS

**Commits validados:**
- `21bee32` fix(desktop): make cloud websocket connect lifecycle idempotent
- `d193d0a` fix(collab): close CRDT websocket on invalid ticket
- `5095554` fix(collab): restore CRDT websocket disconnect handler

**Validación EC2 logs:**
```
[crdt] APP_CREATED path=/collab/crdt store_type=local marker=pm08a-crdt-debug-v1 pid=1
[crdt] ATTEMPT ... path='/collab/crdt/{uuid}/{uuid}' has_ticket=True
[crdt] DENIED reason=ticket_expired ... has_ticket=True
[crdt] ATTEMPT ... path='/collab/crdt/{uuid}/{uuid}' has_ticket=False
[crdt] DENIED reason=missing_ticket ... has_ticket=False
```
- Sin `ASGI callable returned without sending handshake`
- Sin ERROR logs
- Sin HTTP 500 en logs backend
- Logs seguros: no exponen tickets ni prefijos

**Validación Playwright E2E (workspace `d8ffd0e7-b0ae-4555-b49e-f1b9a8fbf2cf`):**
- `new_workspace_created: true`
- `ticket_status: 200`
- `ws_connected: true`
- `http_500_seen: false`
- `asgi_handshake_error_seen: false`
- `sync_A_to_B: pass`
- `sync_B_to_A: pass`

**Criterios cumplidos:**
- Ticket inválido/expirado no produce 500 en backend
- Ticket ausente no produce 500 en backend
- Workspace cloud nuevo conecta WebSocket exitosamente
- Sync CRDT bidireccional A↔B funciona
- Logs no exponen credentials

**Deuda PM-09A / restante:**

| Severidad | Hallazgo |
|-----------|----------|
| 🟡 MEDIO | WebSocket transient warning ocasional: primera conexión puede cerrarse antes de establecerse ("WebSocket is closed before connection established"), luego reconecta y conecta exitosamente. Race condition conocida en CloudYjsProvider lifecycle. Sin 500, sync PASS — no bloquea. |
| 🔵 BAJO | Ticket en query string (`?ticket=...`). Access logs del servidor contienen tickets. PM-09 plan: mover ticket a primer mensaje WebSocket. |
| 🔵 BAJO | TipTap: `@tiptap/extension-collaboration` incompatible con `@tiptap/extension-undo-redo`. No bloquea sync. |
| 🔵 BAJO | `localStorage` puede contener pools legacy viejos (`pool-*`). Limpiar manualmente si se quiere reset visual. |

**Resultado final:** PASS — El hotfix de `d193d0a` resuelve el crash del backend ante tickets inválidos/expirados. El happy path CRDT sync cloud funciona bidireccionalmente.

### PM-08B Deuda y caveats

ALTO:
- Dashboard/workspace listing: workspace cloud no aparece automáticamente en "Mis grupos";
  requiere añadir pool-id manualmente. Cloud-first dashboard hydration pendiente.

MEDIO:
- TipTap: `@tiptap/extension-collaboration` incompatible con `@tiptap/extension-undo-redo`.
  No bloquea E2E; revisión pendiente.
- React StrictMode: conexiones/desconexiones iniciales observadas, pero ws_connected final
  y sync PASS. Lifecycle/reconnect como deuda PM-09.

BAJO:
- Ticket por query string aparece en access logs del servidor.
  PM-09: mover ticket a primer mensaje WebSocket o redactar access logs.

### PM-09 Plan (pendiente)
- Implementar reconnect automático en CloudYjsProvider (quitar single-attempt mode)
- Mover ticket de query string a primer mensaje WebSocket
- Redactar access logs de tickets
- Per-note document rooms (actualmente workspace-wide)
- React StrictMode lifecycle idempotente
- Resolver TipTap undo-redo incompatibility

## Estado de implementación (histórico)

### PM-01 (Foundation backend)
- Prompt maestro ya enviado a Minimax
- Minimax respondió con:
  - análisis del repo
  - propuesta de estructura
  - identificación de riesgos
  - plan preliminar (con ruido)

### Decisión tomada
No ejecutar implementación todavía.

Se eligió:
- Opción B (refinamiento del plan antes de ejecutar)

### Acción actual (último paso realizado)

Se envió prompt para:

- generar archivo:
  /docs/migration/PM-01-foundation-plan.md

- objetivo:
  refinar plan eliminando ruido y validando decisiones clave

### Estado actual

- Esperando output refinado de Minimax
- No se ha modificado el código aún
- No se ha creado estructura backend todavía

## Reglas activas

- No implementar sin plan aprobado
- No avanzar de fase sin validación
- No introducir complejidad innecesaria
- Priorizar estabilidad de demo sobre pureza arquitectónica
- Diseñar primero, implementar después

## Riesgos actuales

CRÍTICOS:
- Compatibilidad Yjs ↔ pycrdt-websocket (resuelto PM-08A)
- Estabilidad WebSocket detrás de proxy (resuelto PM-08B/B.2)
- Consumo de memoria en EC2

ALTOS:
- configuración Nginx (headers + routing)
- configuración CloudFront WebSocket
- manejo correcto de JWT Supabase

## Siguiente paso esperado

Recibir archivo:
PM-01-foundation-plan.md

Luego:
1. Auditar plan
2. Ajustar si es necesario
3. Aprobar implementación
4. Ejecutar PM-01

## Objetivo inmediato

Lograr:
- backend base levantando en local
- Docker Compose funcional
- Nginx routing correcto
- healthchecks operativos

Sin implementar aún:
- auth
- DynamoDB
- S3
- colaboración real

## Nota final

Este proyecto está en modo:
Hackathon técnico controlado

Prioridad:
- demo estable > arquitectura perfecta
- simplicidad > elegancia innecesaria
- control > automatización excesiva