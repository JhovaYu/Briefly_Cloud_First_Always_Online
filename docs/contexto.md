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

### PM-10A.1 — Workspace-Service Postgres Persistence (PASS)
**Alcance:** workspace-service — persistir workspaces y memberships en Postgres
**Commit:** `485f731` feat(workspace-service): persist workspaces and memberships in Postgres
**Resultado:** PASS

**Implementación:**
- `SQLAlchemyWorkspaceRepository` + `SQLAlchemyMembershipRepository` en `app/adapters/persistence/sqlalchemy_repo_impl.py`
- `WorkspaceModel` + `MembershipModel` en `app/adapters/persistence/sqlalchemy_repositories.py`
- Tablas `workspaces` y `workspace_memberships` creadas idempotente via `Base.metadata.create_all` en lifespan startup
- Wiring condicional en `app/api/dependencies.py`: si `WORKSPACE_STORE_TYPE=postgres` y `WORKSPACE_DATABASE_URL` configurado → SQLAlchemy repos; si no → fallback in-memory
- Fail-fast: `RuntimeError` si `WORKSPACE_STORE_TYPE=postgres` pero falta `WORKSPACE_DATABASE_URL`
- Deuda transaccional documentada en `create_workspace.py`: workspace + membership en operaciones separadas

**Validación Playwright EC2:**
- Workspace creado: `c0515994-a7d9-476d-b781-0339f934ca8a` ("PM10A Persistence QA")
- `POST /collab/{uuid}/{uuid}/ticket` → 200 antes y después del restart
- WS connected antes y después del restart
- `docker compose -f docker-compose.ec2.yml restart workspace-service` → workspace sigue visible en dashboard
- CloudYjsProvider reconecta correctamente post-restart

**Criterios cumplidos:**
- Workspaces sobreviven restart de workspace-service
- Memberships sobreviven restart de workspace-service
- Fallback in-memory funciona si Postgres no está disponible
- Fail-fast en producción si configured incorrectly

**Deuda PM-10A.1 / restante:**

| Severidad | Hallazgo |
|-----------|----------|
| 🟡 MEDIO | Workspace + membership en operaciones separadas — si membership creation falla post workspace creation, queda orphan workspace. PM-10A.2: Unit of Work / rollback cleanup. |
| 🟡 MEDIO | Alembic migration no existe para `workspaces`/`workspace_memberships` — `create_all` usado al startup. Aceptable para MVP académico; Alembic migration recomendada antes de producción. |
| 🔵 BAJO | Transient WebSocket warning ("WebSocket closed before connection established") en primera conexión — retry succeede, no bloquea. |
| 🔵 BAJO | TipTap: `@tiptap/extension-collaboration` incompatible con `@tiptap/extension-undo-redo`. No bloquea sync. |

**Próximo paso:** PM-10B — Mobile Today Dashboard REST discovery / Mobile Cloud Sync + Widgets.

### PM-10B.1a — Backend Date Filters for Mobile Today Dashboard (PASS)
**Alcance:** planning-service + schedule-service — filtros opcionales `date` por YYYY-MM-DD
**Resultado:** PASS

**Commits registrados:**
- `8a053ec` feat(mobile): add date filters for planning and schedule APIs
- Hotfix: fix(api): return 400 for invalid date filters

**Implementación:**

| Servicio | Endpoint | Query param |
|---|---|---|
| planning-service | `GET /api/planning/workspaces/{workspace_id}/tasks` | `?date=YYYY-MM-DD` (opcional) |
| schedule-service | `GET /api/schedule/workspaces/{workspace_id}/schedule-blocks` | `?date=YYYY-MM-DD` (opcional) |

**Contrato:**
- `date` omitido → devuelve todos los registros (backward compatible)
- `date=YYYY-MM-DD` → filtra por fecha correspondiente
- `date=invalid` → `400 Bad Request`, body `{"detail":"Invalid date format. Expected YYYY-MM-DD"}`
- `date=2026-13-45` → `400 Bad Request` ( ValueError de `fromisoformat` capturado)

**planning-service cambios:**
- `app/use_cases/task_use_cases.py`: `list_tasks(..., due_date)` — filtro `due_date.date() == filter_date`
- `app/api/routes.py`: query param `date`, validación `try/except ValueError` → 400

**schedule-service cambios:**
- `app/use_cases/schedule_use_cases.py`: `list_schedule_blocks_for_date(date)` — convierte YYYY-MM-DD → `day_of_week` via `.weekday()`
- `app/use_cases/__init__.py`: export `list_schedule_blocks_for_date`
- `app/api/routes.py`: query param `date`, validación `try/except ValueError` → 400

