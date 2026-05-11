# DEPLOY-01: EC2 Single-Host Docker Compose Demo

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  EC2 Single Host (AWS Academy Learner Lab)                     │
│                                                                 │
│  ┌──────────────┐  ┌─────────────────────────────────────────┐  │
│  │  nginx :80   │  │  Docker network (briefly-internal)       │  │
│  │  (public)    │  │                                          │  │
│  └──────┬───────┘  │  ┌──────────────────┐  ┌──────────────┐  │  │
│         │          │  │ workspace-service│  │  planning-  │  │  │
│         │          │  │     :8001 (int)  │  │  service    │  │  │
│         │          │  └────────┬─────────┘  │   :8003 (int)│  │  │
│         │          │           │           └──────┬──────┘  │  │
│         │          │           │                  │          │  │
│         │          │  ┌────────┴──────────────────┴──────┐ │  │
│         │          │  │        planning-postgres :5432     │ │  │
│         │          │  │        (postgres:16-alpine)        │ │  │
│         │          │  └───────────────────────────────────┘ │  │
│         │          │  ┌──────────┐  ┌───────────────────┐   │  │
│         │          │  │ collab-  │  │ intelligence-     │   │  │
│         │          │  │ service  │  │ service           │   │  │
│         │          │  │  :8002   │  │   :8004           │   │  │
│         │          │  └──────────┘  └───────────────────┘   │  │
│         │          │  ┌──────────────────┐                  │  │
│         │          │  │ utility-service  │                  │  │
│         │          │  │     :8005        │                  │  │
│         │          │  └──────────────────┘                  │  │
│         │          └─────────────────────────────────────────┘  │
│         │                                                       │
│  ┌──────┴───────┐                                               │
│  │  Port 80     │  HTTP only — HTTPS hardening next week        │
│  │  from 0/0    │                                               │
│  └─────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Security Group (EC2)

| Port | Source         | Purpose                          |
|------|----------------|----------------------------------|
| 22   | YOUR_IP/32     | SSH (you)                        |
| 80   | 0.0.0.0/0      | HTTP (nginx / frontend / API)    |
| 443  | 0.0.0.0/0      | HTTPS (future hardening week)     |

**DO NOT open ports 8001, 8002, 8003, 8004, 8005, 5432** — these are internal to the Docker network and must not be reachable from outside the instance.

---

## Nginx Authentication Model (IMPORTANT)

### How auth works

1. **Browser** sends `Authorization: Bearer <Supabase JWT>` to nginx
2. **Nginx** proxies the request to backend services, injecting `X-Shared-Secret` header upstream (service-to-service, backends ignore it)
3. **Backends** validate the JWT via Supabase JWKS — they do NOT validate `X-Shared-Secret`

### What nginx does NOT do

- Nginx does **NOT** require `X-Shared-Secret` from the browser
- Nginx does **NOT** validate JWTs — that is the backend's job
- The `X-Shared-Secret` validation that was previously in nginx config has been **removed** — it blocked legitimate browser requests

### What nginx does

- Proxies `Authorization` header to backends unchanged
- Injects `X-Shared-Secret` as an upstream header (backends can use it for internal service-to-service calls if needed)
- Handles WebSocket upgrade for `/collab/` route

---

## Supabase Configuration

For email/password auth to work from EC2:

1. Go to **Supabase Dashboard → Your Project → Authentication → URL Configuration**
2. Set **Site URL**: `http://<EC2_PUBLIC_IP>` (e.g., `http://52.12.34.56`) or `http://<EC2_IP>.nip.io`
3. Add to **Redirect URLs**:
   ```
   http://<EC2_PUBLIC_IP>/**
   http://<EC2_IP>.nip.io/**
   http://localhost:5173/**
   ```
4. **Authentication → Providers → Email**: Ensure email/password is enabled
5. **NOT today**: Google OAuth, custom domains, SSL certs

---

## Environment Variables for Deploy

Create a `.env` file on the EC2 instance:

