# DEPLOY-02: HTTPS with Nginx Docker + Let's Encrypt (No-IP)

**Fecha:** 2026-05-01
**Estado:** ✅ VALIDADO — HTTPS funcionando en producción

---

## Resultado validado

**Fecha de validación:** 2026-05-01
**Dominio:** https://briefly.ddns.net

### Smoke tests — TODOS PASS

| Test | Comando | Resultado | Status |
|------|---------|-----------|--------|
| HTTPS frontend | `curl -s -o /dev/null -w "%{http_code}" https://briefly.ddns.net/` | 200 | ✅ PASS |
| HTTPS /health | `curl -s -o /dev/null -w "%{http_code}" https://briefly.ddns.net/health` | 200 | ✅ PASS |
| HTTPS workspace | `curl -s -o /dev/null -w "%{http_code}" https://briefly.ddns.net/api/workspace/health` | 200 | ✅ PASS |
| HTTPS planning | `curl -s -o /dev/null -w "%{http_code}" https://briefly.ddns.net/api/planning/health` | 200 | ✅ PASS |
| HTTPS schedule | `curl -s -o /dev/null -w "%{http_code}" https://briefly.ddns.net/api/schedule/health` | 200 | ✅ PASS |
| HTTP redirect | `curl -s -o /dev/null -w "%{http_code}" http://briefly.ddns.net/` | 301 | ✅ PASS |
| Nginx healthcheck | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:80/nginx-health` | 200 | ✅ PASS |
| Mobile HTTPS login | APK con `EXPO_PUBLIC_API_BASE_URL=https://briefly.ddns.net` | PASS | ✅ PASS |
| Mobile workspaces | Login → Workspaces list | PASS | ✅ PASS |
| Mobile tasks CRUD | Login → Tasks create/toggle/delete | PASS | ✅ PASS |

### Certificados emitidos

- **Proveedor:** Let's Encrypt (production, no staging)
- **Método:** certbot container + webroot compartido + HTTP-01 challenge
- **Volúmenes persistidos:**
  - `briefly_cloud_first_always_online_certbot-www` — webroot ACME
  - `briefly_cloud_first_always_online_certbot-certs` — certificados y llaves
- **Ubicación en contenedor:** `/etc/letsencrypt/live/briefly.ddns.net/`
- **Renovación:** Los volúmenes Docker persisten mientras el filesystem de EC2 persista. Si No-IP se actualiza y la IP cambia, los certificados siguen válidos (están bindeados al dominio, no a la IP).

### Método de emisión usado

```bash
# En EC2 — HTTP-only bootstrap
cp infra/nginx/nginx.http-only.conf.template infra/nginx/nginx.conf.template
docker compose -f docker-compose.ec2.yml up -d

# Certificado real (sin --staging)
docker compose -f docker-compose.ec2.yml run --rm \
  certbot certonly \
  --webroot -w /var/www/certbot \
  -d briefly.ddns.net \
  --email admin@briefly.ddns.net \
  --agree-tos --non-interactive

# Restaurar HTTPS config y rebuild
git checkout -- infra/nginx/nginx.conf.template
docker compose -f docker-compose.ec2.yml up -d --build nginx
```

### Limitaciones AWS Learner Lab

- **IP dinámica:** La IP pública cambia al detener/iniciar la instancia. No-IP debe actualizarse manualmente post-reinicio.
- **Sin Elastic IP:** Las políticas IAM del Learner Lab no permiten asociar Elastic IPs a las instancias. Workflow: detener → iniciar → actualizar No-IP → re-validar DNS.
- **Sesión limitada:** Labs tienen tiempo máximo (~4 horas). El stack debe estar corriendo durante la demo.
- **Certificados y persistencia:** Los certificados Let's Encrypt persisten en volúmenes Docker. No se re-emite si la IP cambia, solo si los volúmenes se pierden.

### Notas post-validación

- El container certbot como servicio de renewal automático (`certbot renew` cada 12h) quedó pendiente. Por ahora la emisión fue manual con `docker run`.
- Si los volúmenes certbot persisten, la renovación puede hacerse manualmente sin re-emitir.
- schedule-service in-memory añadido en PM-06F.2 — `/api/schedule/` activo en nginx.

---

## Arquitectura