**Validación producción (workspace `c0515994-a7d9-476d-b781-0339f934ca8a`):**

| Endpoint | Status | Body |
|---|---|---|
| `GET /tasks?date=2026-05-04` | 200 | `{"tasks":[]}` |
| `GET /tasks` (sin date) | 200 | `{"tasks":[]}` |
| `GET /tasks?date=bad-date` | 400 | `{"detail":"Invalid date format. Expected YYYY-MM-DD"}` |
| `GET /schedule-blocks?date=2026-05-04` | 200 | `{"blocks":[]}` |
| `GET /schedule-blocks` (sin date) | 200 | `{"blocks":[]}` |
| `GET /schedule-blocks?date=bad-date` | 400 | `{"detail":"Invalid date format. Expected YYYY-MM-DD"}` |

**Criterios cumplidos:**
- Fecha válida → 200, backward compatible
- Fecha omitida → 200, todos los registros
- Fecha inválida → 400, sin stacktrace
- Auth Bearer JWT intacto en ambos endpoints
- Membership validation via workspace-service intacta
- No se exponen datos de otros workspaces

**Deuda PM-10B.1a / restante:**

| Severidad | Hallazgo |
|-----------|----------|
| 🟡 MEDIO | Schedule usa `day_of_week` derivado de fecha UTC — si mobile está en zona horaria diferente, puede mostrar blocks del día anterior/siguiente. Aceptable para MVP; día local como mejora futura. |
| 🟡 MEDIO | No existe endpoint `?state=pending` para filtrar tasks por estado. Mobile filtra client-side o Posterizado. No bloquea MVP. |
| 🔵 BAJO | No hay index en `due_date` para filtering eficiente. Aceptable para MVP (datasets pequeños). |
| 🔵 BAJO | Mobile React Query / API wiring queda para PM-10B.1b. |

**Nginx upstream temporal (observado durante deploy):**

| Observación | Detalle |
|---|---|
| Síntoma | `/api/planning/*` y `/api/schedule/*` devolvían 502 tras restart de servicios |
| `/planning/health` y `/schedule/health` | 200 (ruta directa, sin upstream) |
| `/api/planning/health` y `/api/schedule/health` | 502 (upstream no disponible) |
| Mitigación | `docker compose -f docker-compose.ec2.yml restart nginx` resolvió |
| Root cause probable | Nginx upstream guardando IP antigua tras restart de contenedores |
| Deuda futura | Configurar `resolver 127.0.0.11 valid=10s;` + variable upstream para re-resolución dinámica |

**Próximo paso:** PM-10B.1c — Migrar useTodaySummary a hooks REST con date filter.

### PM-10B.1b — Mobile React Query Foundation (PASS)
**Alcance:** apps/mobile — React Query v5 + fetchWithAuth + hooks REST para Today Dashboard
**Resultado:** PASS

**Commits registrados:**
- `55f55ff` feat(mobile): add React Query API foundation
- `6163443` fix(mobile): align React Query focus and hook signatures

**Implementación:**

| Archivo | Cambio |
|---|---|
| `apps/mobile/package.json` | `@tanstack/react-query` agregado |
| `apps/mobile/src/lib/queryClient.ts` | QueryClient singleton, staleTime 5min, gcTime 30min, retry 2, `focusManager.setEventListener` para AppState |
| `apps/mobile/src/api/fetchWithAuth.ts` | Fetch wrapper con `supabase.auth.getSession()` por request, Bearer inject, 401/403 throw |
| `apps/mobile/src/hooks/useWorkspaces.ts` | useQuery `['workspaces']`, `fetchWorkspacesWithAuth` |
| `apps/mobile/src/hooks/useTasks.ts` | useQuery `['tasks', wsId, date]`, `fetchTasksWithDate`, enabled !!wsId |
| `apps/mobile/src/hooks/useSchedule.ts` | useQuery `['schedule', wsId, date]`, `fetchScheduleBlocksWithDate`, enabled !!wsId |
| `apps/mobile/src/services/planningClient.ts` | Export `fetchTasksWithDate(wsId, date?)` con fetchWithAuth |
| `apps/mobile/src/services/scheduleClient.ts` | Export `fetchScheduleBlocksWithDate(wsId, date?)` con fetchWithAuth |
| `apps/mobile/src/services/workspaceClient.ts` | Export `fetchWorkspacesWithAuth()` con fetchWithAuth |
| `apps/mobile/app/_layout.tsx` | `QueryClientProvider` envuelve `AuthProvider` |
| `apps/mobile/src/services/AuthContext.tsx` | `queryClient.clear()` en `signOut()` |