```bash
# Supabase (from your project Settings → API)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json

# Shared secret for internal service communication (NOT sent by browser)
SHARED_SECRET=your_secure_random_secret_here

# Planning service database
PLANNING_DB_PASSWORD=briefly_dev_password

# Collaboration service
DOCUMENT_STORE_TYPE=local
DOCUMENT_STORE_PATH=/data/collab-snapshots
DOCUMENT_PERIODIC_SNAPSHOT_ENABLED=true
DOCUMENT_SNAPSHOT_INTERVAL_SECONDS=30
```

---

## Build & Deploy Steps

### 1. Build the frontend (local or CI)

```bash
cd apps/desktop
npm install

# Cloud demo build — relative URLs, works behind nginx proxy
# CRITICAL: VITE_COLLAB_USE_CLOUD_PROVIDER must be set at BUILD TIME (not runtime)
VITE_COLLAB_USE_CLOUD_PROVIDER=true \
VITE_PLANNING_BACKEND_ENABLED=true \
VITE_PLANNING_SERVICE_URL=/api/planning \
VITE_WORKSPACE_SERVICE_URL=/api/workspace \
VITE_SCHEDULE_BACKEND_ENABLED=true \
VITE_SCHEDULE_SERVICE_URL=/api/schedule \
VITE_SUPABASE_URL=https://your-project.supabase.co \
VITE_SUPABASE_ANON_KEY=your_anon_key_here \
VITE_DEV_PROXY_TARGET=https://briefly.ddns.net \
NODE_OPTIONS="--max-old-space-size=2048" \
npm run build
```

This produces `apps/desktop/dist/` — the Vite static build. The nginx Dockerfile copies it into the image at `/usr/share/nginx/html/`.

### Deploy nginx to EC2

```bash
docker compose -f docker-compose.ec2.yml build nginx
docker compose -f docker-compose.ec2.yml rm -sf nginx
docker compose -f docker-compose.ec2.yml up -d nginx
```

### 2. Transfer to EC2

```bash
# From your local repo root
rsync -avz --exclude='node_modules' --exclude='.git' \
  ./ec2-user@<EC2_IP>:~/briefly/
```

### 3. Build Docker images on EC2

```bash
cd ~/briefly

# Build all images (nginx includes the frontend baked in)
# Uses docker-compose.ec2.yml — STANDALONE, NOT combined with docker-compose.yml
docker compose -f docker-compose.ec2.yml build
```

### 4. Run database migrations

```bash
# Run Alembic migrations inside the planning-service container
docker compose -f docker-compose.ec2.yml \
  run --rm planning-service \
  alembic upgrade head
```

### 5. Start the stack

```bash
docker compose -f docker-compose.ec2.yml up -d
```

### 6. Verify exposed ports

```bash
# On EC2, verify only port 80 is published
docker ps

# Should show ONLY:
# - nginx :80->80/tcp
# - (no 8001, 8002, 8003, 8004, 8005, 5432 published)

# Also check with ss/netstat
ss -tlnp          # or: netstat -tlnp
```

### 7. Smoke tests

```bash
# Frontend static
curl http://localhost/                                   # → index.html (SPA)

# Nginx health
curl http://localhost/health                              # → {"status": "ok", "service": "nginx"}

# Workspace service health (via nginx proxy)
curl http://localhost/api/workspace/health                # → {"status": "ok", "service": "workspace-service"}

# Planning service health (via nginx proxy)
curl http://localhost/api/planning/health                 # → {"status": "ok", "service": "planning-service"}
curl http://localhost/api/planning/healthz                 # → {"status": "ok", "service": "planning-service"}
```

**Protected endpoints** (require valid Supabase JWT in browser, not curl):
- `GET /api/workspace/workspaces` — requires `Authorization: Bearer <token>`
- `GET /api/planning/workspaces/{id}/tasks` — requires `Authorization: Bearer <token>`

---

## API Path Mapping (Nginx → Services)

