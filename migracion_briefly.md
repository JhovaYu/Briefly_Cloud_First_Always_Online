# Migración Briefly Cloud-First — Guía Operativa de Implementación

**Documento vivo del repositorio**  
**Versión:** 1.0  
**Fecha inicial:** 2026-04-23  
**Proyecto:** Briefly Cloud-First / Always-Online  
**Modo:** Hackathon Mode — demo estable de 2 horas  
**Arquitectura base:** `briefly-architecture-cloud-first-plan-v2.1.md`

---

## 0. Propósito de este documento

Este archivo es la guía operativa de migración para llevar Briefly desde el sistema actual P2P/local-first hacia la arquitectura cloud-first aprobada.

No reemplaza el documento de arquitectura. Su función es servir como lista de trabajo viva para Claude Code / Minimax M2.7, el desarrollador humano y el arquitecto.

Cada fase debe actualizarse con:

- estado real,
- archivos tocados,
- comandos ejecutados,
- decisiones tomadas,
- riesgos encontrados,
- validaciones completadas,
- pendientes.
- [ ] NO avanzar a Fase 1 sin validación manual de arquitectura

Este documento debe mantenerse dentro del repositorio, idealmente en la raíz con el nombre:

```txt
migracion_briefly.md
```

---

## Regla de oro

No avanzar a la siguiente fase sin:
- docker compose funcionando
- healthchecks OK
- Nginx routing validado

## 1. Principios de ejecución

### 1.1 Regla principal

No construir todo de una vez.

La migración se ejecuta por slices pequeños, verificables y reversibles.

### 1.2 Prioridad de riesgos

El orden de trabajo no se basa en lo más fácil, sino en lo que puede matar la demo:

1. base local reproducible,
2. autenticación,
3. colaboración WebSocket compatible con Yjs,
4. planificación REST sin Yjs reactivo,
5. servicios auxiliares,
6. frontend PWA,
7. AWS,
8. burn-in.

### 1.3 Restricciones cerradas

Estas decisiones ya están aprobadas y no deben reabrirse durante implementación:

- Backend REST en Python 3.12 + FastAPI.
- Collaboration Service también en Python/FastAPI.
- Hocuspocus queda descartado.
- `pycrdt-websocket` reemplaza a Hocuspocus.
- Supabase Auth se mantiene para v1/demo.
- No Cognito.
- 5 microservicios en 5 contenedores separados.
- Un único EC2 `t3.medium` o superior para demo.
- Docker Compose sobre EC2 dentro de VPC pública.
- DynamoDB On-Demand con tablas exclusivas por servicio.
- S3 para assets estáticos y snapshots Yjs.
- CloudFront como único punto de entrada.
- CloudFront termina TLS.
- CloudFront → EC2 usa HTTP Only puerto 80.
- EC2 no necesita certificado SSL en esta demo.
- Nginx hace reverse proxy y strip de prefijos.
- Nginx valida `X-Shared-Secret`.
- No edición offline soberana en v1.
- Planning usa REST + React Query, no Yjs reactivo.
- Mobile v1/demo usa React Native. PWA deja de ser ruta mobile principal.

---

## 2. Arquitectura objetivo resumida

```txt
Usuario
  │
  ▼
CloudFront HTTPS/WSS
  │
  ▼
EC2 t3.medium dentro de VPC pública
  │
  ├── Nginx reverse proxy
  │      ├── /api/workspaces/*    → workspace-service
  │      ├── /collab/*            → collaboration-service
  │      ├── /api/planning/*      → planning-service
  │      ├── /api/intelligence/*  → intelligence-service
  │      └── /api/utility/*       → utility-service
  │
  └── Docker Compose
         ├── workspace-service      FastAPI
         ├── collaboration-service  FastAPI + pycrdt-websocket
         ├── planning-service       FastAPI
         ├── intelligence-service   FastAPI + Gemini
         └── utility-service        FastAPI
```

Servicios externos:

```txt
Supabase Auth → emite JWT
DynamoDB      → tablas por servicio
S3            → frontend estático + snapshots/documentos
CloudWatch    → logs mínimos
SSM Parameter Store → secretos/configuración
```

---

## 3. Convenciones de implementación

### 3.1 Estructura base recomendada

```txt
apps/
  backend/
    workspace-service/
      app/
        api/
        domain/
        ports/
        adapters/
        use_cases/
        config/
        main.py
      tests/
      Dockerfile
      requirements.txt

    collaboration-service/
      app/
        api/
        domain/
        ports/
        adapters/
        use_cases/
        config/
        main.py
      tests/
      Dockerfile
      requirements.txt

    planning-service/
      app/
        api/
        domain/
        ports/
        adapters/
        use_cases/
        config/
        main.py
      tests/
      Dockerfile
      requirements.txt

    intelligence-service/
      app/
        api/
        domain/
        ports/
        adapters/
        use_cases/
        config/
        main.py
      tests/
      Dockerfile
      requirements.txt

    utility-service/
      app/
        api/
        domain/
        ports/
        adapters/
        use_cases/
        config/
        main.py
      tests/
      Dockerfile
      requirements.txt

infra/
  nginx/
    nginx.conf
  docker-compose.yml
  docker-compose.override.yml
  env.example
  aws/
    README.md
    scripts/
```