**Hotfix post-commit:**
- Reemplazado `queryClient.invalidateQueries()` global por `focusManager.setEventListener` oficial
- Eliminados parámetros `getAccessToken` no usados de `useTasks` y `useSchedule`

**Criterios cumplidos:**
- `@tanstack/react-query` instalado sin romper expo-doctor preexistente
- `QueryClientProvider` montado antes de `SafeAreaProvider`
- `fetchWithAuth` obtiene token fresco via `getSession()` por cada request
- `useWorkspaces/useTasks/useSchedule` con query keys correctas
- Hooks no reciben `getAccessToken` (auth via fetchWithAuth)
- `queryClient.clear()` llamado en logout
- `focusManager` usa `handleFocus(true)` patrón oficial, no `invalidateQueries()` global
- tsc `--noEmit`: **0 errors**
- `today.tsx` no modificado
- `useTodaySummary` no modificado
- `@tuxnotas/shared` no modificado

**Deuda PM-10B.1b / restante:** ninguna (PM-10B.1c completo en `7fa6655`)

**Próximo paso:** PM-10C — Join workspace / membership A→B.

### PM-10B.1c — Today Dashboard React Query Migration (PASS)
**Alcance:** `apps/mobile` — migrar `useTodaySummary` de useState/manual fetch a React Query hooks con date filter local
**Resultado:** PASS

**Commits registrados:**
- `7fa6655` feat(mobile): use date-filtered React Query data in Today

**Implementación:**

| Archivo | Cambio |
|---|---|
| `apps/mobile/src/utils/dateUtils.ts` | Creado — `getLocalDateString()` usando `getFullYear()/getMonth()+1/getDate()` (local, NO UTC) |
| `apps/mobile/src/hooks/useTodaySummary.ts` | Reescrito — usa `useWorkspaces/useTasks/useSchedule` con `date=YYYY-MM-DD` local; mismo shape de retorno |
| `apps/mobile/app/today.tsx` | Removido `useAuth` import y `getAccessToken` — ahora llama `useTodaySummary()` sin args |

**Diseño clave:**
- `getLocalDateString()` → `YYYY-MM-DD` basado en hora LOCAL del dispositivo, nunca UTC
- `useTodaySummary` combina `isLoading` de 3 queries en `loading` único
- Primer error convertido a `string` para el campo `error`
- `refresh()` usa `queryClient.invalidateQueries()` para los 3 query keys
- Mismo shape de retorno: `{ loading, error, refresh, nextScheduleBlock, pendingTasksCount, topTasks, workspaceName }`

**Criterios cumplidos:**
- `today.tsx` no necesita cambios de UI (hook mantiene contrato original)
- Fecha local del dispositivo usada, NO `toISOString()`
- `?date=YYYY-MM-DD` enviado al backend con día LOCAL
- tsc `--noEmit`: **0 errors**
- No backend modificado
- No widgets/modales/crud cambiados

**Deuda PM-10B.1c / restante:** nenhuma (completo)

### PM-10B.2 — Mobile Active Workspace + CRUD Invalidation (PASS)
**Alcance:** `apps/mobile` — persistir workspace activo + invalidar React Query tras mutaciones CRUD
**Resultado:** PASS

**Commits registrados:**
- `c417f9e` feat(mobile): persist active workspace selection
- `989cdb4` fix(mobile): invalidate Today queries after CRUD mutations

**Implementación — PM-10B.2a (activeWorkspaceId persistido):**

| Archivo | Cambio |
|---|---|
| `apps/mobile/src/services/activeWorkspaceStore.ts` | Creado — `getActiveWorkspaceId/setActiveWorkspaceId/clearActiveWorkspaceId` via SecureStore |
| `apps/mobile/src/hooks/useActiveWorkspace.ts` | Creado — lee ID persistido, valida contra workspaces list, fallback a `workspaces[0]`, expone `setActiveWorkspace` |
| `apps/mobile/src/hooks/useTodaySummary.ts` | Actualizado — usa `useActiveWorkspace` en vez de `workspaces?.[0]?.id` directo |
| `apps/mobile/app/workspaces.tsx` | Actualizado — long-press establece activo; badge "Activo" en workspace seleccionado; hint "Mantén presionado para usar en Hoy" |

