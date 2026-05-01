# DEPLOY-02: HTTPS with Nginx Docker + Let's Encrypt (No-IP)

**Fecha:** 2026-05-01
**Estado:** Config listo — emisión pendiente de primera certificate

---

## Arquitectura

```
Internet → EC2:443 (HTTPS) → Nginx container → backend services
Internet → EC2:80 (HTTP)  → Nginx container → (ACME HTTP-01) → HTTP frontend during bootstrap
```

**Two nginx config files:**
- `nginx.conf.template` — **HTTPS final** (SSL + SPA + API proxy). Used after cert issuance.
- `nginx.http-only.conf.template` — **HTTP-only bootstrap** (no SSL, serves ACME, proxies API).
  Used only during certificate issuance, then swapped back to `nginx.conf.template`.

**Cambios respecto a DEPLOY-01:**
- Nginx publica puertos `80` y `443` (antes solo `80`)
- Volumes Docker para certificados Let's Encrypt y webroot ACME
- `/api/schedule` routing activado
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
# Esperado:Address: <EC2_PUBLIC_IP>
```

---

## Secuencia de emisión (primera vez)

### Paso 0 — Verificar precondiciones

```bash
# Desde local — verificar que DNS apunta a EC2
nslookup briefly.ddns.net

# Desde EC2 — verificar que puertos 80 y 443 responden
curl -s -o /dev/null -w "%{http_code}" http://briefly.ddns.net/
# Esperado: 200 (HTTP actual si ya hay deploy)
```

### Paso 1 — Actualizar repo en EC2

```bash
# Desde local
rsync -avz --exclude='node_modules' --exclude='.git' \
  ./ec2-user@<EC2_IP>:~/briefly/
```

### Paso 2 — Rebuild Docker images

```bash
# En EC2
cd ~/briefly
docker compose -f docker-compose.ec2.yml build
```

### Paso 3 — Iniciar con config HTTP-only bootstrap

```bash
# Copiar la config bootstrap como la activa temporalmente
cp infra/nginx/nginx.http-only.conf.template /tmp/nginx-bootstrap.conf.template
docker compose -f docker-compose.ec2.yml run --rm \
  -v /tmp/nginx-bootstrap.conf.template:/etc/nginx/templates/default.conf.template \
  nginx nginx -t
# Si OK:
docker compose -f docker-compose.ec2.yml up -d
```

En este punto:
- `http://briefly.ddns.net/` → funciona (HTTP, SPA + API proxypass)
- `https://briefly.ddns.net/` → **no funciona todavía** (sin certificados)

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

Si succeeds, ver:
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/briefly.ddns.net/fullchain.pem
```

### Paso 5 — Verificar staging certificate

```bash
# Verificar que los archivos de certificado existen
docker compose -f docker-compose.ec2.yml exec nginx \
  ls -la /etc/letsencrypt/live/briefly.ddns.net/

# Verificar HTTP responde
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

### Paso 7 — Restaurar config HTTPS final y recargar

```bash
# Restaurar nginx.conf.template como la activa
# El volumen ya apunta a infra/nginx/nginx.conf.template en el host
# Solo necesitamos recargar:
docker compose -f docker-compose.ec2.yml exec nginx nginx -s reload

# Si el archivo no fue actualizado via volume mount:
# Copiar manualmente:
docker compose -f docker-compose.ec2.yml exec nginx \
  sh -c 'cp /etc/nginx/templates/nginx.http-only.conf.template /etc/nginx/templates/default.conf.template || true'

# Mejor approach — rebuild nginx con el template correcto ya en su lugar:
docker compose -f docker-compose.ec2.yml up -d --build nginx
```

### Paso 8 — Verificar HTTPS producción