| Frontend calls                   | Nginx rewrite               | Backend receives              | Service         |
|----------------------------------|-----------------------------|------------------------------|-----------------|
| `GET /api/workspace/health`      | `^/api/workspace/(.*)` → `/health` | `GET /health`         | workspace:8001  |
| `GET /api/workspace/workspaces`  | `^/api/workspace/(.*)` → `/workspaces` | `GET /workspaces` | workspace:8001  |
| `GET /api/workspace/workspaces/{id}` | rewrite | `GET /workspaces/{id}` | workspace:8001  |
| `GET /api/planning/health`       | `^/api/planning/(.*)` → `/health` | `GET /health`     | planning:8003   |
| `GET /api/planning/healthz`      | rewrite | `GET /healthz`           | planning:8003    |
| `GET /api/planning/workspaces/{id}/tasks` | rewrite | `GET /workspaces/{id}/tasks` | planning:8003 |

**Critical fix from DEPLOY-01B**: Previously nginx used `/api/workspaces/` (plural) which did NOT match the frontend's `/api/workspace/` (singular). Now correctly uses `/api/workspace/` (singular).

---

## Nginx Configuration Decisions

### SPA fallback
```nginx
location / {
    root /usr/share/nginx/html;
    index index.html;
    try_files $uri $uri/ /index.html;
}
```
- Non-API requests fall back to `index.html`
- Enables client-side routing (state-based screen navigation)

### Browser auth — no X-Shared-Secret at nginx layer
```nginx
location ~ ^/api/workspace/ {
    rewrite ^/api/workspace/(.*) /$1 break;
    proxy_pass http://workspace;
    # Authorization: Bearer <JWT> passes through unchanged
    proxy_set_header X-Shared-Secret "${SHARED_SECRET}";  # upstream injection only
}
```
- Browser sends JWT via `Authorization` header → nginx passes it through to backend
- Nginx injects `X-Shared-Secret` only as an upstream header — backends ignore it for browser requests
- Backends validate JWT via Supabase JWKS

### WebSocket support for collaboration
```nginx
location ~ ^/collab/ {
    proxy_pass http://collaboration;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```
- Handles WebSocket upgrade for real-time collaboration

---

## docker-compose.ec2.yml vs docker-compose.yml

| File | Purpose | Ports |
|------|---------|-------|
| `docker-compose.yml` | Local development | All ports published (8001-8005, 5433, 80) |
| `docker-compose.ec2.yml` | EC2 production deploy | **Only nginx:80** — all backends internal |

**DO NOT combine them**: `docker compose -f docker-compose.yml -f docker-compose.ec2.yml` would still expose internal ports from the base file.

**Use ONLY**: `docker compose -f docker-compose.ec2.yml [command]`

---

## Known Limitations (Today)

- **HTTP only** — no HTTPS, no TLS. Browser may warn about mixed content if Supabase uses HTTPS but the EC2 app uses HTTP.
- **No local/Yjs ↔ cloud sync** — TasksScreen with `VITE_PLANNING_BACKEND_ENABLED=true` uses cloud only. `flag=false` preserves local/Yjs but no sync to cloud.
- **No Google OAuth** — Supabase Google provider not configured.
- **No custom domain** — using IP or nip.io.
- **No S3** — collaboration snapshots stored locally in Docker volume.
- **No RDS** — planning-postgres is a Docker container on the same host.
- **No CI/CD** — manual build + rsync + docker compose deploy.
- **No backup** — Postgres data in Docker volume, no external backup strategy.

---

## Current Deployed Demo

**Public URL:** http://13.221.217.108
**Status:** ✅ ACTIVE — deployed and smoke-tested (2026-04-28)

### Remote Health Checks

From any internet-connected machine:

```bash
# Frontend static
curl http://13.221.217.108/                    # → 200 index.html (SPA)

# Nginx health
curl http://13.221.217.108/health             # → 200 {"status":"ok","service":"nginx"}

# Workspace service (via nginx proxy)
curl http://13.221.217.108/api/workspace/health  # → 200 {"status":"ok","service":"workspace-service"}

# Planning service (via nginx proxy)
curl http://13.221.217.108/api/planning/health  # → 200 {"status":"ok","service":"planning-service"}
curl http://13.221.217.108/api/planning/healthz  # → 200 {"status":"ok","service":"planning-service"}
```