**Diseño — fallback de workspace activo:**
```
stored ID existe en workspaces list? → YES → usar stored
        ↓ NO
clear stored ID → fallback a workspaces[0]
        ↓
workspaces[0] existe? → YES → usarlo
        ↓ NO
return null → useTasks/useSchedule disabled (enabled: false)
```

**Implementación — PM-10B.2b (CRUD invalidation):**

| Archivo | Cambio |
|---|---|
| `apps/mobile/app/tasks.tsx` | `queryClient.invalidateQueries({ queryKey: ['tasks'] })` tras create/update/delete exitosos |
| `apps/mobile/app/schedule.tsx` | `queryClient.invalidateQueries({ queryKey: ['schedule'] })` tras create/update/delete exitosos |

**Criterios cumplidos:**
- activeWorkspaceId persiste entre reinicios (SecureStore)
- Workspaces screen permite seleccionar activo con long-press
- Today usa workspace activo, no siempre `workspaces[0]`
- Fallback seguro si stored ID ya no existe o no hay workspaces
- Tasks/schedule CRUD invalida queries — Today recibe datos frescos tras mutaciones
- tsc `--noEmit`: **0 errors**
- No backend/desktop/@tuxnotas/shared/package cambios

**Deuda PM-10B.2 / restante:**

| Severidad | Hallazgo |
|-----------|----------|
| 🟡 MEDIO | PM-10B.2 follow-up: `queryClient.clear()` debería llamarse en `finally` de `signOut` para asegurar limpieza incluso si `auth.signOut()` lanza |
| 🟡 MEDIO | PM-10B.2 follow-up: migrar factories legacy `createWorkspaceClient/createScheduleClient/createPlanningClient` para usar `fetchWithAuth` internamente |
| 🔵 BAJO | PM-10B.2 follow-up: UX selección activa — agregar botón visible "Usar en Hoy" además de long-press |
| 🔵 BAJO | PM-10B.3: AsyncStorage/persistQueryClient para cache offline de widgets Android |
| 🔵 BAJO | Deuda preexistente expo-doctor: Metro config overrides, duplicate React versions, react-native-webrtc untested, 4 patch version mismatches |

**Próximo paso:** PM-10C — Join workspace / membership A→B.

### PM-10C — Mobile Workspace Join/Create + A→B Membership (PASS)
**Alcance:** `apps/mobile` + `apps/backend/workspace-service` — join por UUID, create workspace, set activo, aislamiento de datos por workspace
**Resultado:** PASS

**Commits registrados:**
- `45e01b4` feat(workspace): add idempotent join endpoint
- `4cb8fca` feat(mobile): add workspace join and create actions
- `b64b88c` fix(mobile): handle flattened join workspace response
- `e3eeb76` fix(mobile,schedule): align active workspace tasks and schedule creator
- `1ff30aa` fix(mobile): reload schedule when active workspace changes
- `74424b9` fix(mobile): align workspace CRUD with active workspace
- `5095554` fix(collab): restore CRDT websocket disconnect handler
- `d193d0a` fix(collab): close CRDT websocket on invalid ticket
- `21bee32` fix(desktop): make cloud websocket connect lifecycle idempotent
- `0c47650` docs: record PM-08D cloud workspace creation pass
- `f83e061` feat(desktop): create cloud workspaces from dashboard

**Backend — Join endpoint:**

```
POST /api/workspace/workspaces/{workspace_id}/join
Authorization: Bearer <JWT>
```

| Respuesta | body | Significado |
|-----------|------|-------------|
| 200 | `{ "workspace": {...}, "already_member": false }` | Join nuevo — workspace creado |
| 200 | `{ "workspace": {...}, "already_member": true }` | Ya era miembro — idempotente |
| 404 | — | Workspace no existe |
| 401 | — | JWT inválido o expirado |

**Contrato de respuesta:**
```python
class JoinWorkspaceResponse(BaseModel):
    workspace: WorkspaceResponse   # nested — NO flat
    already_member: bool
```

**QA A→B membership flow:**
1. A crea workspace → queda como owner
2. A copia UUID del workspace
3. B entra a Workspaces → pega UUID → Unirse
4. B recibe success (sin error)
5. B ve workspace en su lista
6. B accede a Tasks/Schedule del workspace joined
7. A ve a B como miembro (lectura futura via membership)

**Mobile — funcionalidades implementadas:**