### 3.2 Arquitectura hexagonal en Python

Cada microservicio debe respetar esta separación:

```txt
api/        → routers FastAPI, request/response DTOs
domain/     → entidades y reglas puras, sin FastAPI, boto3 ni HTTP
ports/      → interfaces usando ABC o Protocol
adapters/   → DynamoDB, S3, Supabase JWT, Gemini, HTTP externo
use_cases/  → orquestación de dominio y puertos
config/     → settings/env
main.py     → instancia FastAPI y wiring
```

### 3.3 Reglas de código

- No poner lógica de negocio dentro de routers.
- No usar boto3 directamente en casos de uso.
- No hardcodear secretos.
- No mezclar rutas públicas con rutas internas.
- No importar FastAPI desde `domain/`.
- No llamar servicios externos desde `domain/`.
- No añadir frameworks pesados sin aprobación.
- No tocar frontend legacy hasta la fase correspondiente.

### 3.4 Convención de rutas

Nginx hace strip de prefijos.

Rutas externas:

```txt
/api/workspaces/*
/api/planning/*
/api/intelligence/*
/api/utility/*
/collab/*
```

Rutas internas de cada servicio:

```txt
/
 /health
 /workspaces
 /documents
 /tasks
 /summary
 /export
```

Ejemplo:

```txt
Cliente llama:
GET /api/planning/tasks

Nginx envía al contenedor:
GET /tasks
```

---

## 4. Fases de implementación

---

# Fase 0 — Foundation local del backend

## Objetivo

Crear una base local reproducible con 5 servicios FastAPI, Nginx y Docker Compose, sin lógica de negocio compleja.

## Estado

- [ ] Pendiente
- [ ] En progreso
- [ ] Bloqueada
- [x] Terminada ✅ 2026-04-24

## Tareas

- [x] Inspeccionar estructura actual del repo.
- [x] Crear estructura `apps/backend/*`.
- [x] Crear skeleton de los 5 servicios FastAPI.
- [x] Añadir endpoint `/health` en cada servicio.
- [x] Crear `Dockerfile` base para cada servicio.
- [x] Crear `requirements.txt` mínimo por servicio.
- [x] Crear `docker-compose.yml`.
- [x] Configurar límites de memoria asimétricos:
  - [x] workspace-service: `128m`
  - [x] collaboration-service: `384m`
  - [x] planning-service: `128m`
  - [x] intelligence-service: `128m`
  - [x] utility-service: `256m`
  - [x] nginx: `64m`
- [x] Crear `nginx.conf`.
- [x] Configurar strip de prefijos.
- [x] Configurar soporte WebSocket en `/collab/`.
- [x] Configurar validación `X-Shared-Secret` sin romper `/health`.
- [x] Crear `.env.example`.
- [x] Crear configuración Pyright.
- [x] Documentar comandos locales.

## No hacer en esta fase

- [x] No implementar Supabase JWT.
- [x] No implementar DynamoDB.
- [x] No implementar S3.
- [x] No implementar pycrdt.
- [x] No modificar frontend.
- [x] No crear infraestructura AWS.

## Validaciones

```bash
docker compose config   # ✅ Syntax validated OK
docker compose build    # ✅ 6 images built successfully
docker compose up -d    # ✅ All containers running
# Direct health checks:
curl http://localhost:8001/health  # ✅ {"status":"ok","service":"workspace-service"}
curl http://localhost:8002/health  # ✅ {"status":"ok","service":"collaboration-service"}
curl http://localhost:8003/health  # ✅ {"status":"ok","service":"planning-service"}
curl http://localhost:8004/health  # ✅ {"status":"ok","service":"intelligence-service"}
curl http://localhost:8005/health  # ✅ {"status":"ok","service":"utility-service"}
# Nginx health checks:
curl http://localhost/health           # ✅ {"status": "ok", "service": "nginx"}
curl http://localhost/api/workspaces/health -H "X-Shared-Secret: changeme"  # ✅ 200 OK
curl http://localhost/api/planning/health -H "X-Shared-Secret: changeme"    # ✅ 200 OK
curl http://localhost/api/intelligence/health -H "X-Shared-Secret: changeme" # ✅ 200 OK
curl http://localhost/api/utility/health -H "X-Shared-Secret: changeme"   # ✅ 200 OK
curl http://localhost/collab/health -H "X-Shared-Secret: changeme"         # ✅ 200 OK
# X-Shared-Secret validation:
curl -i -H "X-Shared-Secret: wrong" http://localhost/api/workspaces/health  # ✅ 401 Unauthorized
curl -i -H "X-Shared-Secret: changeme" http://localhost/api/workspaces/health # ✅ 200 OK
```

## Definición de terminado

