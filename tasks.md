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
- [x] PM-02A/B/C — Workspace Service completo y validado
- [x] PM-02 — Commit pendiente de approval humano
- [x] PM-03A — Collaboration WebSocket echo + Nginx validation
- [x] PM-03B — Collaboration Auth handshake + Workspace permissions
- [ ] PM-03B — Commit selectivo pendiente de approval humano
- [ ] PM-03C — pycrdt-websocket base
- [ ] PM-03D — Yjs sync dos clientes
- [ ] PM-04 — Planning Service REST
- [ ] PM-05 — Intelligence/Utility
- [ ] PM-06 — Frontend cloud-first + React Native integration
- [ ] PM-07 — AWS deployment
- [ ] PM-08 — Burn-in/demo

---

## PM-03B — Collaboration Auth Handshake (2026-04-25)

### Checklist

- [x] Diseñar first-message auth sin query token
- [x] Crear endpoint WS `/collab/{workspace_id}/{document_id}`
- [x] Crear cliente interno async hacia Workspace Service (httpx)
- [x] Validar permisos llamando `/workspaces/{workspace_id}/permissions`
- [x] Manejar auth faltante, mensaje inválido, token inválido, permiso denegado y timeout
- [x] Mantener `/collab/echo` como endpoint de diagnóstico
- [x] Agregar tests automáticos negativos y positivos con mock/fake permission client
- [x] Validar Docker/Nginx
- [x] Actualizar `migracion_briefly.md`
- [ ] Preparar lista de commit selectivo

### Arquitectura hexagonal implementada

```
app/
├── config/settings.py         — WORKSPACE_SERVICE_URL, TIMEOUTS
├── domain/errors.py           — AuthTimeout, InvalidAuthMessage, PermissionDenied, UpstreamUnavailable
├── ports/workspace_permissions.py — WorkspacePermissions ABC
├── adapters/workspace_client.py — httpx async → Workspace Service
├── use_cases/authenticate_collaboration.py — orchestration
└── api/routes.py             — WS endpoint + first-message auth
```

### Protocolo PM-03B

```
WS /collab/{workspace_id}/{document_id}

1. accept connection
2. wait for first message (timeout 5s)
3. parse JSON → must be {"type":"auth","token":"<jwt>"}
4. validate token non-empty
5. call Workspace Service /workspaces/{id}/permissions (timeout 3s)
6. 200 → send {"type":"auth_ok","workspace_id":"...","document_id":"...","role":"..."}
7. 401/403/404 → close 4003
8. timeout/5xx → close 1011
9. after auth_ok: echo mode (ping→pong, text→echo)
```

### Close codes

| Code | Meaning |
|---|---|
| 4400 | Invalid first message (not JSON, wrong type) |
| 4003 | Token empty / Permission denied |
| 1011 | Upstream (Workspace Service) unavailable |

### Validaciones ejecutadas

```
python -m pytest apps/backend/collaboration-service/tests -v
→ 16 passed in 0.59s

WS /collab/echo via Nginx + secret → ready + ping + echo ✅
WS /collab/{id}/{id} without secret → 401 rejected ✅
WS /collab/{id}/{id} without auth message → closes ✅
WS /collab/{id}/{id} with invalid token → closes cleanly ✅
```

### Commit selectivo

- [ ] Pendiente — awaiting human approval

---

## PM-03A — Collaboration WebSocket Echo (2026-04-25) ✅

- WebSocket echo endpoint implementado
- 6 tests pytest passing
- Docker build/runtime OK
- Nginx X-Shared-Secret validado

---

## PM-02C — Hardening + Tests (2026-04-25) ✅

- Singleton SupabaseJWKSVerifier en dependencies.py
- Errores JWT genéricos
- 5 tests pytest workspace-service passing
- `.gitattributes`
- Pydantic V2 ConfigDict fixes

---

## PM-02B — Runtime Validation (2026-04-25) ✅

- Docker Desktop activo
- docker compose config OK, build OK, 6/6 containers healthy
- Healthchecks OK, Auth negative tests 401 OK

---

## PM-01 — Foundation local (2026-04-24) ✅

- 5 servicios FastAPI skeleton
- Docker Compose + Nginx
- Healthchecks + X-Shared-Secret
- Validación runtime completa

---

## Decisiones registradas

| Fecha | Decisión | Impacto |
|---|---|---|
| 2026-04-25 | Mobile v1/demo usará React Native, no PWA | Afecta PM-06/Fase 5 |
| 2026-04-25 | Adapter de persistencia in-memory hasta respuesta académica | Afecta PM-02 |
| 2026-04-25 | JWT errors genéricos — no filtrar detalles internos PyJWT | Afecta PM-02 |
| 2026-04-25 | SupabaseJWKSVerifier cacheado como singleton | Afecta PM-02 |
| 2026-04-25 | No usar JWT crudo en query string — PM-03B first-message auth | Afecta PM-03B |
| 2026-04-25 | Collaboration delega validación permisos a Workspace Service | Afecta PM-03B |
| 2026-04-25 | PM-03B usa first-message auth con close codes estándar | Afecta PM-03B |

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

## Archivos recomendados para commit PM-03B

### Modificados
```
apps/backend/collaboration-service/app/api/routes.py
apps/backend/collaboration-service/requirements.txt
```

### Nuevos
```
apps/backend/collaboration-service/app/config/__init__.py
apps/backend/collaboration-service/app/config/settings.py
apps/backend/collaboration-service/app/domain/__init__.py
apps/backend/collaboration-service/app/domain/errors.py
apps/backend/collaboration-service/app/ports/__init__.py
apps/backend/collaboration-service/app/ports/workspace_permissions.py
apps/backend/collaboration-service/app/adapters/__init__.py
apps/backend/collaboration-service/app/adapters/workspace_client.py
apps/backend/collaboration-service/app/use_cases/__init__.py
apps/backend/collaboration-service/app/use_cases/authenticate_collaboration.py
apps/backend/collaboration-service/tests/__init__.py
apps/backend/collaboration-service/tests/test_ws_auth.py
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

1. Approval humano para commit selectivo PM-03B
2. Ejecutar commit selectivo
3. PM-03C — pycrdt-websocket base
