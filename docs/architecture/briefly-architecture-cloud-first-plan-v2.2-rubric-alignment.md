# Briefly — Addendum Arquitectónico v2.2
## Alineación con Rúbrica Académica y Autonomía de Microservicios

**Versión:** 2.2
**Fecha:** 2026-04-24
**Relación:** addendum de `briefly-architecture-cloud-first-plan-v2.1.md`
**Ámbito:** decisiones académicas, riesgos abiertos y preguntas al profesor antes de PM-02

---

## 0. Contexto

PM-01 (Foundation local del backend) fue completado y validado:
- 5 servicios FastAPI levantan correctamente
- Nginx routing funciona con X-Shared-Secret
- Hotfix /collab/* aplicado: prefix se preserva, no se hace strip
- Todos los contenedores healthy

Este documento NO implementa código. Registra hallazgos de la rúbrica académica, riesgos abiertos y preguntas formales al profesor antes de avanzar a PM-02.

---

## 1. Bases de datos independientes por microservicio

### 1.1 Decisión actual (v2.1)

Cada microservicio tiene **ownership exclusivo de persistencia**:
- Workspace Service → DynamoDB `briefly-workspaces`, `briefly-memberships`, etc.
- Collaboration Service → DynamoDB `briefly-collaboration-*` + S3 `briefly-doc-snapshots`
- Planning Service → DynamoDB `briefly-task-lists`, `briefly-tasks`, etc.
- Intelligence Service → DynamoDB `briefly-intelligence-cache`
- Utility Service → DynamoDB `briefly-utility-*` + S3 `briefly-exports`

**Esto NO significa 5 motores físicos distintos.** Significa que cada servicio tiene tablas/buckets exclusivos y nadie más escribe directamente en ellos.

### 1.2 Interpretación de la rúbrica — riesgo académico

El profesor/rúbrica puede interpretar "5 bases de datos independientes" como **5 instancias o motores físicamente separados**.

**Si la interpretación exige separación física**, las opciones son:

| Opción | Descripción | RAM estimada en t3.medium (4GB total) | Complejidad operativa | Costo | Velocidad demo | Riesgo fallo |
|---|---|---|---|---|---|---|
| **B1** | 5 contenedores DB ligeros (SQLite, PostgreSQL ligero) en Docker Compose, uno por microservicio | ~800MB total (160MB × 5) + overhead Docker | Baja (docker compose ya instalado) | $0 extra (mismos recursos EC2) | Rápida (setup local) | Bajo |
| **B2** | 5 esquemas/DBs separadas en un solo motor SQL (PostgreSQL único) con ownership claro por servicio | ~400MB para motor + buffer pools | Media (schemas separados, pero un solo motor) | $0 extra | Rápida | Muy bajo |
| **B3** | Mezcla: DynamoDB + contenedores ligeros para servicios con requisitos mínimos | Variable | Alta | $0 extra | Media | Medio |

**Impacto en RAM para t3.medium (4GB):**
- Python FastAPI × 5 servicios: ~1.5GB (384m + 128m × 4)
- Nginx: 64m
- Docker overhead: ~200MB
- **Total servicios cloud: ~1.8GB**
- **Disponible para DBs: ~2GB**
- Opción B1 (SQLite × 5): ~800MB → factible
- Opción B2 (PostgreSQL único): ~400MB → factible

### 1.3 Pregunta formal al profesor

> **Para el requisito de "5 bases de datos independientes", ¿se acepta independencia por ownership de persistencia usando tablas DynamoDB/S3 exclusivas por microservicio, o se requiere que cada microservicio tenga una instancia/motor de base de datos separado?**

Si el profesor exige separación física, **recomendación: Opción B2 (PostgreSQL único con 5 esquemas)** por:
- Un solo motor a mantener
- Esquemas separados garantizan aislamiento
- RAM dentro de límites de t3.medium
- Ningún costo extra en AWS Academy

---

## 2. Autonomía ante caída de microservicios

### 2.1 Regla definida

**Cada microservicio debe poder conservar y operar su propia data aunque otros servicios caigan.**

### 2.2 Comportamiento esperado en modo degradado

| Servicio caído | Comportamiento de otros servicios |
|---|---|
| Workspace Service | Planning, Intelligence, Utility no pueden validar permisos de workspace → devolver 503/403 controlado, no corrupir datos |
| Collaboration Service | Otros servicios no pueden escribir snapshots → guardar locally y reintentar, no perder datos |
| Planning Service | Solo queda inoperable para el cliente |
| Intelligence Service | Solo fallan resúmenes/stats → errores controlados visibles al usuario |
| Utility Service | Solo fallan export/QR/link-preview → errores controlados |

### 2.3 Lo que NO debe pasar

- Escrituras cruzadas a tablas de otro servicio
- Pérdida de datos por caída de servicio dependiente
- Estados inconsistentes entre servicios
- Datos corrompidos por reintentos sin idempotencia

### 2.4 Mejora futura (post-v1)

- **Proyección/cache local de permisos** por servicio para modo degradado
- Implementación: cada servicio mantiene una cache de memberships válidas con TTL
- Impacto: complejidad adicional, no implementar ahora salvo que sea necesario para demo

---

## 3. React Native vs PWA

### 3.1 Decisión actual (v2.1)

Mobile v1 es **PWA / navegador móvil**, no React Native. La arquitectura v2.1 tomó esta decisión para simplificar.

### 3.2 Hallazgo de rúbrica

La rúbrica menciona React Native para smartphone/tablet. Esto puede contradecir la decisión v2.1.

### 3.3 Riesgo académico

- Si el profesor exige app móvil nativa, PWA puede ser insuficiente para la calificación
- PWA funciona offline pero no tiene acceso nativo a features de dispositivo

### 3.4 Pregunta formal al profesor

> **Para el requisito de app móvil, ¿se acepta una PWA cloud-first como app principal para la demo, o se requiere React Native con funcionalidad específica?**

### 3.5 Plan B: React Native companion app

Si el profesor exige React Native, alcance mínimo académico:

```
1. Login/Sesión
   - Autenticación con Supabase (mismo flujo que web)
   - Pantalla de inicio de sesión simple

2. Dashboard/Workspaces
   - Lista de workspaces del usuario
   - Navegación básica

3. Tareas/Horario básico
   - Listar tareas desde Planning Service
   - Ver horarios desde Planning Service

4. Abrir documento
   - WebView a la app principal o deep link
   - No requiere editor completo

5. Layout smartphone/tablet
   - Responsive para ambos formatos
```

**Alcance NO incluye:**
- Editor colaborativo
- Sincronización offline
- Notificaciones push nativas

**Complejidad:** Este companion es independiente del backend y puede trabajarse en paralelo si es requisito.

---

## 4. Vercel — Landing Page

### 4.1 Decisión

Agregar **landing page en Vercel** como capa de promoción:
- Dominio: `briefly.vercel.app` o similar
- Apunta a la app principal en CloudFront (`xxxxx.cloudfront.net`)
- Solo contenido estático/promoción
- No maneja datos de usuario

### 4.2 Justificación

La rúbrica menciona frontend en Vercel para promoción/landing y app en AWS.
Esta decisión mantiene la app principal en AWS/CloudFront y usa Vercel solo para landing.

### 4.3 Implementación futura (post-PM-01)

- Crear repo separado o carpeta `apps/landing`
- Deploy automático desde GitHub
- Apuntar CNAME o redirect a CloudFront

---

## 5. CI/CD con GitHub Actions

### 5.1 Pipeline mínimo propuesto

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  validate-docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Validate docker-compose config
        run: docker compose config --quiet

      - name: Build all images
        run: docker compose build --parallel

  validate-backend:
    runs-on: ubuntu-latest
    container: python:3.12-slim
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: pip install pyright

      - name: Type check each service
        run: |
          pyright apps/backend/workspace-service/
          pyright apps/backend/collaboration-service/
          pyright apps/backend/planning-service/
          pyright apps/backend/intelligence-service/
          pyright apps/backend/utility-service/

  validate-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install and build
        run: |
          npm ci
          npm run build --workspaces --if-present

  check-env-not-committed:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check .env is not tracked
        run: |
          if git ls-files --error-unmatch .env 2>/dev/null; then
            echo "ERROR: .env is tracked in git!"
            exit 1
          fi
          echo ".env correctly ignored"
```

### 5.2 CD para demo (v1)

Para la demo de 2 horas, **despliegue manual o semi-manual a EC2** es aceptable:
- Build de imágenes → push a ECR (o usar local)
- SSH a EC2 → docker compose pull && docker compose up -d

**Pipeline CD completo** es mejora post-demo.

---

## 6. Nginx /collab/* — Hotfix PM-01

### 6.1 Problema original

El `rewrite ^/collab/(.*) /$1 break;` hacía strip del prefijo `/collab/*`, transformando `/collab/{workspace_id}/{document_id}` en `/{workspace_id}/{document_id}`.

### 6.2 Corrección aplicada (PM-01 hotfix)

- **Eliminado** el `rewrite` del bloque `location ~ ^/collab/`
- **Collaboration Service** ahora tiene `router = APIRouter(prefix="/collab")`
- Las peticiones llegan al servicio como `/collab/*` (prefijo preservado)
- Esto es **necesario para PM-03 con pycrdt-websocket**

### 6.3 Estado actual

- `/collab/health` con secret correcto → 200 OK ✅
- `/collab/health` sin secret → 401 Unauthorized ✅
- `/collab/health` con secret wrong → 401 Unauthorized ✅
- Ningún otro routing cambió

---

## 7. Roadmap actualizado v2.2

### 7.1 Orden propuesta

```
1. [COMPLETADO] PM-01 Foundation local + hotfix /collab/*
2. [ESTE DOCUMENTO] v2.2 alineación rúbrica → commit
3. [PENDIENTE] Preguntas al profesor sobre:
   - Bases de datos independientes: ownership vs separación física
   - React Native vs PWA
4. [SI ACEPTA] PM-02 Workspace Service + Supabase Auth
   [SI EXIGE DB FÍSICA] Ajustar diseño antes de PM-02
   [SI EXIGE RN] Agregar companion app en paralelo
5. PM-03 Collaboration + pycrdt-websocket
6. PM-04 Planning REST
7. PM-05 Intelligence/Utility
8. PM-06 Frontend PWA
9. PM-07 AWS deployment + landing Vercel
10. PM-08 Burn-in + demo
```

### 7.2 Commitments antes de profesor

**NO avanzar a PM-02 hasta tener respuesta sobre:**
1. Bases de datos independientes (ownership DynamoDB o separación física)
2. React Native (obligatorio o PWA suficiente)

---

## 8. Resumen de decisiones v2.2

| Tema | Decisión v2.1 | Cambio en v2.2 | Estado |
|---|---|---|---|
| Bases de datos | Ownership DynamoDB/S3 por servicio | Registrar riesgo y opciones B1/B2/B3 | **Pregunta abierta al profesor** |
| Microservice autonomía | Implícito | Regla formalizada + modo degradado documentado | Válido |
| Mobile app | PWA | Registrar riesgo si RN es exigido | **Pregunta abierta al profesor** |
| Vercel | No mencionado | Añadir landing page en Vercel como加分项 | Decisión nueva |
| CI/CD | No mencionado | Pipeline mínimo GitHub Actions propuesto | Decisión nueva |
| Nginx /collab/* | Strip prefix original | Hotfix: prefix preservado | **Completado en PM-01** |

---

## 9. Riesgos abiertos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Profesor exige 5 motores DB físicos separados | **ALTA** | Opciones B1/B2 documentadas; responder pregunta antes de PM-02 |
| Profesor exige React Native | **MEDIA** | Plan B de companion app documentado; bajo impacto si se responde a tiempo |
| Landing Vercel no desplegada | **BAJA** | Decisión opcional; no bloquea demo |
| CI/CD no implementado para demo | **BAJA** | Manual deploy aceptable para v1 |

---

## 10. Preguntas exactas para el profesor

### Pregunta 1 — Bases de datos independientes

> Para el requisito de "5 bases de datos independientes", ¿se acepta independencia por **ownership de persistencia** usando tablas DynamoDB y buckets S3 exclusivos por microservicio, o se requiere que cada microservicio tenga una **instancia/motor de base de datos físicamente separado**?

**Si la respuesta es "físicamente separado"**,，那我们可以在 Docker Compose中添加轻量级数据库容器（SQLite 或 PostgreSQL）来满足这一要求，而不需要额外的云资源。

### Pregunta 2 — React Native

> Para el requisito de app móvil, ¿se acepta una **PWA cloud-first** como app principal para la demo, o se requiere una implementación específica en **React Native**?

**Si la respuesta es "React Native obligatorio"**, el alcance mínimo del companion está documentado en la sección 3.5 de este addendum.

---

## 11. Confirmación de no-implementación

Este documento **NO** contiene:
- Código implementado o modificado
- Cambios en Docker Compose, Nginx o servicios
- Decisiones que requieran cambios en infraestructura existente
- Frontend, auth, JWT, DynamoDB, S3, pycrdt o cualquier funcionalidad de PM-02+

**Solo registra:** decisiones, riesgos, preguntas abiertas y opciones para discusión con el profesor antes de continuar con PM-02.