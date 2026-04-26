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
- [ ] PM-02 — Commit selectivo pendiente de aprobación humana
- [ ] PM-03 — Collaboration Service spike
- [ ] PM-04 — Planning Service REST
- [ ] PM-05 — Intelligence/Utility
- [ ] PM-06 — Frontend cloud-first + React Native integration
- [ ] PM-07 — AWS deployment
- [ ] PM-08 — Burn-in/demo

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

- [x] Ejecutar `docker compose config` — ✅ Syntax validated OK
- [x] Ejecutar `docker compose build workspace-service` — ✅ Build successful
- [x] Ejecutar `docker compose up -d workspace-service nginx` — ✅ All containers up
- [x] Ejecutar `docker compose ps` — ✅ 6/6 healthy (workspace-service, nginx, collaboration, planning, intelligence, utility)

### Healthchecks

- [x] `curl http://localhost:8001/health` → `{"status":"ok","service":"workspace-service"}`
- [x] `curl http://localhost:8001/healthz` → `{"status":"ok","service":"workspace-service"}`
- [x] `curl http://localhost/api/workspaces/health -H "X-Shared-Secret: changeme"` → `{"status":"ok","service":"workspace-service"}`
- [x] `curl http://localhost/api/workspaces/health` (sin secret) → `{"error":"unauthorized"}` 401

### Auth negative tests

- [x] `curl -i http://localhost:8001/me` → 401 `{"detail":"Not authenticated"}`
- [x] `curl -i http://localhost:8001/me -H "Authorization: Bearer invalid-token"` → 401 `{"detail":"Token inválido: Not enough segments"}`
- [x] `curl -i http://localhost/api/workspaces/me -H "X-Shared-Secret: changeme"` → 401 `{"detail":"Not authenticated"}`
- [x] `curl -i http://localhost/api/workspaces/me -H "X-Shared-Secret: changeme" -H "Authorization: Bearer invalid-token"` → 401 `{"detail":"Token inválido: Not enough segments"}`

### Syntax / static validation

- [x] `python -m py_compile` domain/*.py — ✅ Syntax OK
- [x] `python -m py_compile` ports/*.py — ✅ Syntax OK
- [x] `python -m py_compile` use_cases/*.py — ✅ Syntax OK
- [x] `python -m py_compile` adapters/*.py — ✅ Syntax OK
- [x] `python -m py_compile` api/*.py — ✅ Syntax OK
- [x] `python -m py_compile` main.py, config.py — ✅ Syntax OK

### Documentación

- [x] `migracion_briefly.md` actualizado con resultado runtime real
- [x] tasks.md creado
- [x] Decisión React Native registrada

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

## Archivos recomendados para commit PM-02

### Modificados (staged + unstaged)
```
.env.example
.gitignore
apps/backend/workspace-service/app/api/routes.py
apps/backend/workspace-service/app/config.py
apps/backend/workspace-service/app/main.py
apps/backend/workspace-service/app/use_cases/__init__.py
apps/backend/workspace-service/requirements.txt
docker-compose.yml
migracion_briefly.md
```

### Nuevos (untracked)
```
apps/backend/workspace-service/app/adapters/auth/__init__.py
apps/backend/workspace-service/app/adapters/auth/supabase_jwks_token_verifier.py
apps/backend/workspace-service/app/adapters/persistence/__init__.py
apps/backend/workspace-service/app/adapters/persistence/in_memory_repositories.py
apps/backend/workspace-service/app/api/dependencies.py
apps/backend/workspace-service/app/api/schemas.py
apps/backend/workspace-service/app/config/__init__.py
apps/backend/workspace-service/app/config/settings.py
apps/backend/workspace-service/app/domain/document_metadata.py
apps/backend/workspace-service/app/domain/errors.py
apps/backend/workspace-service/app/domain/membership.py
apps/backend/workspace-service/app/domain/workspace.py
apps/backend/workspace-service/app/ports/document_repository.py
apps/backend/workspace-service/app/ports/membership_repository.py
apps/backend/workspace-service/app/ports/token_verifier.py
apps/backend/workspace-service/app/ports/workspace_repository.py
apps/backend/workspace-service/app/use_cases/create_document.py
apps/backend/workspace-service/app/use_cases/create_workspace.py
apps/backend/workspace-service/app/use_cases/get_permissions.py
apps/backend/workspace-service/app/use_cases/get_workspace.py
apps/backend/workspace-service/app/use_cases/list_documents.py
apps/backend/workspace-service/app/use_cases/list_workspaces.py
docs/contexto.md
docs/migration/PM-02-workspace-auth-plan.md
tasks.md
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

1. Approval humano para commit selectivo PM-02
2. Ejecutar commit selectivo
3. PM-03 — Collaboration Service spike