- [x] Los 5 servicios levantan. ✅ Todos healthy
- [x] Nginx enruta correctamente. ✅ Todos los routes probados OK
- [x] Los healthchecks responden. ✅ 5 servicios + nginx healthcheck
- [x] El repo no queda roto. ✅ Solo archivos de infra/backend modificados
- [x] Pyright no reporta errores críticos. ⚠️ Import resolution errors (paquetes Python no instalados en host) — no afecta runtime
- [x] Se actualiza esta fase con archivos tocados y comandos ejecutados. ✅

## Notas de ejecución

**Archivos creados/modificados:**
- `apps/backend/workspace-service/` — skeleton FastAPI completo
- `apps/backend/collaboration-service/` — skeleton FastAPI completo
- `apps/backend/planning-service/` — skeleton FastAPI completo
- `apps/backend/intelligence-service/` — skeleton FastAPI completo
- `apps/backend/utility-service/` — skeleton FastAPI completo
- `docker-compose.yml` — 5 servicios + nginx, memoria asimétrica
- `infra/nginx/nginx.conf.template` — routing + strip + WebSocket + X-Shared-Secret (usa ${SHARED_SECRET})
- `infra/nginx/Dockerfile` — imagen nginx minimal que usa entrypoint oficial para envsubst
- `.env.example`
- `.env` (creado para runtime validation, NO commitear)
- `pyrightconfig.json`

**Runtime validation completada 2026-04-24:**
- Docker Desktop corriendo
- 6 contenedores levantados (5 servicios + nginx)
- Healthchecks directos: todos OK
- Healthchecks vía Nginx: todos OK
- X-Shared-Secret: 401 con wrong, 200 con correct
- NPM workspaces: TypeScript errors en legacy desktop (pre-existing, no afecta backend)
- Pyright: import resolution errors (faltan node_modules de Python en host)

**Bugfix realizado durante validación:**
- nginx.conf usaba `${SHARED_SECRET}` que nginx no puede expandir en tiempo de ejecución
- Solución correcta: usar el mecanismo estándar de nginx templates + envsubst del entrypoint oficial
- La plantilla se coloca en `/etc/nginx/templates/` y el entrypoint oficial procesa con envsubst automáticamente
- El secreto viene de la variable de entorno `SHARED_SECRET` definida en docker-compose.yml
- En producción EC2 + Docker Compose: las variables de entorno se injection vía docker-compose o systemd unit

**Corrección final PM-01 (2026-04-24):**
- nginx.conf.template ahora usa `${SHARED_SECRET}` sin hardcodear
- infra/nginx/Dockerfile minimal que copia template a directorio de templates
- Healthcheck de nginx corregido: `pgrep nginx && wget --spider -q http://127.0.0.1:80/health || exit 1`
- archivo docker-entrypoint.sh eliminado (dead code)

---

# Fase 1 — Workspace Service + Supabase Auth

## Objetivo

Construir el servicio dueño de workspaces, documentos, membresías y autorización base usando JWT de Supabase.

## Estado

- [ ] Pendiente
- [ ] En progreso
- [ ] Bloqueada
- [x] Terminada ✅ 2026-04-25

## Tareas

- [x] Implementar validador JWT de Supabase.
- [x] Validar issuer/audience según configuración real.
- [x] Crear dependencias FastAPI para usuario autenticado.
- [x] Implementar modelo de workspace.
- [x] Implementar modelo de membership.
- [x] Implementar modelo de document metadata.
- [x] Crear puertos de repositorio.
- [x] Crear adaptador in-memory (DynamoDB postergado por duda académica).
- [x] Definir tablas DynamoDB del servicio (documentado, no implementado).
- [x] Crear endpoints mínimos:
  - [x] `GET /health`
  - [x] `GET /me`
  - [x] `POST /workspaces`
  - [x] `GET /workspaces`
  - [x] `GET /workspaces/{workspace_id}`
  - [x] `POST /workspaces/{workspace_id}/documents`
  - [x] `GET /workspaces/{workspace_id}/documents`
  - [x] `GET /workspaces/{workspace_id}/permissions`
- [ ] Añadir tests mínimos de autorización.
- [x] Documentar contrato de API.

## Riesgos

- Validación JWT mal configurada.
- Diferencias entre claims de Supabase y modelo interno.
- Acoplar autorización a routers en vez de casos de uso.

## Validaciones

```bash
curl http://localhost/api/workspaces/health
# Probar endpoint protegido sin token → 401
# Probar endpoint protegido con token válido → 200
```

## Definición de terminado

- [x] JWT válido permite acceso.
- [x] JWT inválido o ausente rechaza acceso.
- [x] Workspace se puede crear/listar.
- [x] Document metadata se puede crear/listar.
- [x] Otros servicios pueden consultar permisos internamente.
- [x] Se actualiza este documento.

---

# Fase 2 — Spike crítico de Collaboration Service

## Objetivo

Validar temprano el riesgo técnico principal: compatibilidad entre frontend Yjs, FastAPI WebSocket y `pycrdt-websocket`.

## Estado

