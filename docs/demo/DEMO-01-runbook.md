# DEMO-01 — Demo Runbook: Cloud-First Backend con PostgreSQL Persistence

**Fecha:** 2026-04-28
**HEAD:** `823a7ed PM-04.4B2 connect TasksScreen to planning cloud backend`
**Scope:** Documentación y comandos — sin implementación nueva

---

## A. Objetivo de la Demo

Demostrar que:

1. La arquitectura cloud-first/always-online funciona end-to-end
2. Workspace-service provee auth JWT + workspace management
3. Planning-service ofrece REST API con PostgreSQL real persistence
4. Persistence after restart está validada
5. CRDT/S3 snapshots fueron validados en PM-03E (evidencia ya disponible)
6. El frontend desktop tiene integración Planning cloud funcional (PM-04.4B2) — TasksScreen conecta a planning-service via Vite proxy en dev, badge cloud, CRUD completo

**Audiencia:** Profesor — confirmó que S3 + PostgreSQL está bien, camino actual está bien, costos/AWS Console Importantes.

---

## B. Arquitectura a Explicar (2 minutos)

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER / FRONTEND                        │
│              (Electron desktop app — P2P local-first)        │
└──────────────┬──────────────────┬──────────────────────────┘
               │ Supabase JWT     │ Yjs/WebRTC P2P
               ▼                 ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│   workspace-service      │  │  collaboration-service       │
│        :8001             │  │        :8002                  │
│   FastAPI                │  │  pycrdt-websocket + Yjs        │
│   Auth + workspace CRUD  │  │  Local volume snapshots        │
└────────────┬─────────────┘  │  S3 opt-in                   │
             │                └──────────────┬───────────────┘
             │                             │
             ▼                             ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│  Supabase Auth           │  │  S3 (opt-in)                  │
│  JWKS endpoint           │  │  briefly-cloud-first-collab    │
└──────────────────────────┘  │  -snapshots-dev               │
                              └──────────────────────────────┘
┌──────────────────────────┐
│   planning-service        │
│        :8003              │
│   FastAPI + PostgreSQL    │
│   Task + TaskList CRUD   │
│   inmemory (default)     │
│   postgres (opt-in)      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  planning-postgres        │
│     :5433 (host)          │
│  Postgres 16 Alpine       │
│  briefly_planning DB     │
└──────────────────────────┘
```

**Stack:**
- **Auth:** Supabase JWT via JWKS (validado localmente)
- **Workspace:** FastAPI REST sobre Supabase
- **Collaboration:** pycrdt-websocket + Yjs CRDT, snapshots a local volume o S3
- **Planning:** FastAPI REST + SQLAlchemy 2.0 async + asyncpg + Postgres
- **Nginx:** Reverse proxy en puerto 80 (opcional para demo local)

**Decisiones de costo visibles:**
- PostgreSQL local (`planning-postgres:5432`) para evitar costos RDS
- S3 snapshots opt-in, no obligatorio para demo
- AWS Academy solo si se demuestra S3 real

---

## C. Pre-Demo Checklist

### Día de demo — ejecutar ANTES de empezar

```powershell
# 1. Git status limpio
git status --short --untracked-files=all
# Esperado: sin output

# 2. Helpers disponibles
. .\tools\briefly\Briefly.Safety.ps1

# 3. bpreflight
bpreflight
# Esperado: clean, no staged dangerous files

# 4. bsecretcheck
bsecretcheck
# Esperado: PASS

# 5. JWT status
bjwtsafe
# Esperado: SUPABASE_TEST_JWT present True, minutes_remaining > 5
# Si expired: bjwt para refrescar (requiere intervención manual, humano approve)

# 6. Docker Desktop abierto
docker compose ps
# Esperado: todos los containers en estado healthy o exit 0

