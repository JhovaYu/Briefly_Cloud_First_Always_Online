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
- [x] PM-03B.1 — Auth test hardening (close codes + positive test)
- [ ] PM-03B.1 — Commit selectivo pendiente de approval humano
- [ ] PM-03C — pycrdt-websocket base
- [ ] PM-03D — Yjs sync dos clientes
- [ ] PM-04 — Planning Service REST
- [ ] PM-05 — Intelligence/Utility
- [ ] PM-06 — Frontend cloud-first + React Native integration
- [ ] PM-07 — AWS deployment
- [ ] PM-08 — Burn-in/demo

---

## PM-03B.1 — Auth Test Hardening (2026-04-25)

### Checklist

- [x] Corregir tests WebSocket negativos (context manager correcto, verifican close codes)
- [x] Agregar test positivo `auth_ok_ping_pong` con fake permission client + patch
- [x] Agregar test `permission_denied_closes_with_4003`
- [x] Agregar test `upstream_unavailable_closes_with_1011`
- [x] Limpiar imports no usados en routes.py
- [x] Crear latest_handoff.md
- [x] Validar tests pytest
- [x] Actualizar tasks.md y migracion_briefly.md

### Tests ahora verifying close codes

| Test | Close code | Situación |
|---|---|---|
| `test_invalid_json_closes_with_4400` | 4400 | Primer mensaje no es JSON válido |
| `test_wrong_message_type_closes_with_4400` | 4400 | type != "auth" |
| `test_empty_token_closes_with_4003` | 4003 | token vacío |
| `test_missing_token_field_closes_with_4003` | 4003 | campo token ausente |
| `test_auth_ok_ping_pong` | — | auth exitoso → auth_ok + pong |
| `test_permission_denied_closes_with_4003` | 4003 | Workspace Service rechaza |
| `test_upstream_unavailable_closes_with_1011` | 1011 | Workspace Service timeout/down |

### Validaciones ejecutadas

```
python -m pytest apps/backend/collaboration-service/tests -v
→ 19 passed in 2.36s

python -m py_compile routes.py adapters/workspace_client.py use_cases/authenticate_collaboration.py
→ Syntax OK
```

---

## PM-03B — Collaboration Auth Handshake (2026-04-25) ✅

- First-message auth sin JWT en query string
- WS `/collab/{workspace_id}/{document_id}`
- httpx → Workspace Service permissions
- Arquitectura hexagonal: domain/ports/adapters/use_cases/api
- Close codes: 4400, 4003, 1011

---

## PM-03A — Collaboration WebSocket Echo (2026-04-25) ✅

- WS `/collab/echo` — echo puro para diagnóstico

---

## PM-02C — Hardening + Tests (2026-04-25) ✅

---

## PM-01 — Foundation local (2026-04-24) ✅

---

## Decisiones registradas

| Fecha | Decisión | Impacto |
|---|---|---|
| 2026-04-25 | Mobile v1/demo usará React Native, no PWA | Afecta PM-06 |
| 2026-04-25 | Adapter in-memory hasta respuesta académica DynamoDB | Afecta PM-02 |
| 2026-04-25 | JWT errors genéricos | Afecta PM-02 |
| 2026-04-25 | SupabaseJWKSVerifier singleton | Afecta PM-02 |
| 2026-04-25 | No JWT en query string — first-message auth | Afecta PM-03B |
| 2026-04-25 | Collaboration delega permisos a Workspace Service | Afecta PM-03B |
| 2026-04-25 | Auth tests verifican close codes específicos | Afecta PM-03B.1 |

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

## Archivos recomendados para commit PM-03B.1

### Modificados
```
apps/backend/collaboration-service/tests/test_ws_auth.py
apps/backend/collaboration-service/app/api/routes.py
docs/migration/latest_handoff.md
tasks.md
migracion_briefly.md
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

1. Approval humano para commit selectivo PM-03B.1
2. Ejecutar commit selectivo
3. PM-03C — pycrdt-websocket base