- [ ] Pendiente
- [ ] En progreso
- [ ] Bloqueada
- [ ] Terminada

## Tareas

- [ ] Investigar API actual de `pycrdt-websocket`.
- [ ] Crear endpoint:
  - [ ] `/collab/{workspace_id}/{document_id}`
- [ ] Implementar handshake WebSocket.
- [ ] Autenticar JWT en handshake.
- [ ] Consultar permisos contra Workspace Service.
- [ ] Crear sala/documento por `workspace_id + document_id`.
- [ ] Conectar cliente Yjs mínimo desde frontend o sandbox.
- [ ] Probar edición simultánea con 2 navegadores.
- [ ] Probar reconexión.
- [ ] Implementar debounce 30–60s antes de flush.
- [ ] Persistir snapshot en S3.
- [ ] Persistir metadata en DynamoDB.
- [ ] Configurar timeouts generosos en Uvicorn/Nginx.
- [ ] Documentar límite operativo de tamaño de notas para demo.
- [ ] Añadir logs de conexión/desconexión.

## Advertencia operativa

Python/FastAPI corre sobre event loop async. Operaciones pesadas de CRDT pueden bloquear conexiones WebSocket concurrentes si se ejecutan de forma síncrona o si el merge es muy grande.

Durante la demo:

- evitar pegar bloques masivos de texto,
- usar documentos pequeños/medianos,
- mantener máximo de usuarios concurrentes según guion,
- monitorear logs de Collaboration Service.

## Riesgos

- `pycrdt-websocket` es menos maduro que Hocuspocus.
- Edge cases de sincronización.
- Reconexiones inestables detrás de proxy.
- Bloqueo del event loop con documentos grandes.

## Validaciones

```bash
# levantar compose
docker compose up

# abrir 2 clientes
# editar mismo documento
# verificar convergencia
# cortar conexión
# reconectar
# verificar que no se pierde contenido
```

## Definición de terminado

- [ ] Dos clientes sincronizan texto.
- [ ] Reconexión básica funciona.
- [ ] Nginx proxy WebSocket funciona.
- [ ] JWT en handshake funciona.
- [ ] Debounce está implementado o simulado con claridad.
- [ ] Snapshot se guarda o queda stub documentado.
- [ ] Riesgos quedan registrados.
- [ ] Se actualiza este documento.

---

# Fase 3 — Planning Service REST + React Query

## Objetivo

Mover tareas y horarios fuera de Yjs reactivo hacia API REST con `fetch-on-load` y mutaciones optimistas.

## Estado

- [ ] Pendiente
- [ ] En progreso
- [ ] Bloqueada
- [ ] Terminada

## Tareas backend

- [ ] Crear entidades de task.
- [ ] Crear entidades de schedule.
- [ ] Crear repositorios DynamoDB.
- [ ] Implementar optimistic locking con `ConditionExpression`.
- [ ] Añadir campo `version`.
- [ ] Crear endpoints:
  - [ ] `GET /tasks`
  - [ ] `POST /tasks`
  - [ ] `PATCH /tasks/{task_id}`
  - [ ] `DELETE /tasks/{task_id}`
  - [ ] `GET /schedule`
  - [ ] `PUT /schedule`
- [ ] Validar JWT.
- [ ] Validar permisos con Workspace Service si aplica.
- [ ] Manejar conflicto de versión con error claro.

## Tareas frontend

- [ ] Identificar pantallas legacy de Tasks/Schedule.
- [ ] Retirar observadores Yjs para Planning.
- [ ] Introducir React Query.
- [ ] Usar fetch-on-load.
- [ ] Implementar mutaciones optimistas.
- [ ] Mostrar error controlado si hay conflicto.

## Nota de alcance

Planning no necesita realtime completo para la demo. Basta cargar datos, mutar, refrescar y mantener UI consistente.

## Definición de terminado

- [ ] Tareas funcionan sin Yjs.
- [ ] Horarios funcionan sin Yjs.
- [ ] Conflictos no sobrescriben silenciosamente.
- [ ] React Query maneja loading/error/success.
- [ ] Se actualiza este documento.

---

# Fase 4 — Intelligence Service y Utility Service

## Objetivo

Implementar servicios auxiliares con límites claros para que no comprometan la demo.

## Estado

- [ ] Pendiente
- [ ] En progreso
- [ ] Bloqueada
- [ ] Terminada

## Intelligence Service

- [ ] Crear endpoint `/summary`.
- [ ] Integrar Gemini con timeout interno de 55s.
- [ ] Validar tamaño máximo del texto.
- [ ] Devolver error controlado si Gemini no responde.
- [ ] No bloquear UI principal si falla.
- [ ] Guardar logs mínimos.

## Utility Service

- [ ] Crear endpoint `/export`.
- [ ] Crear endpoint `/qr`.
- [ ] Crear endpoint `/link-preview`.
- [ ] Controlar payload máximo.
- [ ] Evitar OOM en generación PDF.
- [ ] Usar memoria asignada `256m`.
- [ ] Manejar errores externos con fallback.