### Manual Smoke Checklist

From any browser:

| Test | Command/Action | Expected |
|---|---|---|
| Frontend loads | Open http://13.221.217.108 | App UI renders, no crash |
| Login | Supabase email/password login | Auth succeeds, no redirect error |
| Tasks cloud badge | Navigate to Tasks | ☁️ badge visible, "cloud" indicated |
| Create task | Add new task | Task appears in list |
| Change state | Mark task as working/done | State persists after reload |
| Multi-browser sync | Chrome ↔ Firefox/mobile | Same tasks visible, changes reflect |
| Persistence | Reload browser | Tasks remain from previous session |

### Troubleshooting: crypto.randomUUID crash

**Síntoma:** React crashes with `Uncaught TypeError: crypto.randomUUID is not a function` when entering Tasks.

**Root cause:** `crypto.randomUUID()` requires a secure context (HTTPS or localhost). HTTP public IP is not secure, so `crypto.randomUUID` is `undefined`.

**Fix (DEPLOY-01C.1):** All `crypto.randomUUID()` calls replaced with `createUuid()` helper in `packages/shared/src/logic/uuid.ts`. The helper uses fallback paths when Web Crypto is unavailable.

### Cost Warning

**Stop EC2 when not in use.** AWS Academy Learner Lab accounts have limited compute hours. When the demo is not active, stop the EC2 instance to avoid unexpected charges.

To stop:
```bash
aws ec2 stop-instances --instance-id <instance_id>
```

To restart:
```bash
aws ec2 start-instances --instance-id <instance_id>
```

### IP Change Warning

**If EC2 is stopped and started, the public IP will likely change** unless an Elastic IP is assigned. The current URL `http://13.221.217.108` may become invalid after a stop/start cycle.

To avoid this:
- Assign an Elastic IP (AWS Console → EC2 → Elastic IPs → Allocate)
- Update Supabase Redirect URLs if the IP changes
- Update any documentation with the new IP

For temporary demo deployments, stopping/starting is acceptable but the URL must be verified before each demo.

---

## Rollback

```bash
# Stop and remove containers (data volumes persist)
docker compose -f docker-compose.ec2.yml down

# To also wipe Postgres data:
docker compose -f docker-compose.ec2.yml down -v
```

---

## Files Changed in DEPLOY-01B / DEPLOY-01B.1 / DEPLOY-01B.2

| File | Change |
|------|--------|
| `infra/nginx/nginx.conf.template` | Fixed `/api/workspaces/` → `/api/workspace/`; removed browser X-Shared-Secret check; added upstream injection; added SPA fallback |
| `infra/nginx/Dockerfile` | Build context changed to repo root (`.`); COPY paths fixed: `infra/nginx/nginx.conf.template`, `apps/desktop/dist/` |
| `docker-compose.ec2.yml` | **NEW** — standalone EC2 deploy; nginx build context set to `.` with `dockerfile: infra/nginx/Dockerfile`; no internal ports published |
| `docker-compose.deploy.yml` | **DELETED** — never use; docker compose ports array merge issue prevents port removal |
| `docs/deploy/DEPLOY-01-ec2-demo.md` | **UPDATED** — build context and compose file notes clarified |
| `docs/deploy/research/perplexity-ec2-strategy-v1.md` | **NEW** — research file moved from repo root |
| `apps/desktop/.env.example` | Updated comments about deploy nginx proxy vs absolute URLs |

---

## Build Context Fix (DEPLOY-01B.2)

**Problem**: Original nginx Dockerfile used `COPY ../apps/desktop/dist/` with build context `infra/nginx/`. Docker cannot copy files outside the build context.