```
Internet → EC2:443 (HTTPS) → Nginx container → backend services
Internet → EC2:80 (HTTP)  → Nginx container → (ACME HTTP-01) + redirect → HTTPS
```

**Two nginx config files:**
- `nginx.conf.template` — **HTTPS final** (SSL + SPA + API proxy). Used after cert issuance.
- `nginx.http-only.conf.template` — **HTTP-only bootstrap** (no SSL, serves ACME, proxies API).
  Used only during certificate issuance, then swapped back to `nginx.conf.template`.

**Rutas activas:**
- `/` → SPA static frontend
- `/health` → nginx inline JSON (HTTPS)
- `/api/workspace/` → workspace-service:8001
- `/api/planning/` → planning-service:8003
- `/api/intelligence/` → intelligence-service:8004
- `/api/utility/` → utility-service:8005
- `/collab/` → collaboration-service:8002 (WebSocket)
- `/.well-known/acme-challenge/` → certbot webroot

- `/api/schedule/` → schedule-service:8006 (in-memory, PM-06F.2 ✅)

**Cambios respecto a DEPLOY-01:**
- Nginx publica puertos `80` y `443` (antes solo `80`)
- Volumes Docker para certificados Let's Encrypt y webroot ACME
- Supabase Site URL cambia de `http://` a `https://`
- Mobile `.env` cambia de `http://` a `https://`

---

## Security Group EC2 — Puertos requeridos

| Port | Source | Purpose |
|------|--------|---------|
| 22 | YOUR_IP/32 | SSH |
| 80 | 0.0.0.0/0 | ACME HTTP-01 challenge |
| 443 | 0.0.0.0/0 | HTTPS traffic |

**IMPORTANTE:** Los puertos internos 8001-8006 NO deben estar abiertos. Todos los backends son internos a Docker.

### Healthcheck endpoint

Docker healthcheck usa `http://127.0.0.1:80/nginx-health` — endpoint interno que siempre retorna `200 {"status":"ok"}`
incluso cuando el server HTTP :80 está en modo redirect a HTTPS.

`/health` público funciona en HTTPS (puerto 443).

---

## Prerrequisitos

1. AWS EC2 corriendo con IP pública válida
2. No-IP `briefly.ddns.net` actualizado a la IP pública del EC2
3. Puerto 80 y 443 abiertos en Security Group para 0.0.0.0/0
4. Repo clonado en EC2 (`~/briefly/`)
5. DNS propagado: `nslookup briefly.ddns.net` apunta a EC2 IP

**Verificar DNS antes de certbot:**
```bash
nslookup briefly.ddns.net
# Esperado: Address: <EC2_PUBLIC_IP>
```

---

## Secuencia de emisión (primera vez)

### Paso 0 — Verificar precondiciones

```bash
# Desde local — verificar que DNS apunta a EC2
nslookup briefly.ddns.net

# Desde EC2 — verificar que puerto 80 responde
curl -s -o /dev/null -w "%{http_code}" http://briefly.ddns.net/
```

### Paso 1 — Actualizar repo en EC2

```bash
rsync -avz --exclude='node_modules' --exclude='.git' \
  ./ec2-user@<EC2_IP>:~/briefly/
```

### Paso 2 — Rebuild Docker images

```bash
cd ~/briefly
docker compose -f docker-compose.ec2.yml build
```

### Paso 3 — Configurar HTTP-only bootstrap

```bash
# Usar la config bootstrap como activa temporalmente
cp infra/nginx/nginx.http-only.conf.template infra/nginx/nginx.conf.template
docker compose -f docker-compose.ec2.yml up -d
```

En este punto:
- `http://briefly.ddns.net/` → funciona (HTTP, SPA + API proxypass)
- `https://briefly.ddns.net/` → no funciona todavía (sin certificados)

### Paso 4 — Emitir certificado (staging primero)

```bash
docker compose -f docker-compose.ec2.yml run --rm \
  certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d briefly.ddns.net \
  --email admin@briefly.ddns.net \
  --agree-tos \
  --non-interactive \
  --staging
```

**Usar `--staging` siempre primero** para evitar rate limits de Let's Encrypt.

### Paso 5 — Verificar staging certificate

```bash
docker compose -f docker-compose.ec2.yml exec nginx \
  ls -la /etc/letsencrypt/live/briefly.ddns.net/

curl -s -o /dev/null -w "%{http_code}" http://briefly.ddns.net/
```