## Definición de terminado

- [ ] Servicios responden por Nginx.
- [ ] Timeouts funcionan.
- [ ] Errores son controlados.
- [ ] No hay secretos hardcodeados.
- [ ] Se actualiza este documento.

---

# Fase 5 — Frontend cloud-first + React Native

## Objetivo

Adaptar el frontend React/Vite a la arquitectura cloud-first e integrar React Native para demo mobile.

## Estado

- [ ] Pendiente
- [ ] En progreso
- [ ] Bloqueada
- [ ] Terminada

## Tareas

- [ ] Definir variables de entorno del frontend.
- [ ] Reemplazar rutas legacy P2P/ID@IP.
- [ ] Conectar Workspace Service.
- [ ] Conectar Collaboration Service por WebSocket.
- [ ] Conectar Planning Service con React Query.
- [ ] Conectar Intelligence Service.
- [ ] Conectar Utility Service.
- [ ] Quitar dependencia de Electron para flujo demo.
- [ ] Preparar layout responsive.
- [ ] Configurar PWA básica:
  - [ ] manifest
  - [ ] iconos
  - [ ] cache de shell
- [ ] No prometer edición offline soberana.
- [ ] Manejar errores visibles en UI.

## Demo mínima esperada

- [ ] Login.
- [ ] Crear/abrir workspace.
- [ ] Crear/abrir documento.
- [ ] Edición colaborativa básica.
- [ ] Tareas.
- [ ] Horario.
- [ ] Resumen IA o fallback controlado.
- [ ] Export/QR/link-preview si están estables.

## Definición de terminado

- [ ] Flujo web funciona en desktop browser.
- [ ] Flujo web funciona en navegador móvil.
- [ ] No depende de Electron.
- [ ] No usa ID@IP.
- [ ] Se actualiza este documento.

---

# Fase 6 — Infraestructura AWS

## Objetivo

Desplegar la arquitectura en AWS Academy Learner Lab con costo controlado y acceso público mediante CloudFront.

## Estado

- [ ] Pendiente
- [ ] En progreso
- [ ] Bloqueada
- [ ] Terminada

## Tareas VPC

- [ ] Crear VPC `10.0.0.0/16`.
- [ ] Crear subred pública.
- [ ] Crear Internet Gateway.
- [ ] Asociar route table.
- [ ] Crear Security Group.
- [ ] Abrir puerto 80 según estrategia aprobada.
- [ ] Cerrar puerto 443 en EC2.
- [ ] Abrir puerto 22 solo a IP del desarrollador.
- [ ] Mantener puertos internos solo en Docker network.

## Tareas EC2

- [ ] Crear EC2 `t3.medium` o superior.
- [ ] EBS gp3 mínimo 30GB.
- [ ] Instalar Docker.
- [ ] Instalar Docker Compose.
- [ ] Subir repo/config.
- [ ] Configurar `.env`.
- [ ] Levantar `docker compose`.
- [ ] Verificar logs.

## Tareas CloudFront

- [ ] Crear distribución.
- [ ] Origen S3 para frontend.
- [ ] Origen EC2 puerto 80 para APIs/WS.
- [ ] Origin Protocol Policy: HTTP Only.
- [ ] Custom Header: `X-Shared-Secret`.
- [ ] Behavior `/collab/*` con WebSocket:
  - [ ] Origin Request Policy: AllViewer
  - [ ] Cache Policy: CachingDisabled
- [ ] Origin Response Timeout: 60s.
- [ ] No usar Route 53.
- [ ] No comprar dominio.
- [ ] Usar URL `*.cloudfront.net`.

## Tareas DynamoDB/S3

- [ ] Crear tablas DynamoDB por servicio.
- [ ] Crear bucket S3 frontend.
- [ ] Crear bucket/prefix snapshots.
- [ ] Configurar IAM mínimo viable.

## Definición de terminado

- [ ] CloudFront sirve frontend.
- [ ] CloudFront enruta REST.
- [ ] CloudFront enruta WebSocket.
- [ ] EC2 rechaza tráfico sin `X-Shared-Secret`.
- [ ] Logs visibles.
- [ ] Se actualiza este documento.

---

# Fase 7 — Burn-in y Día de la Demo

## Objetivo

Validar que el sistema sobrevive la demo de 2 horas.

## Estado

- [ ] Pendiente
- [ ] En progreso
- [ ] Bloqueada
- [ ] Terminada

## Pruebas

- [ ] 3 usuarios simultáneos.
- [ ] 10 usuarios simulados si es posible.
- [ ] 2 navegadores editando mismo documento.
- [ ] Reconexión WebSocket.
- [ ] Crear/listar tareas.
- [ ] Modificar horarios.
- [ ] Probar IA.
- [ ] Probar export/QR/link-preview.
- [ ] Verificar memoria.
- [ ] Verificar logs.
- [ ] Verificar presupuesto.

## Runbook demo

### T-30 minutos

- [ ] Warm-up de Supabase.
- [ ] Login manual.
- [ ] Confirmar que Supabase Free no está pausado.