# 7. AWS Academy (solo si se demostrará S3)
# NO ejecutar sin preguntar al profesor
#aws sts get-caller-identity  # solo si explicitly requested
```

### Planning UI Cloud (PM-04.4B2) — nota dev

El frontend desktop (`apps/desktop/`) ahora tiene integración cloud funcional:
- TasksScreen conecta a planning-service via Vite proxy en dev (`/api/planning`, `/api/workspace`)
- Badge ☁️ cloud aparece cuando `VITE_PLANNING_BACKEND_ENABLED=true`
- CRUD de tareas funciona end-to-end
- Modo local/Yjs preservado con `VITE_PLANNING_BACKEND_ENABLED=false`

Limitaciones conocidas:
- Sync local/Yjs ↔ cloud REST no implementado (TasksScreen usa un path u otro)
- CORS packaged/prod requiere headers reales o reverse proxy Nginx

### Warm-up commands (orden estricto)

```powershell
# Asegurar imágenes frescas
docker compose build --no-cache planning-service collaboration-service

# Levantar servicios (no intelligence ni utility — son skeletons)
docker compose up -d workspace-service planning-postgres planning-service collaboration-service

# Esperar health
sleep 10
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
# Esperado: {"status":"ok"} de cada uno

# Verificar Postgres ready
docker compose ps planning-postgres
# Esperado: Healthy

# Upgrade migrations si planning-service en postgres mode
# (smoke script lo hace automáticamente, no requerido manualmente)
```

---

## D. Comandos de Arranque

### D1. Arrancar todo (inmemory default)

```powershell
docker compose up -d
# Espera ~15s
curl http://localhost:8001/health   # workspace-service
curl http://localhost:8002/health   # collaboration-service
curl http://localhost:8003/health   # planning-service
```

### D2. Arrancar con Postgres persistence

```powershell
# Variables para postgres mode
$env:PLANNING_STORE_TYPE = "postgres"
$env:PLANNING_DATABASE_URL = "postgresql+asyncpg://briefly:briefly_dev_password@planning-postgres:5432/briefly_planning"

# Recrear planning-service con postgres config
docker compose build --no-cache planning-service
docker compose up -d --force-recreate planning-service

# Esperar
sleep 10

# Verificar env dentro del container (NO imprimir URL completa)
docker exec planning-service env | findstr PLANNING_STORE_TYPE
docker exec planning-service env | findstr PLANNING_DATABASE_URL
# Esperado: PLANNING_STORE_TYPE=postgres, DATABASE_URL present (valor no impreso)
```

### D3. Alembic migrations (Postgres mode)

```powershell
# Solo si se quiere verificar migrations manualmente
docker exec planning-postgres psql -U briefly -d briefly_planning -c "\dt"
docker exec planning-service sh -c "alembic upgrade head"
docker exec planning-service sh -c "alembic current"
```

### D4. Health checks individuales

```powershell
# Workspace
curl http://localhost:8001/health
curl http://localhost:8001/healthz

# Collaboration
curl http://localhost:8002/health
curl http://localhost:8002/healthz

# Planning
curl http://localhost:8003/health
curl http://localhost:8003/healthz

# Postgres
docker exec planning-postgres pg_isready -U briefly -d briefly_planning
docker compose ps planning-postgres
```

---

## E. Demo Path Recomendado

### Tiempo total estimado: 20-25 minutos

### E1. Introducción Arquitectura (3 min)

- Mostrar diagrama en pantalla
- Explicar: Supabase JWT → workspace-service → collaboration-service (CRDT) → planning-service (Postgres)
- Mencionar: S3 snapshots opt-in, costo controlado con Postgres local

### E2. Health Checks en vivo (2 min)

```powershell
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
docker compose ps
```

### E3. Planning API Smoke — inmemory (3 min)

```powershell
# Desde apps/backend/planning-service/
cd apps/backend/planning-service
$env:SUPABASE_TEST_JWT = "your_jwt_here"  # NO hardcodear, usar bjwt output
python smoke/planning_api_smoke.py
```

**Expected output:**
```
PM-04.1B Planning Service Runtime Smoke Test
[STEP] Create workspace            201 PASS
[STEP] Create task-list            201 PASS
[STEP] List task-lists             200 PASS
[STEP] Create task                201 PASS
[STEP] List tasks                 200 PASS
[STEP] Update task state to working 200 PASS
[STEP] List tasks after update confirms persisted value 200 PASS
[STEP] Delete task                204 PASS
[STEP] Task removed after delete   PASS
[STEP] 401 without auth           PASS
[STEP] 401 invalid token          PASS
SMOKE TEST: ALL CHECKS PASSED
```

### E4. Planning API Smoke — postgres (5 min)

```powershell
# Recrear en postgres mode
docker compose stop planning-service
$env:PLANNING_STORE_TYPE = "postgres"
docker compose build --no-cache planning-service
docker compose up -d --force-recreate planning-service
sleep 10