| Feature | Archivo | Detalle |
|---------|---------|---------|
| Join por UUID | `workspaces.tsx` `handleJoinWorkspace` | `joinWorkspaceWithAuth(code)` → `result.workspace.id` → `setActiveWorkspace` |
| Create workspace | `workspaces.tsx` `handleCreateWorkspace` | `createWorkspaceWithAuth(name)` → activa automáticamente |
| Active workspace visible | `workspaces.tsx` | Badge "Activo" + botón "Usar en Hoy" por item |
| Join feedback | `workspaces.tsx` | Error 404 "Workspace no encontrado", error genérico si falla |
| Active workspace en Tasks | `tasks.tsx` | `useActiveWorkspace()` + `activeWorkspaceId` en deps `useCallback` |
| Active workspace en Schedule | `schedule.tsx` | `useActiveWorkspace()` + `activeWorkspaceId` en deps `useCallback` |
| due_date local en tasks | `tasks.tsx` `handleCreate` | `due_date: \`${todayDate}T12:00:00\`` — fecha local del dispositivo |

**Fixes críticos aplicados durante PM-10C:**

| # | Bug | Fix | Archivo |
|---|-----|-----|---------|
| 1 | Join response flattened — `result.id` undefined | `joinWorkspaceWithAuth` return type restaurado a nested `{ workspace, already_member }` | `workspaceClient.ts` |
| 2 | Join success silencioso — no feedback UX | Join ahora usa `result.workspace.id` + `setActiveWorkspace` + `loadWorkspaces()` | `workspaces.tsx` L99 |
| 3 | Tasks stale al cambiar workspace activo | `loadTasks` deps: `[getAccessToken, workspaceIdParam, activeWorkspaceId]` | `tasks.tsx` L86 |
| 4 | Tasks título sin indicador de workspace | Título: `Tareas · {workspaceName}` | `tasks.tsx` L222 |
| 5 | due_date faltante — task no aparece en Today | `handleCreate` envía `due_date: \`${todayDate}T12:00:00\`` | `tasks.tsx` L139 |
| 6 | Schedule 500 — `created_by` UUID parse fail | Repository pasa `block.created_by` (str) directo — SQLAlchemy convierte implícitamente | `postgres_schedule_repository.py` L80 |
| 7 | Schedule 500 — `ScheduleBlock` not defined | Import agregado: `from app.domain.schedule_block import ScheduleBlock` | `routes.py` L15 |
| 8 | Schedule stale al cambiar workspace | `loadBlocks` deps: `[getAccessToken, workspaceIdParam, activeWorkspaceId, buildSections]` | `schedule.tsx` L168 |
| 9 | Schedule título sin indicador de workspace | Título: `Horarios · {workspaceName}` | `schedule.tsx` L326 |

**QA Android — validación PM-10C:**

| # | Test | Resultado |
|---|------|-----------|
| 1 | Join UUID válido — no error + queda activo | PASS |
| 2 | Join UUID inexistente — "Workspace no encontrado" | PASS |
| 3 | Tasks no cruza datos entre workspaces | PASS |
| 4 | Nueva task aparece en Today | PASS |
| 5 | Schedule create — no 500 | PASS |
| 6 | Schedule no cruza bloques entre workspaces | PASS |
| 7 | schedule-service health 200 | PASS |
| 8 | schedule-service logs sin Traceback | PASS |

**Contrato de Today (no es backlog):**

```
Today muestra:
  - tasks con due_date = fecha local de hoy (YYYY-MM-DD)
  - schedule blocks cuyo day_of_week = día de la semana de hoy (0=Lunes ... 6=Domingo)

Today NO muestra:
  - tasks sin due_date (filtradas por diseño en backend)
  - tasks con due_date de otro día
  - schedule blocks de otros días de la semana

Deuda no bloqueante:
  - Tasks creadas antes de PM-10C pueden no tener due_date → no aparecen en Today
  - Backfill opcional para datos demo
```

**Deuda PM-10C / restante:**

| Severidad | Hallazgo |
|-----------|----------|
| 🟡 MEDIO | Join success feedback — Toast/snackbar que confirme "Te uniste a {nombre}" |
| 🔵 BAJO | `already_member=true` — diferenciarlo en UI (ya eras miembro vs. unión nueva) |
| 🔵 BAJO | Indicador visual mejorado de workspace activo en Today (nombre + color) |
| 🔵 BAJO | `safeJson` legacy / factory cleanup en `workspaceClient.ts` — no se usa en producción |
| 🔵 BAJO | Backfill demo: tasks antiguas sin due_date setear fecha arbitraria |
| 🔴 ALTA | invite tokens / permisos finos PM-11 (membresía, roles owner/member) |
| 🔴 ALTA | Widgets Android — pendientes según CLAUDE.md original |

**Próximo paso:** PM-11 — Invite tokens + permisos.

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