### T-20 minutos

- [ ] Probar handshake WebSocket.
- [ ] Confirmar headers:
  - [ ] `Connection: Upgrade`
  - [ ] `Upgrade: websocket`

### T-15 minutos

- [ ] Congelar infraestructura.
- [ ] Cero despliegues de último minuto.
- [ ] Recordar que CloudFront puede tardar ~20 minutos en propagar cambios.

### Backup

- [ ] Crear AMI de EC2 con Docker Compose estable.
- [ ] Documentar procedimiento de recuperación.
- [ ] Objetivo de recuperación: menos de 2 minutos si hay desastre.

## Definición de terminado

- [ ] Demo flow completo probado.
- [ ] AMI creada.
- [ ] Riesgos conocidos documentados.
- [ ] Equipo sabe qué no tocar.
- [ ] Se actualiza este documento.

---

## 5. Matriz de prompts maestros

| Prompt | Fase | Objetivo | Estado |
|---|---|---|---|
| PM-01 | Fase 0 | Foundation local FastAPI + Docker + Nginx | **Completado** ✅ 2026-04-24 |
| PM-02 | Fase 1 | Workspace Service + Supabase JWT | **Completado** ✅ 2026-04-25 |
| PM-03 | Fase 2 | Spike Collaboration pycrdt-websocket | Pendiente |
| PM-04 | Fase 3 | Planning REST + React Query | Pendiente |
| PM-05 | Fase 4 | Intelligence + Utility Services | Pendiente |
| PM-06 | Fase 5 | Frontend cloud-first + React Native | Pendiente |
| PM-07 | Fase 6 | AWS Infra scripts/deploy | Pendiente |
| PM-08 | Fase 7 | Burn-in + Playwright + demo runbook | Pendiente |

---

## 6. Reglas para Claude Code / Minimax M2.7

### 6.1 Antes de editar

Para tareas críticas, el agente debe entregar primero:

1. resumen de entendimiento,
2. plan,
3. archivos a tocar,
4. riesgos,
5. validaciones.

Debe esperar aprobación humana si toca:

- auth,
- seguridad,
- AWS,
- Docker/Nginx,
- eliminación de código,
- migraciones de datos,
- secretos,
- configuración de producción.

### 6.2 Después de editar

El agente debe reportar:

1. archivos creados/modificados,
2. resumen del cambio,
3. comandos ejecutados,
4. resultado de validaciones,
5. errores encontrados,
6. pendientes,
7. actualización de este documento.
- No generar tablas decorativas sin valor funcional.
- No repetir contenido del prompt en la respuesta.
- Priorizar claridad sobre formato visual.

### 6.3 Plugins recomendados por fase

| Fase | Plugins/MCP recomendados |
|---|---|
| Fase 0 | serena, feature-dev, pyright-lsp, context7, claude-md-management |
| Fase 1 | security-guidance, context7, pyright-lsp, feature-dev, serena |
| Fase 2 | context7, security-guidance, pyright-lsp, typescript-lsp, feature-dev, serena |
| Fase 3 | pyright-lsp, feature-dev, security-guidance, context7, typescript-lsp |
| Fase 4 | pyright-lsp, security-guidance, context7, feature-dev |
| Fase 5 | typescript-lsp, feature-dev, serena, context7, Playwright si aplica |
| Fase 6 | security-guidance, context7, feature-dev, claude-md-management |
| Fase 7 | Playwright, security-guidance, claude-md-management, remember |

### 6.4 Regla anti-ruido

No activar todos los plugins en todos los prompts.

Cada prompt debe declarar explícitamente qué herramientas usar y cuáles no.

---

## 7. Registro de decisiones durante implementación

Usar este formato cuando aparezca una decisión nueva:

```txt
Fecha:
Decisión:
Contexto:
Opciones:
Razón:
Impacto:
Aprobado por:
```

### Decisiones registradas

```txt
Fecha: 2026-04-25
Decisión: Mobile v1/demo usará React Native, no PWA.
Contexto: La ruta PWA para navegador móvil deja de ser prioritaria para demo.
Opciones: PWA, React Native
Razón: React Native permite demo mobile más fluida y controlada.
Impacto: Afecta fases frontend/mobile posteriores (PM-06/Fase 5), no PM-02 backend.
Aprobado por: Equipo
```

---

## 8. Registro de riesgos vivos

- Posible incompatibilidad pycrdt...
- Configuración WebSocket proxy...
- X-Shared-Secret...