**Solution**: Build context set to repo root (`.`), Dockerfile referenced as `infra/nginx/Dockerfile`:
```yaml
nginx:
  build:
    context: .
    dockerfile: infra/nginx/Dockerfile
```

Dockerfile now uses paths relative to repo root:
```dockerfile
COPY infra/nginx/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY apps/desktop/dist/ /usr/share/nginx/html/
```

**Verification**: `docker compose -f docker-compose.ec2.yml build nginx` ✅ succeeds and copies both files correctly.

---

## CI/CD (CI-01)

### Workflows

#### `desktop-ci.yml` — Automatic build check
Runs on every push to `pm-06-mobile-rn` and `main`, and on PRs to `main`.

- Installs dependencies with `npm ci`
- Builds `apps/desktop` with `npm run build --workspace apps/desktop`
- Verifies `apps/desktop/dist/` exists
- No secrets, no deploy, read-only

#### `deploy-ec2.yml` — Manual production deploy
Triggered manually via GitHub Actions UI with `workflow_dispatch`.

**Requires GitHub Secrets:**
- `EC2_HOST` — public IP or hostname of EC2 (e.g., `13.221.217.108`)
- `EC2_USER` — SSH username (e.g., `ec2-user`)
- `SSH_PRIVATE_KEY` — private key for SSH authentication

**Deploy steps (on EC2):**
1. Pulls latest `pm-06-mobile-rn`
2. Runs `npm ci`
3. Builds desktop app with `NODE_OPTIONS="--max-old-space-size=2048" npm run build --workspace apps/desktop`
4. Rebuilds nginx Docker image
5. Restarts nginx container
6. Runs health check against `https://briefly.ddns.net`

### APK Distribution

The Android APK is **NOT** committed to the repo. It is distributed as a GitHub Release asset:
```
https://github.com/JhovaYu/Briefly_Cloud_First_Always_Online/releases/latest/download/briefly-demo-android.apk
```

The landing page links directly to this URL. No APK file exists in `apps/desktop/public/downloads/`.

### Security Rules

**NEVER do on EC2:**
- `cat .env.s3` or any env file
- `docker inspect` any container
- `docker compose config`
- `printenv` or `env` to print secrets
- `git add .` or commit APK files

**NEVER configure in GitHub Secrets:**
- Any Supabase keys
- Any `.env` content from EC2

The deploy workflow only needs EC2 SSH access — it pulls source code and runs the existing build/deploy scripts.

### AWS Learner Lab Protection

The manual confirmation step (`workflow_dispatch` with `confirm: DEPLOY`) prevents accidental production deploys. Every deploy requires human confirmation in the GitHub Actions UI.

### Secrets Setup (GitHub)

1. Go to **Settings → Secrets and variables → Actions**
2. Add `EC2_HOST` — your EC2 public IP (used as fallback when `ec2_host` input is empty)
3. Add `EC2_USER` — typically `ec2-user`
4. Add `SSH_PRIVATE_KEY` — paste the full private key content (including `-----BEGIN OPENSSH PRIVATE KEY-----`)

### Running the Deploy

1. Go to **Actions** tab in GitHub
2. Select **"Deploy Desktop to EC2 (Manual)"**
3. Click **Run workflow**
4. Enter `DEPLOY` in the confirm field
5. **If your EC2 IP changed** (e.g., after stopping/starting the instance): enter the current public IPv4 in the `ec2_host` field — otherwise leave it empty to use the `EC2_HOST` secret
6. Click **Run workflow**
7. Monitor the runner log for build progress and health check result

**SSH Timeout Troubleshooting:**
If the deploy fails with `dial tcp: i/o timeout` on port 22:
- Verify your EC2 instance's Security Group allows **inbound SSH (port 22)** from your IP
- For temporary demo deploys: open SSH port 22 from `0.0.0.0/0` during deploy, then restrict it afterward
- After stopping/starting an AWS Academy Learner Lab instance, the public IP typically changes — enter the new IP in the `ec2_host` workflow input
- Ensure the EC2 instance is running and the SSH key matches the `SSH_PRIVATE_KEY` secret