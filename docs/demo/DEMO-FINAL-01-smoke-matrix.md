# DEMO-FINAL-01: Cloud-First Release Smoke Matrix

**Fecha:** 2026-05-02
**Branch:** `pm-06-mobile-rn`
**HEAD:** `23fb770 docs: record schedule PostgreSQL persistence smoke`
**Producción:** https://briefly.ddns.net

---

## 1. Estado Final del Sistema

**Stack:** Cloud-first always-online sobre AWS Learner Lab + Docker + Nginx + Let's Encrypt

Los horarios de Schedule ahora persisten en PostgreSQL real (`briefly_schedule` database, compartida con `planning-postgres`). Los horarios sobreviven reinicio de contenedores.

| Componente | Estado | Storage |
|---|---|---|
| frontend (Electron PWA) | ✅ Running | Local / IndexedDB |
| Nginx (API Gateway) | ✅ Healthy | — |
| workspace-service | ✅ Healthy | In-memory (MVP) |
| collaboration-service | ✅ Running | In-memory (MVP, CRDT skeleton) |
| planning-service | ✅ Healthy | PostgreSQL (`briefly_planning`) |
| schedule-service | ✅ Healthy | **PostgreSQL (`briefly_schedule`) ✅** |
| intelligence-service | ✅ Running | In-memory (MVP) |
| utility-service | ✅ Running | In-memory (MVP) |
| planning-postgres | ✅ Healthy | PostgreSQL 16-alpine |
| Supabase Auth | ✅ Working | Cloud (Supabase) |

---

## 2. Matriz de Servicios — Health Endpoints

| Servicio | Contenedor | Puerto interno | Health path |
|---|---|---|---|
| workspace-service | `workspace-service` | 8001 | `/health` |
| collaboration-service | `collaboration-service` | 8002 | `/health` |
| planning-service | `planning-service` | 8003 | `/health` |
| schedule-service | `schedule-service` | 8006 | `/health` |
| intelligence-service | `intelligence-service` | 8004 | `/health` |
| utility-service | `utility-service` | 8005 | `/health` |
| nginx | `nginx` | 80/443 | `/nginx-health` |

---

## 3. Matriz de Endpoints — Respuestas HTTP

| Endpoint | Método | Auth | Expected response | Status |
|---|---|---|---|---|
| `https://briefly.ddns.net/` | GET | No | 200 SPA frontend | ✅ |
| `https://briefly.ddns.net/health` | GET | No | 200 `{"status":"ok","service":"nginx"}` | ✅ |
| `https://briefly.ddns.net/nginx-health` | GET | No | 200 `{"status":"ok","service":"nginx"}` | ✅ |
| `https://briefly.ddns.net/api/workspace/health` | GET | JWT | 200 | ✅ |
| `https://briefly.ddns.net/api/planning/health` | GET | JWT | 200 | ✅ |
| `https://briefly.ddns.net/api/schedule/health` | GET | JWT | 200 | ✅ |
| `https://briefly.ddns.net/api/intelligence/health` | GET | JWT | 200 | ✅ |
| `https://briefly.ddns.net/api/utility/health` | GET | JWT | 200 | ✅ |
| `http://briefly.ddns.net/` | GET | No | 301 → HTTPS | ✅ |

**Nota:** `GET /health` va a nginx (no a backends). Para health de backends, usar `/api/{service}/health`.

---

## 4. Matriz Funcional — smoke test completo

