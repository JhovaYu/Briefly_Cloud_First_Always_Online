# DEPLOY-02: HTTPS with Nginx Docker + Let's Encrypt (No-IP)

**Fecha:** 2026-05-01
**Estado:** Config listo — emisión pendiente de primera certificate

---

## Arquitectura

```
Internet → EC2:443 (HTTPS) → Nginx container → backend services
Internet → EC2:80 (HTTP)  → Nginx container → (ACME HTTP-01) + SPA
```

**Two nginx config files:**
- `nginx.conf.template` — **HTTPS final** (SSL + SPA + API proxy). Used after cert issuance.
- `nginx.http-only.conf.template` — **HTTP-only bootstrap** (no SSL, serves ACME, proxies API).
  Used only during certificate issuance, then swapped back to `nginx.conf.template`.

**Rutas activas:**
- `/` → SPA static frontend
- `/health` → nginx inline JSON
- `/api/workspace/` → workspace-service:8001
- `/api/planning/` → planning-service:8003
- `/api/intelligence/` → intelligence-service:8004
- `/api/utility/` → utility-service:8005
- `/collab/` → collaboration-service:8002 (WebSocket)
- `/.well-known/acme-challenge/` → certbot webroot

**`/api/schedule/` NO incluido todavía** — queda pendiente para PM-06F.2 cuando schedule-service
exista en docker-compose.ec2.yml. No añadir upstream ni location `/api/schedule/` hasta entonces.

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

`/health` público sigue funcionando en HTTPS (puerto 443) y como inline JSON en el server block 443.

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

El container `certbot` ejecuta `certbot renew` cada 12h. Para recargar nginx tras renovar:

```bash
docker compose -f docker-compose.ec2.yml exec certbot \
  sh -c 'echo "#!/bin/sh" > /usr/local/bin/reload-nginx.sh && \
        echo "nginx -s reload" >> /usr/local/bin/reload-nginx.sh && \
        chmod +x /usr/local/bin/reload-nginx.sh'
```

---

## Smoke tests

```bash
curl https://briefly.ddns.net/                           # 200
curl https://briefly.ddns.net/health                     # 200
curl https://briefly.ddns.net/api/workspace/health       # 200
curl https://briefly.ddns.net/api/planning/health        # 200

curl -s -o /dev/null -w "%{http_code}" http://briefly.ddns.net/
# Esperado: 200 (HTTP serve durante bootstrap)

curl -s -o /dev/null -w "%{http_code}" http://briefly.ddns.net/.well-known/acme-challenge/test
# Esperado: 404 (sin archivo de test)
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
- **IP cambia al reiniciar EC2:** No-IP debe actualizarse post-reinicio. El cert está bindeado al dominio, no a la IP.
- **schedule-service pendiente:** `/api/schedule/` será añadido en PM-06F.2.
- **`nginx.http-only.conf.template`:** Solo para bootstrap. No debe ser el estado de producción normal.
- **No usar certbot --apache:** El certbot container con webroot es el approach válido para nginx Docker.

---

## Archivos cambiados en DEPLOY-02A

| Archivo | Cambio |
|---|---|
| `docker-compose.ec2.yml` | Puerto 443, volúmenes certbot, comment actualizado |
| `infra/nginx/nginx.conf.template` | SSL server block + todas las rutas activas (sin `/api/schedule/`) |
| `infra/nginx/nginx.http-only.conf.template` | **Nuevo** — HTTP-only bootstrap config (no SSL, ACME + API proxies) |
| `apps/mobile/.env.example` | `http://` → `https://` |
| `docs/deploy/DEPLOY-02-https-noip-nginx.md` | **Nuevo** — guía completa con bootstrap strategy |