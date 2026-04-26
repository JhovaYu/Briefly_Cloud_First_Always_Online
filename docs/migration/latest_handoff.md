# Latest Handoff

## Fase
PM-03E.3 (2026-04-26) — Docker local volume + runtime persistence smoke

## Contexto previo relevante

- **PM-03E.2:** Periodic snapshot timer + debounce — 117 tests PASS
- **PM-03E.1:** Local CRDT snapshot persistence foundation
- **PM-03E.1.1:** on_disconnect wireado, lifecycle hardening
- **PM-03E.1.2:** Snapshot restore integration fix

## Cambios aplicados en PM-03E.3

### Problema resuelto

`DOCUMENT_STORE_TYPE=local` en Docker sin volumen montado pierde snapshots en cada restart del contenedor.

### Solución implementada

1. **Docker named volume** `collab-snapshots` montado en `/data/collab-snapshots` dentro del contenedor
2. **`collaboration-service`** recibe env vars `DOCUMENT_STORE_TYPE=local`, `DOCUMENT_STORE_PATH=/data/collab-snapshots`, `DOCUMENT_PERIODIC_SNAPSHOT_ENABLED=true`
3. **Periodic snapshot** habilitado por defecto en Docker (intervalo 30s, grace 5s)
4. **Smoke test dedicado** `yjs-persistence-smoke.mjs` para validar persistencia cross-container-restart
5. **`.gitignore`** actualizado para excluir `.data/` y `*.bin`

## Docker persistence design

### Volume configuration

```yaml
# docker-compose.yml
volumes:
  collab-snapshots:   # named volume, persists across container recreate

services:
  collaboration-service:
    volumes:
      - collab-snapshots:/data/collab-snapshots
    environment:
      - DOCUMENT_STORE_TYPE=local
      - DOCUMENT_STORE_PATH=/data/collab-snapshots
      - DOCUMENT_PERIODIC_SNAPSHOT_ENABLED=true
      - DOCUMENT_SNAPSHOT_INTERVAL_SECONDS=30
      - DOCUMENT_EMPTY_ROOM_GRACE_SECONDS=5
```

### Trade-off: named volume vs bind mount

| Opción | Ventaja | Desventaja |
|---|---|---|
| **Named volume** (elegida) | Gestionado por Docker, survives recreate | Menos visible en host |
| **Bind mount** | Visible en host filesystem | Requiere path absoluto, menos portable |

Named volume es la elección correcta para demo — el snapshot sobrevive a recreate sin exponer archivos en el host.

### Snapshot path inside container

`/data/collab-snapshots/{workspace_id}/{document_id}/latest.bin`

### What's NOT in Git

```
.data/            ← gitignored (local dev bind mount / Docker volume contents)
*.bin            ← gitignored (snapshot binaries)
```

## Runtime smoke result

**SKIPPED: requires fresh SUPABASE_TEST_JWT**

Comando para ejecutar manualmente:

```bash
cd apps/backend/collaboration-service/smoke
npm install
SUPABASE_TEST_JWT=<tu_jwt> node yjs-persistence-smoke.mjs
```

Smoke flow:
1. Provider A connect → write "Persistence Test A" → disconnect cleanly
2. Wait 5s for snapshot to persist to volume
3. Provider B connect with fresh doc → verify sees "Persistence Test A" from snapshot

## Tests ejecutados

```
python -m pytest apps/backend/collaboration-service/tests -v
→ 117 passed in 2.66s ✅
```

No new tests added — PM-03E.3 es configuración Docker + smoke E2E, no cambios de código Python.

## Validaciones ejecutadas

```
✅ docker compose config → Validated
✅ docker compose build collaboration-service → Built OK
✅ docker compose up -d --no-deps collaboration-service → Volume created, service started
✅ docker compose logs collaboration-service → Uvicorn running
✅ Container env: DOCUMENT_STORE_TYPE=local ✅
✅ Container env: DOCUMENT_STORE_PATH=/data/collab-snapshots ✅
✅ Container env: DOCUMENT_PERIODIC_SNAPSHOT_ENABLED=true ✅
✅ node --check yjs-persistence-smoke.mjs → OK (no syntax errors)
```

## Resultado Git

```
M docker-compose.yml
M .gitignore
A apps/backend/collaboration-service/smoke/yjs-persistence-smoke.mjs
```

## Riesgos restantes

1. **`id(msg)` como channel_id** — No es Channel real de pycrdt. Suficiente para PM-03E.1.x.
2. **No S3/DynamoDB** — fase posterior PM-03E.
3. **`DOCUMENT_STORE_TYPE=local` en EC2 sin volume** — snapshots se pierden en restart del contenedor si no hay volumen EBS o bind mount.
4. **Runtime smoke E2E** — no ejecutado por falta de JWT fresco (documentado como SKIPPED).

## Contrato para la siguiente iteración

**PM-03E: Persistencia S3/DynamoDB** (fase posterior)

- Reemplazar `LocalFileDocumentStore` por DynamoDB + S3
- Mantener `DocumentStore` port para swap sin cambios en room manager
- No modificar interface `RoomManager`
- No romper tests existentes

**PM-03E.3 listo para revisión APEX.**

## Archivos recomendados para commit

```
M docker-compose.yml
M .gitignore
A apps/backend/collaboration-service/smoke/yjs-persistence-smoke.mjs
M docs/migration/latest_handoff.md          ← post-update
M docs/migration/PM-03E-persistence-design.md  ← post-update
M migracion_briefly.md                    ← post-update
M tasks.md                                ← post-update
```

## Archivos excluidos

```
auditaciones_comandos.txt
.env, *.log, __pycache__/, *.pyc, node_modules/
.claude/
.data/
*.bin
```