```bash
curl -s -o /dev/null -w "%{http_code}" https://briefly.ddns.net/
curl -s -o /dev/null -w "%{http_code}" https://briefly.ddns.net/health
curl -s -o /dev/null -w "%{http_code}" https://briefly.ddns.net/api/workspace/health
curl -s -o /dev/null -w "%{http_code}" https://briefly.ddns.net/api/planning/health

# HTTP redirect
curl -s -o /dev/null -w "%{http_code}" http://briefly.ddns.net/
# Esperado: 200 (sin redirect — HTTP-only bootstrap ya no está activo)
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

El container `certbot` tiene entrypoint que ejecuta `certbot renew` cada 12h. Para que nginx recargue tras renovar:

```bash
# Crear hook script
docker compose -f docker-compose.ec2.yml exec certbot \
  sh -c 'echo "#!/bin/sh" > /usr/local/bin/reload-nginx.sh && \
        echo "nginx -s reload" >> /usr/local/bin/reload-nginx.sh && \
        chmod +x /usr/local/bin/reload-nginx.sh'
```

Luego en el comando certbot renew, usar `--deploy-hook "nginx -s reload"`.

---

## Smoke tests

```bash
# HTTPS endpoints
curl https://briefly.ddns.net/                           # 200
curl https://briefly.ddns.net/health                     # 200
curl https://briefly.ddns.net/api/workspace/health       # 200
curl https://briefly.ddns.net/api/planning/health        # 200

# HTTP (debería servir SPA HTTP, no redirect-loop)
curl -s -o /dev/null -w "%{http_code}" http://briefly.ddns.net/
# Esperado: 200 (HTTP bootstrap solo durante issuance; después de HTTPS, HTTP también responde)

# ACME challenge path
curl -s -o /dev/null -w "%{http_code}" http://briefly.ddns.net/.well-known/acme-challenge/test
# Esperado: 404 (sin archivo de test)
```

---

## Rollback

Si HTTPS falla y necesitas volver a HTTP-only:

```bash
# 1. Detener stack
docker compose -f docker-compose.ec2.yml down

# 2. Eliminar volúmenes de certificados
docker volume rm briefly_certbot-www briefly_certbot-certs

# 3. Restaurar nginx.conf.template original (HTTP-only bootstrap)
cp infra/nginx/nginx.http-only.conf.template infra/nginx/nginx.conf.template

# 4. Restaurar Supabase Site URL a http://

# 5. Cambiar EXPO_PUBLIC_API_BASE_URL a http:// en mobile

# 6. Rebuild y restart
docker compose -f docker-compose.ec2.yml build
docker compose -f docker-compose.ec2.yml up -d
```

---

## Notas

- **Rate limits Let's Encrypt:** 5 certificados por dominio por semana. Usar `--staging` para pruebas.
- **IP cambia al reiniciar EC2:** No-IP debe actualizarse manualmente post-reinicio. El certificado Let's Encrypt está bindeado al dominio, no a la IP.
- **Android cleartext config:** `network_security_config.xml` que permite `briefly.ddns.net` en cleartext puede mantenerse — no afecta tráfico HTTPS.
- **No usar certbot --apache:** El certbot container con webroot es el approach válido para nginx Docker.
- **bootstrap config (nginx.http-only.conf.template):** No debe usarse en producción normal. Es solo para la primera emisión de certificados. Después de la emisión, `nginx.conf.template` (HTTPS) es el archivo activo.

---

## Archivos changed in DEPLOY-02A

| Archivo | Cambio |
|---|---|
| `docker-compose.ec2.yml` | Puerto 443, volúmenes certbot, comment actualizado |
| `infra/nginx/nginx.conf.template` | SSL server block, HTTP ACME + redirect, `/api/schedule/` routing |
| `infra/nginx/nginx.http-only.conf.template` | **Nuevo** — HTTP-only bootstrap config (no SSL) |
| `apps/mobile/.env.example` | `http://` → `https://` |
| `docs/deploy/DEPLOY-02-https-noip-nginx.md` | **Nuevo** — este documento con bootstrap strategy documentada |