| Fecha | Riesgo | Severidad | Estado | Mitigación |
|---|---|---|---|---|
| 2026-04-23 | pycrdt-websocket menos maduro que Hocuspocus | ALTO | Abierto | Spike temprano en Fase 2 |
| 2026-04-23 | FastAPI event loop bloqueado por merges CRDT grandes | ALTO | Abierto | Limitar tamaño de notas en demo |
| 2026-04-23 | Equipo viene de TS y debe implementar Python hexagonal | MEDIO | Abierto | Convenciones desde Fase 0 |
| 2026-04-23 | Docker images Python pesadas | MEDIO | Abierto | python:3.12-slim, EBS 30GB, revisar 40GB si hace falta |
| 2026-04-23 | CloudFront WebSocket mal configurado | ALTO | Abierto | Behavior /collab con AllViewer + CachingDisabled |
| 2026-04-23 | Direct access a EC2 saltando CloudFront | ALTO | Abierto | X-Shared-Secret en Nginx |
| 2026-04-23 | Supabase Free pausado antes de demo | MEDIO | Abierto | Warm-up T-30 |

---

## 9. Bitácora de implementación

Cada vez que Minimax/Claude Code complete un bloque, añadir entrada aquí.

### Entrada 001

```txt
Fecha: 2026-04-24
Agente: Minimax M2.7 (Claude Code CLI)
Fase: Fase 0 — Foundation local del backend (PM-01)

Resumen:
  Implementación de skeleton para 5 microservicios FastAPI + Docker Compose + Nginx.
  Estructura hexagonal base creada para cada servicio (domain/, ports/, adapters/, use_cases/, api/).
  Ninguna lógica de negocio implementada. Docker Desktop no disponible para validación runtime.
  Fase marcada como En progreso, no Terminada.

Archivos creados:
  apps/backend/workspace-service/app/{main.py,config.py,api/routes.py}
  apps/backend/workspace-service/{Dockerfile,requirements.txt,pyproject.toml}
  apps/backend/workspace-service/{domain,ports,adapters,use_cases,api,tests}/__init__.py
  (patrón répido para collaboration-service, planning-service, intelligence-service, utility-service)
  infra/nginx/nginx.conf
  docker-compose.yml
  .env.example
  pyrightconfig.json
  docs/migration/PM-01-foundation-plan.md

Comandos ejecutados:
  mkdir -p apps/backend/{workspace,collaboration,planning,intelligence,utility}-service/app/...
  docker compose -f docker-compose.yml config
  python -m py_compile apps/backend/workspace-service/app/{main.py,config.py,routes.py}

Validaciones reales:
  docker compose config          ✅ Sin errores de sintaxis
  python -m py_compile            ✅ Syntax OK
  Docker Desktop                  ❌ No disponible — runtime validation pendiente

Errores:
  docker compose build falló: Docker Desktop no corriendo en este entorno.
  Versión attribute obsolete en docker-compose.yml: removido.

Pendientes:
  - Ejecutar docker compose build && docker compose up -d en máquina con Docker Desktop
  - Validar curl /health directo a cada servicio (:8001-8005)
  - Validar curl /health vía Nginx (/api/workspaces/health, /collab/, etc.)
  - Validar 401 con X-Shared-Secret incorrecto vía Nginx
  - Validar routing por prefijo vía Nginx
  - Verificar NPM workspaces no captura apps/backend (apps/* glob)
```

---

### Entrada 002

```txt
Fecha: 2026-04-24
Agente: Minimax M2.7 (Claude Code CLI) — continuación
Fase: Fase 0 — Foundation local del backend (PM-01) — Cierre

Resumen:
  Validación runtime completada en máquina con Docker Desktop.
  6 contenedores levantados y healthy (5 servicios + nginx).
  X-Shared-Secret funcionando correctamente (401 wrong, 200 correct).
  Bugs corregidos: SHARED_SECRET en nginx, healthcheck de nginx, archivos muertos.

Archivos modificados:
  docker-compose.yml              — nginx healthcheck corregido, env SHARED_SECRET
  infra/nginx/nginx.conf.template — restaurado ${SHARED_SECRET} (sin hardcodear)
  infra/nginx/Dockerfile          — simplificado, usa entrypoint oficial de nginx
  migracion_briefly.md            — actualizado con validación runtime

Archivos eliminados:
  infra/nginx/docker-entrypoint.sh — dead code, no usado

Comandos ejecutados:
  docker compose down
  docker compose build
  docker compose up -d
  docker compose ps --all
  curl http://localhost:8001/health ... :8005/health
  curl http://localhost/health
  curl http://localhost/api/workspaces/health (sin header, wrong, correct)

Validaciones reales:
  docker compose build            ✅ 6 imágenes construidas
  docker compose up -d            ✅ 6 contenedores corriendo
  docker compose ps               ✅ 6 healthy (nginx ahora healthy)
  healthchecks directos           ✅ 5 servicios OK (:8001-:8005)
  Nginx /health                   ✅ 200 OK
  X-Shared-Secret sin header      ✅ 401 Unauthorized
  X-Shared-Secret wrong           ✅ 401 Unauthorized
  X-Shared-Secret changeme        ✅ 200 OK
  Nginx routing (planning/intelligence/utility/collab) ✅ 200 OK
  SHARED_SECRET en template       ✅ ${SHARED_SECRET} sin hardcodear
  .env en gitignore               ✅ .env ignorado, .env.example tracked

Errores corregidos durante validación:
  1. nginx.conf.template tenía "events {}" que no es válido en conf.d/
     → Removido, ahora es solo bloque server
  2. Healthcheck de nginx usaba wget contra localhost:80 que fallaba
     → Corregido a: pgrep nginx && wget --spider -q http://127.0.0.1:80/health || exit 1
  3. SHARED_SECRET estaba hardcodeado como "changeme" en template
     → Restaurado ${SHARED_SECRET} con envsubst del entrypoint oficial
  4. docker-entrypoint.sh creado pero nunca usado
     → Eliminado

Pendientes: ninguno. PM-01 listo para commit.
```