| Feature | Camino | Expected | Resultado |
|---|---|---|---|
| Login Supabase | Mobile + email/password | Session JWT válida | ✅ PASS |
| Login Supabase | Desktop | Session JWT válida | ✅ PASS |
| Workspaces list | GET `/api/workspace/workspaces` | Lista de workspaces del usuario | ✅ PASS |
| Tasks create | POST `/api/planning/tasks` | 201 + task returned | ✅ PASS |
| Tasks toggle | PATCH `/api/planning/tasks/{id}` | 200 + updated | ✅ PASS |
| Tasks delete | DELETE `/api/planning/tasks/{id}` | 204 | ✅ PASS |
| **Schedule create (desktop)** | POST `/api/schedule/workspaces/{wid}/schedule-blocks` | 201 | ✅ PASS |
| **Schedule create (mobile)** | POST `/api/schedule/workspaces/{wid}/schedule-blocks` | 201 | ✅ PASS |
| **Schedule update (desktop)** | PUT `/api/schedule/workspaces/{wid}/schedule-blocks/{id}` | 200 | ✅ PASS |
| **Schedule update (mobile)** | PUT `/api/schedule/workspaces/{wid}/schedule-blocks/{id}` | 200 | ✅ PASS |
| **Schedule delete (desktop)** | DELETE `/api/schedule/workspaces/{wid}/schedule-blocks/{id}` | 204 | ✅ PASS |
| **Schedule delete (mobile)** | DELETE `/api/schedule/workspaces/{wid}/schedule-blocks/{id}` | 204 | ✅ PASS |
| **Desktop → Mobile parity** | Crear en desktop, listar en mobile | Block visible en ambos | ✅ PASS |
| **Mobile → Desktop parity** | Crear en mobile, listar en desktop | Block visible en ambos | ✅ PASS |
| **Schedule persist (restart)** | Crear block → `docker restart schedule-service` → GET | Block persists | ✅ PASS |
| **Schedule persist (nginx restart)** | Crear block → `docker restart nginx` → GET | Block persists | ✅ PASS |
| Auth 401 sin token | GET `/api/schedule/...` sin Authorization | 401 | ✅ PASS |
| Auth 401 con token inválido | GET con `Bearer invalid.token` | 401 | ✅ PASS |

---

## 5. Checklist de Demo — AWS Learner Lab

Ejecutar ANTES de cada sesión de demo para confirmar que todo está listo.

### Infraestructura AWS

- [ ] AWS Learner Lab activo y no expirado
- [ ] EC2 corriendo y accesible por SSH
- [ ] No-IP dominio `briefly.ddns.net` apunta a la IP pública actual del EC2
- [ ] Puertos 22 (SSH), 80 (HTTP), 443 (HTTPS) abiertos en security group

### Docker services

```bash
# En EC2:
docker compose -f docker-compose.ec2.yml ps
```

- [ ] `nginx` — healthy
- [ ] `workspace-service` — healthy
- [ ] `planning-service` — healthy
- [ ] `schedule-service` — healthy (debe mostrar `./entrypoint.sh` como command)
- [ ] `planning-postgres` — healthy

### Certificados HTTPS

- [ ] `https://briefly.ddns.net/` responde 200 (no cert error)
- [ ] `curl -s -o /dev/null -w "%{http_code}" https://briefly.ddns.net/` → 200

### Mobile (Expo / Android)

- [ ] APK configurado con `EXPO_PUBLIC_API_BASE_URL=https://briefly.ddns.net`
- [ ] Login functional (email/password Supabase)
- [ ] Workspaces list muestra los espacios del usuario
- [ ] Tareas CRUD funciona
- [ ] Schedule CRUD funciona y sincroniza con desktop

### Desktop (Electron / Vite dev)

- [ ] `npm run dev` en `apps/desktop` conecta a `http://localhost:5173`
- [ ] Vite proxy configura `/api` → `https://briefly.ddns.net`
- [ ] Login functional
- [ ] Schedule CRUD funcional
- [ ] Schedule muestra blocks creados desde mobile

---

