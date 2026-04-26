# Latest Handoff

## Fase
PM-03E.4A (2026-04-26) — S3DocumentStore adapter with moto mocked tests

## Contexto previo relevante

- **PM-03E.3:** Docker local volume + runtime persistence smoke — PASS con JWT fresco
- **PM-03E.2:** Periodic snapshot timer + debounce — 117 tests PASS
- **PM-03E.1:** Local CRDT snapshot persistence foundation
- **PM-03E.1.1:** on_disconnect wireado, lifecycle hardening
- **PM-03E.1.2:** Snapshot restore integration fix

## Problema resuelto

Reemplazar `LocalFileDocumentStore` por `S3DocumentStore` para persistencia en S3, sin tocar AWS real.

## Cambios aplicados en PM-03E.4A

1. **`S3DocumentStore`** adapter en `app/adapters/s3_document_store.py`
   - Implementa `DocumentStore` port — swap sin cambios en room manager
   - Key format: `collab-snapshots/{workspace_id}/{document_id}/latest.bin`
   - Metadata: solo `workspace-id` y `document-id` — sin secrets
   - `NoSuchKey` → `None`/`False` — matching behavior con `LocalFileDocumentStore`
   - Soporta `endpoint_url` opcional (moto tests + LocalStack dev)

2. **`DOCUMENT_STORE_TYPE=s3`** integrado en `settings.py` + `main.py`
   - `AWS_S3_BUCKET_NAME`, `AWS_REGION`, `AWS_ENDPOINT_URL` como settings
   - Valida que `AWS_S3_BUCKET_NAME` esté configurado al startup

3. **Tests con `moto.mock_aws()`** — 13 tests nuevos pasando
   - `test_s3_save_load_roundtrip`, `test_s3_load_nonexistent_returns_none`
   - `test_s3_exists_after_save`, `test_s3_exists_nonexistent_is_false`
   - `test_s3_delete_removes_object`, `test_s3_delete_nonexistent_is_noop`
   - `test_s3_two_rooms_isolated`, `test_s3_overwrite_replaces`
   - `test_s3_rejects_invalid_room_key`
   - `test_s3_key_format_matches_expected_prefix`
   - `test_s3_metadata_does_not_include_secrets`
   - `test_s3_implements_port`, `test_s3_save_returns_none`

4. **Dependencies**
   - `boto3>=1.34.0` en requirements.txt (production)
   - `moto[s3]>=5.0.0` en requirements-dev.txt (tests only)

## Diseño S3DocumentStore

### Puerto implementado

```python
class DocumentStore(ABC):
    @abstractmethod
    def save(self, room_key: str, snapshot: bytes) -> None: ...
    @abstractmethod
    def load(self, room_key: str) -> bytes | None: ...
    @abstractmethod
    def delete(self, room_key: str) -> None: ...
    @abstractmethod
    def exists(self, room_key: str) -> bool: ...
```

### Key format

`collab-snapshots/{workspace_id}/{document_id}/latest.bin`

Formato idéntico a `LocalFileDocumentStore` — swap directo sin cambios en room manager.

### Metadata en S3 object

- `ContentType: application/octet-stream`
- `Metadata: { "workspace-id": workspace_id, "document-id": document_id }`
- Sin JWT, emails, tokens ni secretos en metadata.

### Error handling

| Operación | Objeto inexistente | Error inesperado |
|---|---|---|
| `load()` | `None` | Propaga `ClientError` |
| `exists()` | `False` | Propaga `ClientError` |
| `delete()` | No-op (None returned) | Propaga `ClientError` |

Moto puede retornar `Code: "404"` o `"NoSuchKey"` para objetos inexistentes — ambos aceptados.

## Dependencias agregadas

```
# requirements.txt (production)
boto3>=1.34.0

# requirements-dev.txt (tests only)
moto[s3]>=5.0.0
```

## Settings/env agregados

```python
# app/config/settings.py
DOCUMENT_STORE_TYPE: str = "memory"  # ahora: "memory" | "local" | "s3" | "disabled"
AWS_S3_BUCKET_NAME: str = ""
AWS_REGION: str = "us-east-1"
AWS_ENDPOINT_URL: str = ""  # opcional: para moto/LocalStack
```