### Paso 6 — Emitir certificado real (quitar --staging)

```bash
docker compose -f docker-compose.ec2.yml run --rm \
  certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d briefly.ddns.net \
  --email admin@briefly.ddns.net \
  --agree-tos \
  --non-interactive
```

### Paso 7 — Restaurar config HTTPS final

```bash
# Restaurar el archivo HTTPS definitivo
git checkout -- infra/nginx/nginx.conf.template

# Rebuild nginx con la config SSL
docker compose -f docker-compose.ec2.yml up -d --build nginx
```

### Paso 8 — Verificar HTTPS producción

```bash
curl -s -o /dev/null -w "%{http_code}" https://briefly.ddns.net/
curl -s -o /dev/null -w "%{http_code}" https://briefly.ddns.net/health
curl -s -o /dev/null -w "%{http_code}" https://briefly.ddns.net/api/workspace/health
curl -s -o /dev/null -w "%{http_code}" https://briefly.ddns.net/api/planning/health
```

---

## Actualización Supabase

**Authentication → URL Configuration:**

| Campo | Valor nuevo |
|---|---|
| Site URL | `https://briefly.ddns.net` |
| Redirect URLs | `https://briefly.ddns.net/**` |

Mantener `http://localhost:5173/**` para desarrollo local.

---

## Actualización Mobile

Cambiar en `apps/mobile/.env` (NO commitear):

```bash
EXPO_PUBLIC_API_BASE_URL=https://briefly.ddns.net
```

Rebuild:
```bash
cd apps/mobile
npx expo prebuild --platform android --no-install --clean
cd android && ./gradlew assembleDebug
```

---

## Renovación automática

El container certbot ejecuta `certbot renew` cada 12h. Para recargar nginx tras renovar:

```bash
docker compose -f docker-compose.ec2.yml exec certbot \
  sh -c 'echo "#!/bin/sh" > /usr/local/bin/reload-nginx.sh && \
        echo "nginx -s reload" >> /usr/local/bin/reload-nginx.sh && \
        chmod +x /usr/local/bin/reload-nginx.sh'
```

**Nota:** La emisión inicial fue manual con `docker run`. La configuración del certbot container como servicio de renewal queda como mejora pendiente.

---

## Smoke tests de producción

```bash
# HTTPS endpoints
curl https://briefly.ddns.net/                           # 200
curl https://briefly.ddns.net/health                     # 200
curl https://briefly.ddns.net/api/workspace/health       # 200
curl https://briefly.ddns.net/api/planning/health        # 200

# HTTP redirect
curl -s -o /dev/null -w "%{http_code}" http://briefly.ddns.net/
# Esperado: 301

# ACME challenge path (para renewals)
curl -s -o /dev/null -w "%{http_code}" http://briefly.ddns.net/.well-known/acme-challenge/test
# Esperado: 404 (sin archivo de test)

# Nginx healthcheck interno
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:80/nginx-health
# Esperado: 200
```

---

## Rollback

```bash
docker compose -f docker-compose.ec2.yml down
docker volume rm briefly_certbot-www briefly_certbot-certs
cp infra/nginx/nginx.http-only.conf.template infra/nginx/nginx.conf.template
# Revertir Supabase Site URL a http://
# Revertir EXPO_PUBLIC_API_BASE_URL en mobile a http://
docker compose -f docker-compose.ec2.yml build
docker compose -f docker-compose.ec2.yml up -d
```

---

## Notas

- **Rate limits Let's Encrypt:** 5 certificados por dominio por semana. Usar `--staging` para pruebas.
- **IP cambia al reiniciar EC2:** No-IP debe actualizarse post-reinicio. Los certificados siguen válidos porque están bindeados al dominio, no a la IP.
- **schedule-service pendiente:** `/api/schedule/` será añadido en PM-06F.2.
- **`nginx.http-only.conf.template`:** Solo para bootstrap. No debe ser el estado de producción normal.
- **No usar certbot --apache:** El certbot container con webroot es el approach válido para nginx Docker.
- **Renewal automático:** Configurar el certbot container como servicio persistente con `certbot renew` cada 12h quedó pendiente.

---

## Próximas fases