# Ejecutar smoke
cd apps/backend/planning-service
python smoke/planning_api_smoke.py
```

**Same expected output — demuestra que la API es idéntica.**

### E5. Persistence After Restart (3 min)

```powershell
# 1. Crear datos en postgres mode (ya están si E4 pasó)
# 2. Verificar task existe
curl http://localhost:8003/workspaces/{workspace_id}/tasks -H "Authorization: Bearer $env:SUPABASE_TEST_JWT"

# 3. Reiniciar SOLO planning-service (NO postgres)
docker compose stop planning-service
docker compose start planning-service
sleep 10

# 4. Verificar que el task sigue ahí
curl http://localhost:8003/workspaces/{workspace_id}/tasks -H "Authorization: Bearer $env:SUPABASE_TEST_JWT"
```

**Confirma: datos sobreviven restart del service sin perder postgres.**

### E6. PM-03E S3 Hard Restore — evidencia ya validada (2 min)

- Explicar que PM-03E ya fue validado por APEX PRIME
- Mostrar `docs/migration/latest_handoff.md` sección PM-03E.5D
- Key finding: `Provider C restored: "Local Hard Restore Proof 1777264..."`
- No ejecutar smoke de S3 en vivo — es opt-in y requiere `.env.s3`

### E7. Frontend — estado actual (3 min)

**Mostrar desktop app si está disponible:**
```powershell
cd apps/desktop
npm run electron:dev
```

**Lo que funciona hoy:**
- Pool workspace P2P (Yjs/WebRTC local)
- Task board con Kanban (local Yjs)
- Auth UI (Supabase)

**Lo que falta (próximo slice):**
- TasksScreen → planning-service (8003)
- PoolWorkspace → collaboration-service (8002) REST/WS

** framing:** "El frontend actual es local-first P2P. El siguiente slice conecta la vista de tasks al backend cloud-first."

### E8. Cierre yPróximos Pasos (2 min)

- PM-04.2 completado: Postgres persistence ✅
- PM-04.4 es siguiente: frontend Planning integration
- PM-05: Intelligence/Utility services
- Costos controlados: Postgres local, S3 opt-in

---

## F. Scripts y Comandos Existentes

### F1. `planning_api_smoke.py`

**Ubicación:** `apps/backend/planning-service/smoke/planning_api_smoke.py`

**Uso:**
```bash
cd apps/backend/planning-service
export SUPABASE_TEST_JWT="<jwt_from_bjwt>"
python smoke/planning_api_smoke.py
```

**Qué valida:**
- Create/List/Update/Delete task-lists y tasks
- Auth 401 sin token
- Auth 401 con token inválido
- Persistence after update

**No imprime:** JWT, Authorization header, secrets

### F2. `tx_lifecycle_smoke.py`

**Ubicación:** `apps/backend/planning-service/smoke/tx_lifecycle_smoke.py`

**Uso:**
```bash
cd apps/backend/planning-service
python smoke/tx_lifecycle_smoke.py
```

**Qué valida:**
- DBSession commits on success
- DBSession rollbacks on exception
- DBSession closes always
- inmemory no-op

**Nota:** No requiere JWT — prueba el lifecycle transaccional in-process.

### F3. Collaboration S3 Smoke Scripts (referencia, no ejecutar)

Existentes en `apps/backend/collaboration-service/smoke/` — referencia:
- `yjs-local-hard-restore-smoke.mjs` — local volume restore
- S3 live/perodic/restart smokes — requieren `.env.s3` y AWS Academy

**No ejecutar en demo sin `.env.s3` configurado y profesor explicitly requests S3 demo.**

### F4. Ver logs sin imprimir secrets

```powershell
# Logs de planning-service (solo líneas con "error" o "warning")
docker logs planning-service 2>&1 | findstr /i "error warning exception"