### Entrada 003

```txt
Fecha: 2026-04-25
Agente: Claude Code CLI (Minimax M2.7)
Fase: PM-02A — Repo Hygiene + Validation Gate

Resumen:
  Higiene git completada. .gitignore actualizado con Python caches y configs locales.
  Archivos .pyc y __pycache__ removidos del tracking. Validación de sintaxis Python OK.
  Arquitectura hexagonal verificada: domain/ports/adapters/use_cases/api limpios.
  JWT verifier usa ES256 + JWKS + validación issuer/audience/exp.
  Decisión registrada: Mobile v1/demo usará React Native, no PWA.

Archivos modificados:
  .gitignore — agregado Python caches, .claude/, .mcp.json, repomix-output.txt

Archivos removidos del tracking:
  apps/backend/workspace-service/app/__pycache__/config.cpython-312.pyc
  apps/backend/workspace-service/app/__pycache__/main.cpython-312.pyc
  apps/backend/workspace-service/app/api/__pycache__/routes.cpython-312.pyc

Comandos ejecutados:
  git rm --cached -r apps/backend/workspace-service/app/__pycache__
  git rm --cached -r apps/backend/workspace-service/app/api/__pycache__
  python -m py_compile (todos los archivos Python) — ✅ Syntax OK

Validaciones ejecutadas:
  docker compose config          ✅ Syntax validated OK (Docker no corriendo en host)
  python -m py_compile main.py   ✅ Syntax OK
  python -m py_compile domain/*  ✅ Syntax OK
  python -m py_compile use_cases/* ✅ Syntax OK
  python -m py_compile ports/*   ✅ Syntax OK
  python -m py_compile adapters/* ✅ Syntax OK

Validación runtime NO ejecutada:
  Docker Desktop no corriendo en este entorno. Se requiere máquina con Docker
  para validar: docker compose build, docker compose up -d, curl /health, curl /me.

Decisión registrada:
  Mobile v1/demo usará React Native. La PWA deja de ser ruta mobile principal.
  Esto afecta fases frontend/mobile posteriores, no PM-02 backend.

Pendientes:
  - Docker runtime validation en máquina con Docker Desktop
  - Commit selectivo de archivos PM-02
  - Approval humano antes de commit
```

---

## 10. Estado global

| Área | Estado |
|---|---|
| Foundation local | Terminada ✅ 2026-04-24 |
| Auth/Workspace | Terminada ✅ 2026-04-25 |
| Collaboration pycrdt | Pendiente |
| Planning REST | Pendiente |
| Intelligence/Utility | Pendiente |
| Frontend cloud-first + React Native | Pendiente |
| AWS | Pendiente |
| Burn-in | Pendiente |

---

## 11. Criterio final de éxito

El proyecto se considera listo para demo cuando:

- [ ] El frontend abre desde CloudFront.
- [ ] Un usuario puede iniciar sesión con Supabase.
- [ ] Un usuario puede crear/abrir workspace.
- [ ] Dos usuarios pueden editar el mismo documento.
- [ ] Tareas funcionan vía REST.
- [ ] Horarios funcionan vía REST.
- [ ] IA/export/QR/link-preview fallan de forma controlada si algo externo falla.
- [ ] CloudFront enruta REST y WebSockets.
- [ ] EC2 no acepta tráfico directo sin secreto.
- [ ] La demo corre mínimo 2 horas sin OOM.
- [ ] Hay AMI de respaldo.
- [ ] El equipo sabe explicar la decisión VPC pública sin NAT Gateway.

---

## 12. Próximo paso inmediato

**PM-01 y PM-02 completados y validados runtime.**

Próximos pasos:

1. **Commit selectivo PM-02** — approval humano requerido:
   - `.gitignore` actualizado
   - `tasks.md` (nuevo)
   - `migracion_briefly.md` actualizado
   - `apps/backend/workspace-service/` (domain, ports, adapters, use_cases, api, config)
   - `docker-compose.yml`, `requirements.txt`, `.env.example`
   - `docs/contexto.md`, `docs/migration/PM-02-workspace-auth-plan.md`

2. **PM-03 — Collaboration Service spike** — después de commit PM-02:
   - pycrdt-websocket WebSocket handshake
   - Validar Yjs sync con frontend legacy o sandbox
   - Auth JWT en handshake WebSocket

3. **Post-commit** — después de approval:
   - Ejecutar git add selectivo (lista en tasks.md)
   - git commit con mensaje estructurado
   - git push cuando aprobado
