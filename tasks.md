# Briefly Cloud-First — Tasks Operativas

## Regla de uso

Este archivo es la bitácora auditable de ejecución.

- Jarvis/Claude Code debe marcar una tarea como completada solo si fue ejecutada y validada.
- Si una tarea falla, debe marcarse como bloqueada o pendiente con causa.
- Cada fase debe actualizar `migracion_briefly.md`.
- Cada fase debe dejar lista de archivos recomendados para commit.
- No se permite `git add .`.
- No se permite commit/push sin aprobación humana.
- Las tareas sensibles requieren aprobación humana:
  - auth
  - JWT
  - secretos
  - AWS
  - Docker/Nginx
  - IAM
  - DB
  - migraciones
  - eliminación de archivos

---

## Estado actual resumido

- [x] PM-01 — Foundation local backend
- [x] PM-02A — Workspace Service hygiene + syntax validation
- [x] PM-02B — Workspace Service runtime validation
- [x] PM-02C — Workspace Service hardening (tests + fixes)
- [ ] PM-02 — Commit selectivo pendiente de aprobación humana
- [ ] PM-03 — Collaboration Service spike
- [ ] PM-04 — Planning Service REST
- [ ] PM-05 — Intelligence/Utility
- [ ] PM-06 — Frontend cloud-first + React Native integration
- [ ] PM-07 — AWS deployment
- [ ] PM-08 — Burn-in/demo

---

## PM-02C — Hardening + Tests (2026-04-25)

### Checklist

- [x] Cachear SupabaseJWKSVerifier como singleton en dependencies.py
- [x] Generificar errores JWT (no exponer detalles internos PyJWT)
- [x] Agregar tests automáticos mínimos (pytest + TestClient)
- [x] Agregar `.gitattributes`
- [x] Corregir advertencias de deprecación Pydantic V2 (ConfigDict)
- [x] Validar tests con pytest
- [x] Actualizar `migracion_briefly.md`
- [x] Preparar lista de commit selectivo

### Cambios realizados

1. **Singleton JWT verifier** — `dependencies.py` ahora cachea `_token_verifier` global, una sola instancia por runtime
2. **Errores JWT genéricos** — `supabase_jwks_token_verifier.py` ya no filtra `Not enough segments` ni detalles internos de PyJWT
3. **Tests auth** — 5 tests agregados en `tests/test_auth.py`: health x2, auth negative x3
4. **`.gitattributes`** — normalización LF para archivos de texto, binary para pyc/png/etc
5. **Pydantic V2** — `schemas.py` y `settings.py` actualizados a `ConfigDict`
6. **requirements-dev.txt** — pytest + httpx para tests locales

### Validaciones ejecutadas

```
python -m pytest apps/backend/workspace-service/tests -v
→ 5 passed in 0.62s (sin warnings de deprecación)
python -m py_compile (todos los archivos) → Syntax OK
```

### Commit selectivo

- [ ] Pendiente — awaiting human approval

---

## PM-02B — Runtime Validation (2026-04-25)

### Preflight

- [x] Confirmar Docker Desktop activo
- [x] Ejecutar `docker version`
- [x] Ejecutar `docker compose config`
- [x] Ejecutar `git status --short --branch`
- [x] Confirmar que no quedan `.pyc` trackeados
- [x] Confirmar que `.claude/`, `.mcp.json`, `briefly-architecture-repomix.md` no serán commiteados

### Runtime Docker

- [x] `docker compose config` — ✅ Syntax validated OK
- [x] `docker compose build workspace-service` — ✅ Build successful
- [x] `docker compose up -d workspace-service nginx` — ✅ All containers up
- [x] `docker compose ps` — ✅ 6/6 healthy

### Healthchecks

- [x] `curl http://localhost:8001/health` → `{"status":"ok","service":"workspace-service"}`
- [x] `curl http://localhost:8001/healthz` → `{"status":"ok","service":"workspace-service"}`
- [x] `curl http://localhost/api/workspaces/health -H "X-Shared-Secret: changeme"` → `{"status":"ok","service":"workspace-service"}`
- [x] `curl http://localhost/api/workspaces/health` (sin secret) → `{"error":"unauthorized"}` 401

### Auth negative tests

- [x] `curl -i http://localhost:8001/me` → 401 `{"detail":"Not authenticated"}`
- [x] `curl -i http://localhost:8001/me -H "Authorization: Bearer invalid-token"` → 401 (error genérico tras PM-02C fix)
- [x] `curl -i http://localhost/api/workspaces/me -H "X-Shared-Secret: changeme"` → 401 `{"detail":"Not authenticated"}`
- [x] `curl -i http://localhost/api/workspaces/me -H "X-Shared-Secret: changeme" -H "Authorization: Bearer invalid-token"` → 401 (error genérico tras PM-02C fix)

### Commit selectivo

- [ ] Pendiente — awaiting human approval

---

## PM-02A — Repo Hygiene (2026-04-25)

- [x] `.gitignore` actualizado (Python caches, .claude/, .mcp.json, repomix-output.txt)
- [x] `.pyc` y `__pycache__` removidos del tracking
- [x] Arquitectura hexagonal verificada
- [x] JWT verifier (ES256 + JWKS + issuer/audience/exp) verificado
- [x] Documentación actualizada

---

## PM-01 — Foundation local (2026-04-24)

- [x] 5 servicios FastAPI skeleton
- [x] Docker Compose + Nginx
- [x] Healthchecks + X-Shared-Secret
- [x] Validación runtime completa

---

## PM-03 — Collaboration Service Spike

Estado: **Pendiente**

No iniciar hasta que PM-02 commit sea aprobado.

---

## Decisiones registradas

| Fecha | Decisión | Impacto |
|---|---|---|
| 2026-04-25 | Mobile v1/demo usará React Native, no PWA | Afecta PM-06/Fase 5 |
| 2026-04-25 | Adapter de persistencia in-memory hasta respuesta académica sobre DynamoDB | Afecta PM-02 |
| 2026-04-25 | JWT errors genéricos — no filtrar detalles internos PyJWT | Afecta PM-02 |
| 2026-04-25 | SupabaseJWKSVerifier cacheado como singleton | Afecta PM-02 |

---

## Registro de salud de contenedores

Fecha: 2026-04-25

| Servicio | Status |
|---|---|
| workspace-service | healthy |
| nginx | healthy |
| collaboration-service | healthy |
| planning-service | healthy |
| intelligence-service | healthy |
| utility-service | healthy |

---

## Archivos recomendados para commit PM-02C

### Modificados
```
apps/backend/workspace-service/app/api/dependencies.py
apps/backend/workspace-service/app/adapters/auth/supabase_jwks_token_verifier.py
apps/backend/workspace-service/app/api/schemas.py
apps/backend/workspace-service/app/config/settings.py
tasks.md
migracion_briefly.md
.gitattributes
```

### Nuevos
```
apps/backend/workspace-service/tests/__init__.py
apps/backend/workspace-service/tests/test_auth.py
apps/backend/workspace-service/requirements-dev.txt
```

### Excluidos
```
.claude/
.mcp.json
briefly-architecture-repomix.md
**/__pycache__/
*.pyc
```

---

## Próximo paso

1. Approval humano para commit selectivo PM-02C
2. Ejecutar commit selectivo
3. PM-03 — Collaboration Service spike