# Ver env del container (valores presentes, no impreso)
docker exec planning-service env | findstr PLANNING_

# Ver uptime y status
docker compose ps planning-service
docker compose ps planning-postgres
```

---

## G. Troubleshooting

### G1. JWT expired

**Síntoma:** Smoke devuelve 401

**Diagnóstico:**
```powershell
bjwtsafe
# Ver: minutes_remaining = 0 o exp en pasado
```

**Fix:**
```powershell
# En PowerShell, humana ejecuta:
bjwt
# Aprobar el comando manualmente
# Copiar el JWT output y setear
$env:SUPABASE_TEST_JWT = "<jwt>"
```

### G2. Docker stale image

**Síntoma:** `planning-service` devuelve 500 o errores de import

**Root cause:** Imagen cached con código viejo

**Fix:**
```powershell
docker compose build --no-cache planning-service
docker compose up -d --force-recreate planning-service
```

### G3. Postgres URL mismatch

**Síntoma:** `PLANNING_DATABASE_URL` resolve failures

**Host vs Container:**
- Host: `localhost:5433`
- Container interno: `planning-postgres:5432`

**Docker compose ya configura esto correctamente.**
Para verificar sin imprimir URL:
```powershell
docker exec planning-service env | findstr PLANNING_DATABASE_URL
# Output: PLANNING_DATABASE_URL=<valor presente, no impreso>
```

### G4. planning-service 500 en startup

**Diagnóstico:**
```powershell
docker logs planning-service 2>&1 | findstr /i "error exception"
docker exec planning-service env | findstr PLANNING_
```

**Common causes:**
1. `PLANNING_STORE_TYPE=postgres` pero `PLANNING_DATABASE_URL` vacío → fix: setear URL
2. `planning-postgres` no está healthy → fix: `docker compose up -d planning-postgres` primero
3. Alembic migration no corrió → fix: `docker exec planning-service sh -c "alembic upgrade head"`

### G5. AWS Academy expired

**Síntoma:** S3 operations fallan con `ExpiredTokenException` o similar

**Fix:** Humano refresca credenciales en AWS Console

**Mitigación:** S3 es opt-in para esta demo — no es blocking.

### G6. Puerto ocupado

**Síntoma:** `docker compose up` falla con "port already allocated"

**Diagnóstico:**
```powershell
netstat -ano | findstr "8001 8002 8003 5433"
```

**Fix:**
```powershell
# Identificar qué proceso usa el puerto
taskkill /PID <pid> /F
# O matar el container conflicted
docker compose stop <service>
docker compose up -d
```

### G7. bsecretcheck false positives

**Síntoma:** bsecretcheck reporta archivo con "AKIA" o "JWT"

**Common false positive:** Comentarios en código con ejemplos de credenciales genéricas

**Mitigación:**
- Verificar que el archivo reportado no tenga secretos reales
- Si es falso positivo, no agregar al gitignore ni modificar código

---

## H. Cost Safety Notes

### Principios
1. **PostgreSQL local** — `planning-postgres` en docker-compose usa imagen `postgres:16-alpine`, costo $0 en AWS Academy
2. **S3 opt-in** — solo se usa cuando `.env.s3` está configurado y el profesor explicitly requests S3 demo
3. **No RDS** — la base de datos de planning es local al container, no hay instancia managed
4. **Snapshot interval** — collaboration-service hace snapshots cada 30s cuando hay cambios, no constante

### Verificación de costos antes de demo
```powershell
# Solo si se va a usar S3
# Ir a AWS Console → Billing → Cost Explorer
# Buscar: briefly-cloud-first-collab-snapshots-dev
# Esperado: < $0.01 (demo usage)
```

### Después de demo
- Parar servicios que no se usan: `docker compose stop intelligence-service utility-service`
- No dejar containers corriendo innecesariamente: `docker compose stop` (mantiene datos en volumes)

---

## I. Demo Narrative

### "Qué problema resuelve Briefly"

Briefly es una app de notas colaborativas P2P que necesita persistencia cloud-first y always-online. El modelo actual usa Yjs/WebRTC para colaboración en tiempo real, pero sin backend cloud los datos se pierden si el peer inicial no está disponible.

### "Qué estoy mostrando"

Estoy mostrando la capa backend cloud-first: auth JWT, workspace management, y un servicio de planning con PostgreSQL real. El frontend actual es local-first P2P; la integración con cloud-backends es el siguiente slice.

### "Qué demuestra cada smoke"

| Smoke | Qué demuestra |
|---|---|
| `planning_api_smoke.py` (inmemory) | REST API funciona end-to-end, auth 401 funciona |
| `planning_api_smoke.py` (postgres) | Misma API con Postgres real, persistence activa |
| Persistence after restart | Datos sobreviven restart del service sin perder DB |
| PM-03E S3 restore | CRDT snapshots en S3, Provider C restaura texto exacto |

### "Qué está listo"

- Workspace-service con JWT auth ✅
- Planning-service REST + PostgreSQL persistence ✅
- Persistence after restart ✅
- Docker compose con todos los servicios ✅

### "Qué queda como siguiente fase"

- Integración frontend TasksScreen → planning-service
- Integración PoolWorkspace → collaboration-service cloud-first
- PM-05 Intelligence/Utility services

---

## J. Criterios de Éxito

| Criterio | Verificación |
|---|---|
| `curl http://localhost:8001/health` → 200 | workspace-service healthy |
| `curl http://localhost:8002/health` → 200 | collaboration-service healthy |
| `curl http://localhost:8003/health` → 200 | planning-service healthy |
| `planning_api_smoke.py` (inmemory) → ALL PASS | API contract validada |
| `planning_api_smoke.py` (postgres) → ALL PASS | Postgres persistence validada |
| Persistence after restart → task found | Datos sobreviven restart |
| No secrets printed | bsecretcheck PASS antes y después |
| No AWS touched | Solo S3 opt-in, no forzado |
| Git clean before/after | `git status --short` vacío |

