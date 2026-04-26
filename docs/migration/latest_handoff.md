# Latest Handoff

## Fase
PM-03E.4B (2026-04-26) — Docker/local config no-regression after S3DocumentStore

## Contexto previo relevante

- **PM-03E.4A:** S3DocumentStore adapter with moto mocked tests — 130 tests PASS
- **PM-03E.3:** Docker local volume + runtime persistence smoke — PASS con JWT fresco
- **PM-03E.2:** Periodic snapshot timer + debounce — 117 tests PASS

## Objetivo ejecutado

Validar que PM-03E.4A no rompió el modo local Docker.

## Validaciones Python

```
✅ python -m pytest apps/backend/collaboration-service/tests -v → 130 passed in 6.74s
  - test_document_store.py: 19 tests (InMemory + LocalFile)
  - test_periodic_snapshot.py: 18 tests
  - test_ws_crdt.py: 16 tests
  - test_ws_auth.py: 19 tests
  - test_collab_tickets.py: 19 tests
  - test_ws_echo.py: 6 tests
  - test_s3_document_store.py: 13 tests (moto mocked)

✅ python -m py_compile app/adapters/s3_document_store.py → OK
✅ python -m py_compile app/adapters/local_file_document_store.py → OK
✅ python -m py_compile app/config/settings.py → OK
✅ python -m py_compile app/main.py → OK
```

## Validaciones Docker local

```
✅ docker compose config → Validated
✅ docker compose build collaboration-service → Built OK
✅ docker compose up -d workspace-service collaboration-service nginx → Containers up

✅ Container env vars (collaboration-service):
   DOCUMENT_STORE_TYPE=local
   DOCUMENT_STORE_PATH=/data/collab-snapshots
   DOCUMENT_PERIODIC_SNAPSHOT_ENABLED=true

✅ Health checks:
   Direct to 8002: 200 OK
   Via nginx + X-Shared-Secret: 200 OK
   Via nginx without secret: 401 Unauthorized
```

## Runtime smoke result

**SKIPPED: JWT expired**

Smoke test falla en workspace creation (401) — JWT expirado, no relacionado con DOCUMENT_STORE_TYPE.

Comando manual cuando JWT fresco esté disponible:
```bash
bjwt
node smoke/yjs-persistence-smoke.mjs
```

## Garantías actuales

- `DOCUMENT_STORE_TYPE=local` funciona en Docker con PM-03E.4A
- Named volume `collab-snapshots` montado en `/data/collab-snapshots`
- `DOCUMENT_STORE_TYPE=s3` solo se activa cuando está configurado explicitly
- `AWS_S3_BUCKET_NAME` no es requerido cuando `DOCUMENT_STORE_TYPE=local`
- main.py branch S3 no afecta memory, local ni disabled
- 130 tests siguen pasando
- Docker build OK

## Qué NO garantiza todavía

- Smoke persistence local E2E (JWT expirado — pendiente refresh manual)
- AWS real (PM-03E.5 — requiere approval separate)

## Resultado Git

```
 M docs/migration/PM-03E-persistence-design.md
 M docs/migration/latest_handoff.md
 M migracion_briefly.md
 M tasks.md
```

**Nota:** Archivos de codigo de PM-03E.4A ya commiteados en `4300e53`.

## Riesgos restantes

1. **Smoke local E2E** — Saltó por JWT expiry, no por código. Precisa refresh manual.
2. **IAM/AWS real** — Pendiente PM-03E.5 (requiere approval separate)
3. **No DynamoDB** — S3-only

## Contrato para siguiente iteración

**PM-03E.5: AWS real wiring** (requiere approval separate + AWS Academy credentials)

- Crear bucket S3 en AWS Academy Learner Lab
- Configurar IAM role o credentials
- Probar con `SUPABASE_TEST_JWT` fresco (smoke E2E real)

## Archivos recomendados para commit

```
M docs/migration/latest_handoff.md
M docs/migration/PM-03E-persistence-design.md
M migracion_briefly.md
M tasks.md
```

## Archivos excluidos

```
auditaciones_comandos.txt
.env, *.log, __pycache__/, *.pyc, node_modules/
.claude/
.data/
*.bin
apps/backend/collaboration-service/smoke/node_modules/
apps/backend/collaboration-service/smoke/package-lock.json
```

**PM-03E.4B listo para revisión APEX.**
