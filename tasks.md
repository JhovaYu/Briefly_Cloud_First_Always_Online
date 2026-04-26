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
- [x] PM-02 — Commit selectivo pendiente de aprobación humana
- [x] PM-03A — Collaboration WebSocket echo + Nginx validation
- [ ] PM-03B — Collaboration Auth handshake + permisos
- [ ] PM-03C — pycrdt-websocket base
- [ ] PM-03D — Yjs sync dos clientes
- [ ] PM-04 — Planning Service REST
- [ ] PM-05 — Intelligence/Utility
- [ ] PM-06 — Frontend cloud-first + React Native integration
- [ ] PM-07 — AWS deployment
- [ ] PM-08 — Burn-in/demo

---

## PM-03A — Collaboration WebSocket Echo (2026-04-25)

### Checklist

- [x] Revisar configuración actual Nginx /collab
- [x] Crear endpoint WebSocket `/collab/echo`
- [x] Agregar test automático directo con FastAPI TestClient
- [x] Validar docker compose config
- [x] Build collaboration-service
- [x] Levantar collaboration-service + nginx
- [x] Probar `/collab/health` vía Nginx con X-Shared-Secret
- [x] Probar WebSocket directo a collaboration-service (TestClient)
- [x] Probar WebSocket vía Nginx con X-Shared-Secret
- [x] Verificar que vía Nginx sin X-Shared-Secret falla (401)
- [x] Actualizar migracion_briefly.md
- [x] Preparar lista de commit selectivo

### WebSocket echo implementado

`apps/backend/collaboration-service/app/api/routes.py`:

```
WS /collab/echo
  1. accept connection
  2. send {"type":"ready","service":"collaboration-service"}
  3. receive "ping" → send {"type":"pong"}
  4. receive any other text → send {"type":"echo","payload":<text>}
  5. handle disconnect cleanly
```

### Validaciones ejecutadas

```
python -m pytest apps/backend/collaboration-service/tests -v
→ 6 passed in 0.50s

WS via Nginx + X-Shared-Secret: ready + ping + hello echo ✅
WS via Nginx sin X-Shared-Secret: 401 ✅
```

### Commit selectivo

- [ ] Pendiente — awaiting human approval

---

## PM-03 — Collaboration Service Spike

Estado: **PM-03A completado**

División de PM-03:

- PM-03A: WebSocket echo + Nginx ✅
- PM-03B: Auth handshake + permisos contra Workspace Service (pendiente)
- PM-03C: pycrdt-websocket base (pendiente)
- PM-03D: Yjs sync dos clientes (pendiente)

### Decisión registrada

- PM-03A solo valida WebSocket echo. JWT/permisos se difieren a PM-03B.
- No usar JWT crudo en query string como solución final.
- PM-03B debe evaluar first-message auth o short-lived collaboration ticket.

---

## PM-02C — Hardening + Tests (2026-04-25)

- [x] Singleton SupabaseJWKSVerifier en dependencies.py
- [x] Errores JWT genéricos (no filtrar detalles PyJWT)
- [x] 5 tests pytest workspace-service (5 passed)
- [x] `.gitattributes`
- [x] Pydantic V2 ConfigDict fixes
- [x] migracion_briefly.md actualizado

---

## PM-02B — Runtime Validation (2026-04-25)

- [x] Docker Desktop activo
- [x] docker compose config OK
- [x] docker compose build workspace-service OK
- [x] 6/6 containers healthy
- [x] Healthchecks OK
- [x] Auth negative tests 401 OK

---

## PM-02A — Repo Hygiene (2026-04-25)

- [x] `.gitignore` actualizado
- [x] `.pyc` y `__pycache__` removidos del tracking
- [x] Arquitectura hexagonal verificada

---

## PM-01 — Foundation local (2026-04-24)

- [x] 5 servicios FastAPI skeleton
- [x] Docker Compose + Nginx
- [x] Healthchecks + X-Shared-Secret
- [x] Validación runtime completa

---

## Decisiones registradas

| Fecha | Decisión | Impacto |
|---|---|---|
| 2026-04-25 | Mobile v1/demo usará React Native, no PWA | Afecta PM-06/Fase 5 |
| 2026-04-25 | Adapter de persistencia in-memory hasta respuesta académica | Afecta PM-02 |
| 2026-04-25 | JWT errors genéricos — no filtrar detalles internos PyJWT | Afecta PM-02 |
| 2026-04-25 | SupabaseJWKSVerifier cacheado como singleton | Afecta PM-02 |
| 2026-04-25 | No usar JWT crudo en query string — PM-03B evaluará first-message auth | Afecta PM-03B |

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

## Archivos recomendados para commit PM-03A

### Modificados
```
apps/backend/collaboration-service/app/api/routes.py
tasks.md
migracion_briefly.md
```

### Nuevos
```
apps/backend/collaboration-service/requirements-dev.txt
apps/backend/collaboration-service/tests/__init__.py
apps/backend/collaboration-service/tests/test_ws_echo.py
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

1. Approval humano para commit selectivo PM-03A
2. Ejecutar commit selectivo
3. PM-03B — Collaboration Auth handshake + permisos contra Workspace Service