## 6. Riesgos Conocidos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| AWS Learner Lab cambia IP pública al reiniciar | **Alta** | El dominio No-IP deja de apuntar al EC2, HTTPS funciona pero no llega a la app | Actualizar No-IP manualmente después de cada reinicio del lab |
| No-IP Free DNS no actualiza IP automáticamente | Media | mismo que arriba — manualmente update | Mantener No-IP actualizado; verificar antes de cada demo |
| Nginx upstream stale post-recreate de schedule-service | **Baja** (después de PM-06F.DB) | 502 en `/api/schedule/` | `docker compose -f docker-compose.ec2.yml restart nginx` — resuelto en PM-06F.DB |
| Init script de `briefly_schedule` no corre si volumen existe | **Baja** | schedule-service no puede conectar a DB | Crear DB manualmente con comando seguro documentado en DEPLOY-02 |
| planning-postgres se queda sin memoria con 2 databases | **Baja** | servicios no responden | 256m mem_limit compartido; funciona en Learner Lab; no exceder carga |
| Servicios (workspace, collab, utility, intelligence) son MVP in-memory | **N/A** | Datos no persisten al restart | Solo `planning-service` y `schedule-service` tienen persistencia real; los demás son MVP/placeholder |

---

## 7. Evidencia de Release — Comandos para documentar

```bash
# Salud de todos los servicios
curl -s https://briefly.ddns.net/api/workspace/health
curl -s https://briefly.ddns.net/api/planning/health
curl -s https://briefly.ddns.net/api/schedule/health

# HTTP redirect
curl -s -o /dev/null -w "%{http_code}" http://briefly.ddns.net/

# Docker services en EC2
docker compose -f docker-compose.ec2.yml ps

# Git log del deploy
git log --oneline -10

# Smoke test de persistencia schedule
# 1. Crear block desde cualquier cliente
# 2. docker compose -f docker-compose.ec2.yml restart schedule-service
# 3. GET /api/schedule/workspaces/{wid}/schedule-blocks — block sigue ahí

# bsecretcheck antes de cualquier commit
bsecretcheck
```

---

## 8. Arquitectura — Comunicación entre servicios

```
Internet (HTTPS)
    ↓
Nginx (443, terminate SSL)
    ├── /api/workspace/* → workspace-service:8001
    ├── /api/planning/*  → planning-service:8003
    ├── /api/schedule/*  → schedule-service:8006
    ├── /api/intelligence/* → intelligence-service:8004
    ├── /api/utility/*   → utility-service:8005
    ├── /collab/*         → collaboration-service:8002 (WebSocket)
    └── /                 → SPA static files

workspace-service:8001 ←→ workspace-service → Supabase (auth/metadata)
planning-service:8003 ←→ planning-postgres:5432 (briefly_planning)
schedule-service:8006 ←→ planning-postgres:5432 (briefly_schedule)
                        ↑
                        └── también planning-service
```

**Nota:** `planning-postgres` es un único contenedor que serve dos databases lógicas: `briefly_planning` y `briefly_schedule`.

---

## 9. Servicios con Persistencia Real

| Servicio | Storage | Survive restart? |
|---|---|---|
| `planning-service` | PostgreSQL `briefly_planning` | ✅ Yes |
| `schedule-service` | PostgreSQL `briefly_schedule` | ✅ Yes |
| `workspace-service` | In-memory | ❌ No |
| `collaboration-service` | In-memory (snapshot optional) | ❌ No (snapshots sí) |
| `intelligence-service` | In-memory | ❌ No |
| `utility-service` | In-memory | ❌ No |

---

## 10. Notas de Release

- **PM-06F.DB** (schedule PostgreSQL) es la única funcionalidad nueva respecto al último merge a main.
- Mobile y desktop no requieren cambios — el API contract es idéntico entre in-memory y postgres.
- El 502 que puede aparecer tras rebuild de schedule-service es un síntoma de Docker networking, no un bug de código. Fix: `restart nginx`.
- La database `briefly_schedule` debe crearse manualmente una vez si el volumen de `planning-postgres` ya existía antes del deploy de PM-06F.DB. Comando documentado en `DEPLOY-02-https-noip-nginx.md`.