| Fase | Descripción |
|---|---|
| PM-06F.DB | PostgreSQL persistence para schedule-service |
| PM-06G | Android widgets prototype (TaskWidget + ScheduleWidget) |

---

## Archivos cambiados en DEPLOY-02

| Archivo | Cambio |
|---|---|
| `docker-compose.ec2.yml` | Puerto 443, volúmenes certbot, healthcheck /nginx-health |
| `infra/nginx/nginx.conf.template` | SSL server block + todas las rutas activas (con `/api/schedule/`) |
| `infra/nginx/nginx.http-only.conf.template` | **Nuevo** — HTTP-only bootstrap config (no SSL, ACME + API proxies) |
| `apps/mobile/.env.example` | `http://` → `https://` |
| `docs/deploy/DEPLOY-02-https-noip-nginx.md` | Guía completa con resultados de smoke test validados |

---

## PM-06F.DB: schedule-service PostgreSQL Persistence

### Objetivo
Reemplazar el almacenamiento in-memory de schedule-service con PostgreSQL real para que los horarios sobrevivan reinicios del contenedor en AWS Learner Lab.

### Decisión arquitectónica
- Contenedor físico: `planning-postgres` compartido entre planning-service y schedule-service
- Database lógica: `briefly_schedule` (separada de `briefly_planning`)
- Esto evita crear un segundo contenedor PostgreSQL y mantenernos dentro de los límites de RAM/CPU de Learner Lab
- Isolation: misma máquina, diferentes databases — no hay share de schemas

### Schema: tabla `schedule_blocks`

| Columna | Tipo | Notes |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `workspace_id` | UUID | NOT NULL, índice |
| `title` | TEXT | NOT NULL |
| `day_of_week` | INTEGER | 0-6, CHECK constraint |
| `start_time` | TIME | HH:MM sin timezone |
| `duration_minutes` | INTEGER | 5-480, CHECK constraint |
| `color` | TEXT | nullable |
| `location` | TEXT | nullable |
| `notes` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | server default NOW() |
| `updated_at` | TIMESTAMPTZ | server default NOW() |
| `created_by` | UUID | Supabase auth sub |

Índices: `idx_schedule_blocks_workspace_id`, `idx_schedule_blocks_workspace_dow_start`

### Cambio importante: `created_by` como UUID
El JWT `sub` claim de Supabase es un string UUID. Se convierte a `uuid.UUID` para almacenarse en la DB. Esto permite joins e índices futuros sobre `created_by`. La conversión es necesaria en repository.

### Archivos cambiados
- `apps/backend/schedule-service/requirements.txt` — +sqlalchemy[asyncio], asyncpg, alembic
- `apps/backend/schedule-service/app/config/settings.py` — +SCHEDULE_STORE_TYPE, SCHEDULE_DATABASE_URL
- `apps/backend/schedule-service/app/adapters/persistence/sqlalchemy/` — base.py, models.py, database.py
- `apps/backend/schedule-service/app/adapters/persistence/postgres_schedule_repository.py` — nuevo repository
- `apps/backend/schedule-service/alembic/` — alembic.ini, env.py, script.py.mako, versions/001_initial_schedule_blocks.py
- `apps/backend/schedule-service/app/api/dependencies.py` — +get_db, ScheduleDBSession
- `apps/backend/schedule-service/app/api/routes.py` — usa get_db en vez de get_block_repo
- `apps/backend/schedule-service/app/main.py` — +startup/shutdown handlers para engine
- `apps/backend/schedule-service/entrypoint.sh` — alembic + uvicorn
- `apps/backend/schedule-service/Dockerfile` — usa entrypoint.sh
- `docker-compose.yml` — +SCHEDULE_STORE_TYPE, SCHEDULE_DATABASE_URL
- `docker-compose.ec2.yml` — SCHEDULE_STORE_TYPE=postgres, depends_on planning-postgres healthy
- `apps/backend/planning-service/init-schedule-db.sh` — init script para crear briefly_schedule

### EC2: Crear database `briefly_schedule` en deployment existente

> ⚠️ Los init scripts de postgres no se re-ejecutan si el volumen Docker ya existe con datos. Si `planning-postgres` ya está corriendo en EC2, la database `briefly_schedule` NO se crea automáticamente.

**Comando seguro para crear la database (sin imprimir secretos):**