```bash
# .env.example
DOCUMENT_STORE_TYPE=s3
AWS_S3_BUCKET_NAME=briefly-cloud-first-collab-snapshots
AWS_REGION=us-east-1
# AWS_ENDPOINT_URL=  # para moto tests o LocalStack
# Production: prefer IAM role / environment credential chain — do NOT commit secrets
```

## Tests ejecutados

```
python -m pytest apps/backend/collaboration-service/tests -v
→ 130 passed in 6.40s ✅
  - test_document_store.py: 19 tests (InMemory + LocalFile)
  - test_periodic_snapshot.py: 18 tests
  - test_ws_crdt.py: 16 tests
  - test_ws_auth.py: 19 tests
  - test_collab_tickets.py: 19 tests
  - test_ws_echo.py: 6 tests
  - test_s3_document_store.py: 13 tests (NEW — moto mocked)
```

## Validaciones ejecutadas

```
✅ python -m py_compile app/adapters/s3_document_store.py → OK
✅ python -m py_compile app/config/settings.py → OK
✅ python -m py_compile app/main.py → OK
✅ python -m pytest apps/backend/collaboration-service/tests -v → 130 passed
✅ docker compose config → Validated
✅ docker compose build collaboration-service → Built OK
```

## Resultado Git

```
A apps/backend/collaboration-service/app/adapters/s3_document_store.py
A apps/backend/collaboration-service/tests/test_s3_document_store.py
M apps/backend/collaboration-service/app/adapters/__init__.py
M apps/backend/collaboration-service/app/config/settings.py
M apps/backend/collaboration-service/app/main.py
M apps/backend/collaboration-service/requirements.txt
M apps/backend/collaboration-service/requirements-dev.txt
M .env.example
```

## Decisión de diseño: S3-only (no DynamoDB)

Object metadata en S3 es suficiente para el MVP. DynamoDB puede evaluarse en PM-03E.5 si se necesitan queries sobre metadata de snapshots.

## Riesgos restantes

1. **IAM/AWS real pendiente** — `boto3` usa default credential chain; producción requiere IAM role o credentials configuradas
2. **No DynamoDB todavía** — S3-only; metadata queries no disponibles
3. **`DOCUMENT_STORE_TYPE=s3` sin `AWS_S3_BUCKET_NAME`** — falla claro al startup con `ValueError`
4. **`exists()` moto error code** — tolerancia a `NoSuchKey`/`404`/`Not Found` implementada
5. **`id(msg)` como channel_id** — persiste de PM-03E.1.x

## Contrato para la siguiente iteración

**PM-03E.4B: Docker/local config no-regression**

- Validar que `DOCUMENT_STORE_TYPE=local` sigue funcionando en Docker con el nuevo código
- Validar que smoke test de persistencia no se rompe
- Ejecutar smoke con `DOCUMENT_STORE_TYPE=local`

**PM-03E.5: AWS real wiring** (requiere approval separate)

- Crear bucket S3 en AWS Academy Learner Lab
- Configurar IAM role o credentials
- Probar con `SUPABASE_TEST_JWT` fresco (smoke E2E real)

## Archivos recomendados para commit

```
A apps/backend/collaboration-service/app/adapters/s3_document_store.py
A apps/backend/collaboration-service/tests/test_s3_document_store.py
M apps/backend/collaboration-service/app/adapters/__init__.py
M apps/backend/collaboration-service/app/config/settings.py
M apps/backend/collaboration-service/app/main.py
M apps/backend/collaboration-service/requirements.txt
M apps/backend/collaboration-service/requirements-dev.txt
M .env.example
M docs/migration/latest_handoff.md
M docs/migration/PM-03E-persistence-design.md
M tasks.md
M migracion_briefly.md
```

## Archivos excluidos

```
auditaciones_comandos.txt
.env, *.log, __pycache__/, *.pyc, node_modules/
.claude/
.data/
*.bin
```

**PM-03E.4A listo para revisión APEX.**