---

## K. Próximos Pasos

### Inmediato post-demo
- **PM-04.4:** Frontend Planning minimum integration — conectar TasksScreen a planning-service (8003)
- **DEMO-01C:** Optional — crear slide deck o checklist visual para futuras demos

### Post-PM-04.4
- **PM-05.1:** Intelligence service — implementar Gemini AI summaries
- **PM-05.2:** Utility service — QR, preview, text stats endpoints
- **PM-05.3:** Frontend integration — usar servicios de intelligence/utility

### Cost Safety
- **COST-01:** Documentar notas de costo AWS Academy para el profesor
- Revisar AWS Billing/Cost Explorer después de cada demo que use S3

---

## Validaciones Pre-Demo

```powershell
# Ejecutar en orden antes de cada demo

git status --short --untracked-files=all
# Esperado: sin output

. .\tools\briefly\Briefly.Safety.ps1
bpreflight
bsecretcheck
bjwtsafe

# Si JWT expired: humana ejecuta bjwt manualmente

docker compose build --no-cache planning-service
docker compose up -d
sleep 15

curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health

docker compose ps
```

---

## Notas para el Profesor

- Los servicios intelligence (8004) y utility (8005) son skeletons — no ejecutar
- collaboration-service (8002) tiene Yjs/WebRTC funcional, pero el frontend desktop lo usa P2P, no cloud-first aún
- S3 snapshots son opt-in, configurados via `.env.s3` (gitignored, no en repo)
- Postgres local (`planning-postgres:5432`) evita costos de RDS
- Costos AWS Academy controlados: solo S3 opt-in, todo lo demás local

---

*Runbook creado: 2026-04-28 — basado en DEMO-01A discovery + PM-04.2C3 close*