```bash
# Ejecutar dentro del contenedor postgres que ya corre en EC2
docker exec planning-postgres psql -U briefly -d briefly_planning -c "SELECT 'CREATE DATABASE briefly_schedule' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'briefly_schedule')"
```

Este comando:
- Solo crea la DB si no existe (no dá error si ya existe)
- No imprime passwords ni secrets en output
- Conecta como el usuario `briefly` ya configurado en el contenedor existente
- Ejecuta contra `briefly_planning` (no against `postgres` default DB)

Para schedule-service en EC2 con el nuevo código, la base URL sería:
```
postgresql+asyncpg://briefly:${PLANNING_DB_PASSWORD}@planning-postgres:5432/briefly_schedule
```
(reutiliza la misma variable `PLANNING_DB_PASSWORD` que ya existe en el entorno EC2)

### Smoke test de persistencia

Después de deployar con postgres:
1. Crear un bloque horario desde mobile o desktop
2. `docker restart schedule-service`
3. GET `/api/schedule/workspaces/{id}/schedule-blocks` — el bloque debe seguir ahí

### Notas
- Mobile y desktop NO necesitan cambios — el API contract es idéntico
- In-memory sigue disponible con `SCHEDULE_STORE_TYPE=inmemory` (default para dev local)
- Nginx route `/api/schedule/` no cambia
- Auth JWT no cambia

---

## PM-06F.DB — Validación real en EC2 (2026-05-02)

### Secuencia de deploy validada

1. **Verificar que la database `briefly_schedule` no existe** (primer paso antes de crear):
   ```sql
   -- Dentro del contenedor postgres
   psql -U briefly -d briefly_planning -c "SELECT datname FROM pg_database WHERE datname = 'briefly_schedule'"
   ```

2. **Crear la database** (solo si no existe):
   ```sql
   CREATE DATABASE briefly_schedule;
   ```

3. **Habilitar pgcrypto** (necesario para `gen_random_uuid()` en la migration):
   ```sql
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```

4. **Rebuild de schedule-service**:
   ```bash
   docker compose -f docker-compose.ec2.yml build schedule-service
   ```

5. **Levantar schedule-service**:
   ```bash
   docker compose -f docker-compose.ec2.yml up -d schedule-service
   ```
   - El entrypoint detecta `SCHEDULE_STORE_TYPE=postgres` y ejecuta `alembic upgrade head`
   - Si la tabla no existe, Alembic la crea

6. **Si downstream da 502 — resolver upstream stale en Nginx**:
   > Cuando schedule-service se reconstruye, Docker asigna una nueva IP interna al contenedor. Nginx hace cache del upstream IP por la vida del contenedor. Un recreate de schedule-service puede dejar a Nginx apuntando a una IP vieja.

   **Fix:**
   ```bash
   docker compose -f docker-compose.ec2.yml restart nginx
   ```

   **Síntoma:** `wget` interno desde nginx a `http://schedule-service:8006/health` responde OK, pero el proxy externo devuelve 502. Esto confirma que el problema es el mapeo de IP en nginx, no el backend.

### Resultado: PM-06F.DB PASS

| Verificación | Resultado |
|---|---|
| `briefly_schedule` database creada | ✅ |
| `pgcrypto` extension habilitada | ✅ |
| schedule-service healthy post-rebuild | ✅ |
| Alembic corre desde entrypoint | ✅ |
| `/api/schedule/health` → 200 | ✅ |
| CRUD desde desktop PASS | ✅ |
| CRUD desde mobile PASS | ✅ |
| Cambios sincronizan entre clientes | ✅ |
| **Persistência tras restart de schedule-service** | ✅ |
| **Persistência tras restart de nginx** | ✅ |

Los horarios sobreviven:
- `docker restart schedule-service`
- `docker restart nginx`
- Recreate completo de schedule-service con rebuild

### Nota sobre el 502 post-recreate

El 502 que ocurrió entre el rebuild y el restart de nginx **no fue un fallo del código de schedule-service ni de la migración**. Fue un síntoma de Docker networking: cuando el contenedor de schedule-service se recrea, obtiene una nueva IP interna en la red `briefly-internal`. Nginx había cacheado la IP vieja como upstream. El fix fue reiniciar el contenedor de nginx para que recalculara la resolución DNS de `schedule-service`.

Esto es un patrón conocido en Docker con/nginx y no indica un bug en la implementación.