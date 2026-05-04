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
- Compatibilidad Yjs ↔ pycrdt-websocket
- estabilidad WebSocket detrás de proxy
- consumo de memoria en EC2

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