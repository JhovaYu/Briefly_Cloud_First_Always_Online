# PM-04 — Planning Service REST Design Spec

**Fecha:** 2026-04-27
**Fase:** PM-04.0B (discovery completada por Jarvis, auditada por Gemini)
**HEAD:** c47de21 DX-01A.2 rewrite bsecretcheck for PS 5.1 compatibility

---

## 1. Contexto

### Estado previo

- **PM-03E completado** — Persistencia S3 con snapshots, debounce, hard restore sobre AWS Academy Learner Lab. 153 tests passing. collaboration-service listo.
- **DX-01A completado** — Briefly Safety Helpers para PowerShell 5.1. Repo verificado limpio. bsecretcheck, bpreflight, bjwtsafe, bsafeenvs3, bredactlog operativos.
- **workspace-service es patron de referencia** — Hexagonal architecture, SupabaseJWKSVerifier singleton, httpx workspace permissions client, in-memory repositories.

### Planning-service skeleton existente

```
apps/backend/planning-service/app/
  api/__init__.py       (routes.py placeholder)
  domain/__init__.py
  ports/__init__.py
  adapters/__init__.py
  use_cases/__init__.py
  config.py             (placeholder)
  main.py               (placeholder)
  tests/__init__.py
```

Solo existen los `__init__.py` vacíos y un `routes.py` placeholder. No hay dominio, puertos ni casos de uso implementados.

### Frontend Tasks/Calendar/Schedule

El frontend Electron/React actual (`apps/desktop/src/`) tiene pantallas TasksScreen, CalendarScreen y ScheduleScreen. Estas operan exclusivamente sobre estado local Yjs — no hay integracion cloud-first REST. La migracion de estas pantallas a React Query + planning-service es scope de PM-04 completo, no de PM-04.1.

---

## 2. Objetivo PM-04

PM-04 es la implementacion del Planning Service REST para tareas y listas de tareas, desacoplado del sistema Yjs reactivo.

**PM-04.1 — In-Memory REST (este documento)**
Validar: backend contract, auth (JWT + workspace authorization), y arquitectura hexagonal sobre el skeleton existente. Nada de Postgres todavia.

**PM-04.2 — DB real (postergado)**
Adelanta la migracion a Postgres/Supabase DB real para evitar Big Bang Migration cuando el frontend este listo para integrarse.

**PM-04.1 NO incluye:**
- Frontend integration (React Query,迁移 de estado Yjs local)
- Calendar Events
- Schedule
- Postgres / SQL migrations

---

## 3. Decisiones aceptadas

| Decision | Rationale |
|---|---|
| In-memory en PM-04.1, Postgres en PM-04.2 | Avoids Big Bang Migration. Frontend puede avanzar sin esperar DB. |
| Client-generated UUIDs en POST | Evita dependencia de ID generation server-side. Simplifica deduplicacion en clientes. |
| Sin `/me` endpoint | Auth es delegated al workspace-service. planning-service no necesita identidad propia mas alla del JWT. |
| JWT local (Supabase JWKS) + workspace authorization remota | 401 rapido sin llamada HTTP externa. 403 requiere verificacion de permisos contra workspace-service. |
| Sin `/workspaces/{id}/me` ni endpoints de identidad | El JWT contiene `sub` (user_id). Workspace membership se verifica via workspace-service HTTP call. |
| No Calendar Events en PM-04.1 | Scope reduction. Calendar es feature, no foundation. |
| No frontend integration en PM-04.1 | El backend contract es lo que se valida. React Query viene en PM-04 completo cuando el frontend se migrara. |

---

## 4. API Contract PM-04.1

### Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /workspaces/{workspace_id}/task-lists | List all task lists in a workspace |
| POST | /workspaces/{workspace_id}/task-lists | Create a task list (client-generated id) |
| GET | /workspaces/{workspace_id}/tasks | List all tasks in a workspace |
| POST | /workspaces/{workspace_id}/tasks | Create a task (client-generated id) |
| PUT | /workspaces/{workspace_id}/tasks/{task_id} | Update a task |
| DELETE | /workspaces/{workspace_id}/tasks/{task_id} | Delete a task |

**Excluidos de PM-04.1:**
- `GET /me` (not needed)
- Calendar events (`/workspaces/{workspace_id}/events`)
- Schedule (`/workspaces/{workspace_id}/schedule`)
- Task list update/delete (CRUD completo de task lists queda para PM-04.2 o iterations posteriores)

### Path prefix

El servicio corre internamente en `/planning`. Nginx routing delivers `/api/planning/*` as `/*` internally. Los paths arriba asumen el prefijo ya strippeado por Nginx.

### 401/403 behavior

1. Missing `Authorization: Bearer <token>` header → 401 antes de cualquier logica.
2. Invalid/expired JWT → 401 antes de cualquier logica.
3. Valid JWT pero usuario no es member del workspace → 403 Forbidden.
4. Valid JWT, member, pero sin permisos de planning → 403 Forbidden.

---

## 5. Data Schemas

### TaskList

```python
class TaskList:
    id: UUID              # client-generated, preserved in POST response
    workspace_id: UUID    # from path, validated against JWT claims
    name: str             # 1-255 chars
    color: Optional[str]   # hex color, e.g. "#3B82F6", nullable
    created_at: datetime  # server-set on creation
    updated_at: datetime  # server-set on every update
    created_by: UUID      # user_id from JWT `sub` claim
```

### Task

```python
class Task:
    id: UUID             # client-generated, preserved in POST response
    workspace_id: UUID   # from path, validated against JWT claims
    list_id: Optional[UUID]  # nullable — task may exist without a list
    text: str            # 1-10000 chars
    state: TaskState     # enum: pending | working | done
    priority: Priority  # enum: low | medium | high
    assignee_id: Optional[UUID]  # nullable
    due_date: Optional[datetime]  # nullable, ISO 8601
    description: Optional[str]  # nullable, max 5000 chars
    tags: Optional[list[str]]  # nullable, max 20 tags, each max 50 chars
    created_at: datetime   # server-set on creation
    updated_at: datetime   # server-set on every update
    completed_at: Optional[datetime]  # nullable, set when state transitions to done
    created_by: UUID     # user_id from JWT `sub` claim
```

### Enums

```python
class TaskState(str, Enum):
    PENDING = "pending"
    WORKING = "working"
    DONE = "done"

class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
```

### Error responses

```json
{
  "detail": "string"  // human-readable error message
}
```

401: `{"detail": "Missing or invalid authorization token"}`
403: `{"detail": "Insufficient permissions for this workspace"}`
404: `{"detail": "Task not found"}` or `{"detail": "TaskList not found"}`
422: Validation error body per FastAPI/Pydantic

---

## 6. Auth Model

### Flow

```
Client request
    │
    ▼
planning-service: extract Bearer token from Authorization header
    │
    ▼
SupabaseJWKSVerifier.verify(token)  [local, no HTTP call]
    │  401 if missing/invalid/expired
    ▼
workspace_id from path
    │
    ▼
WorkspacePermissionsClient.checkMembership(user_id, workspace_id)  [HTTP call to workspace-service]
    │  403 if not a member
    ▼
Check planning permissions (read/write)  [HTTP call to workspace-service]
    │  403 if no permission
    ▼
Request proceeds to use case
```

### SupabaseJWKSVerifier

Duplicado de workspace-service. Esto es deuda técnica aceptada temporalmente. La extraccion a shared library es postergada a cuando el patron este validado y el scope de refactoring sea claro.

### WorkspacePermissionsClient

Interface: `has_planning_permission(user_id: UUID, workspace_id: UUID, permission: str) -> bool`

Adapter: HTTP client calling `GET /workspaces/{workspace_id}/permissions?user_id={user_id}` on workspace-service (via internal Docker network). Returns True/False.

El resultado se cachea en memoria por el lifetime del request para evitar llamadas redundantes dentro del mismo request.

---

## 7. Architecture

Follows workspace-service hexagonal pattern:

```
app/
  api/
    routes.py           # FastAPI router, request/response DTOs
    dependencies.py     # FastAPI dependencies (get_current_user, get_workspace_permissions)
    schemas.py          # Pydantic request/response models
  domain/
    task.py            # Task entity + state machine
    task_list.py       # TaskList entity
    errors.py          # Domain exceptions (NotFound, PermissionDenied, InvalidState)
  ports/
    task_repository.py    # Abstract interface (Protocol)
    task_list_repository.py  # Abstract interface (Protocol)
    workspace_permissions.py  # Abstract interface
  adapters/
    auth/
      supabase_jwks_token_verifier.py  # Same as workspace-service, duplicated
    workspace_client.py  # HTTP client for workspace-service permissions
    persistence/
      in_memory_task_repository.py
      in_memory_task_list_repository.py
  use_cases/
    create_task.py
    list_tasks.py
    update_task.py
    delete_task.py
    create_task_list.py
    list_task_lists.py
  config/
    settings.py        # pydantic BaseSettings, reads from env
  main.py             # FastAPI app, lifespan, mount routers
```

### File-by-file summary

| File | Purpose |
|---|---|
| `api/routes.py` | 6 route handlers matching the API contract |
| `api/dependencies.py` | `get_current_user` (JWT verify), `get_workspace_permissions` (HTTP check) |
| `api/schemas.py` | Pydantic models: Task, TaskList, task/task-list I/O DTOs |
| `domain/task.py` | `Task` entity class, `TaskState` enum, `Priority` enum |
| `domain/task_list.py` | `TaskList` entity class |
| `domain/errors.py` | Domain exceptions |
| `ports/task_repository.py` | `TaskRepository` Protocol (abc) |
| `ports/task_list_repository.py` | `TaskListRepository` Protocol (abc) |
| `ports/workspace_permissions.py` | `WorkspacePermissions` Protocol (abc) |
| `adapters/auth/supabase_jwks_token_verifier.py` | Exact copy from workspace-service |
| `adapters/workspace_client.py` | httpx client implementing `WorkspacePermissions` |
| `adapters/persistence/in_memory_task_repository.py` | In-memory dict-backed `TaskRepository` implementation |
| `adapters/persistence/in_memory_task_list_repository.py` | In-memory dict-backed `TaskListRepository` implementation |
| `use_cases/create_task.py` | `CreateTask(user_id, workspace_id, task_data) -> Task` |
| `use_cases/list_tasks.py` | `ListTasks(workspace_id) -> list[Task]` |
| `use_cases/update_task.py` | `UpdateTask(task_id, user_id, updates) -> Task` |
| `use_cases/delete_task.py` | `DeleteTask(task_id, user_id) -> None` |
| `use_cases/create_task_list.py` | `CreateTaskList(user_id, workspace_id, data) -> TaskList` |
| `use_cases/list_task_lists.py` | `ListTaskLists(workspace_id) -> list[TaskList]` |
| `config/settings.py` | pydantic BaseSettings: JWT-related vars, workspace-service URL, env prefix `PLANNING_` |

---

## 8. In-Memory Persistence

Each repository adapter holds data in a `dict` keyed by `id` (UUID). Data is ephemeral — lost on service restart. This is intentional for PM-04.1.

```python
class InMemoryTaskRepository(TaskRepository):
    def __init__(self) -> None:
        self._tasks: dict[UUID, Task] = {}

    async def save(self, task: Task) -> Task:
        self._tasks[task.id] = task
        return task

    async def find_by_id(self, task_id: UUID) -> Task | None:
        return self._tasks.get(task_id)

    async def find_by_workspace(self, workspace_id: UUID) -> list[Task]:
        return [t for t in self._tasks.values() if t.workspace_id == workspace_id]

    async def delete(self, task_id: UUID) -> bool:
        return bool(self._tasks.pop(task_id, None))
```

The repository is registered in the FastAPI dependency injection container as a singleton per the workspace-service pattern.

---

## 9. Tests Required for PM-04.1

### Auth tests

| Test | Expected behavior |
|---|---|
| Request without Authorization header | 401 |
| Request with malformed Authorization header | 401 |
| Request with expired JWT | 401 |
| Request with valid JWT but user not workspace member | 403 |
| Request with valid JWT, workspace member, but no planning read permission | 403 |
| Request with valid JWT, workspace member, with planning read permission | proceeds |

### Task CRUD tests

| Test | Expected behavior |
|---|---|
| POST /workspaces/{ws_id}/tasks with client-generated UUID | 201, Task with exact id preserved |
| POST /workspaces/{ws_id}/tasks without Authorization | 401 |
| POST /workspaces/{ws_id}/tasks with invalid task state | 422 |
| POST /workspaces/{ws_id}/tasks with invalid priority | 422 |
| POST /workspaces/{ws_id}/tasks with missing required field | 422 |
| GET /workspaces/{ws_id}/tasks returns only tasks from that workspace | 200, filtered |
| GET /workspaces/{ws_id}/tasks/{task_id} when task exists | 200, Task |
| GET /workspaces/{ws_id}/tasks/{task_id} when task does not exist | 404 |
| PUT /workspaces/{ws_id}/tasks/{task_id} updates fields | 200, updated Task |
| PUT /workspaces/{ws_id}/tasks/{task_id} with invalid state | 422 |
| PUT /workspaces/{ws_id}/tasks/{task_id} where task belongs to different workspace | 404 |
| DELETE /workspaces/{ws_id}/tasks/{task_id} when task exists | 204 |
| DELETE /workspaces/{ws_id}/tasks/{task_id} when task does not exist | 404 |

### TaskList tests

| Test | Expected behavior |
|---|---|
| POST /workspaces/{ws_id}/task-lists with client-generated UUID | 201, TaskList with exact id preserved |
| GET /workspaces/{ws_id}/task-lists returns only lists from that workspace | 200, filtered |
| GET /workspaces/{ws_id}/task-lists/{list_id} when list exists | 200, TaskList |
| GET /workspaces/{ws_id}/task-lists/{list_id} when list does not exist | 404 |

### Workspace isolation tests

| Test | Expected behavior |
|---|---|
| User A in Workspace 1 creates task; User B in Workspace 2 lists tasks | Workspace 2 list is empty |
| Task created in Workspace 1; GET from Workspace 2 returns 404 | Correct isolation |
| DELETE task from Workspace 1; GET from Workspace 2 returns 404 | Correct isolation |

### Health tests

| Test | Expected behavior |
|---|---|
| GET /health without X-Shared-Secret | 401 Unauthorized |
| GET /health with X-Shared-Secret | 200 OK |

---

## 10. Out of Scope

- Frontend integration (React Query, Yjs state migration)
- Calendar events
- Recurring events
- TaskList update and delete (create + list only for PM-04.1)
- Postgres / SQL migrations / Alembic
- Yjs planning sync (CRDT for planning is a separate future concern)
- DynamoDB or any other persistent DB adapter (in-memory only for PM-04.1)
- `/me` endpoint
- Token refresh flows

---

## 11. Risks and Debt

| Risk | Severity | Mitigation |
|---|---|---|
| In-memory data lost on restart | HIGH for production | PM-04.2 brings Postgres. This is accepted for PM-04.1 validation. |
| SupabaseJWKSVerifier duplicated | MEDIUM | Refactor to shared package after PM-04.1 validated. Track as debt. |
| Future Yjs planning sync vs REST conflict | MEDIUM | Planning uses REST for PM-04. Decision to revisit when Yjs planning spike happens. |
| workspace-service permissions client adds latency | LOW | HTTP call is local Docker network. Cache per-request. |
| Client-generated IDs require deduplication on frontend | MEDIUM | React Query handles deduplication via query keys. Document in PM-04.1 handoff. |
| No transactional consistency across repositories | LOW | In-memory single-threaded is acceptable for PM-04.1. Postgres brings transactions. |

---

## 12. PM-04.1 Implementation Phases

### Phase A: Skeleton alignment and config

- Create `config/settings.py` mirroring workspace-service pattern
- Wire `main.py` with lifespan, settings loading, router mounting
- Verify `/health` endpoint with X-Shared-Secret

### Phase B: Domain + Schemas

- Create `domain/task.py`, `domain/task_list.py`, `domain/errors.py`
- Create `api/schemas.py` with Pydantic request/response models
- Run `python -m py_compile` to verify syntax

### Phase C: Ports + In-memory adapters

- Create `ports/task_repository.py`, `ports/task_list_repository.py`, `ports/workspace_permissions.py`
- Create `adapters/persistence/in_memory_task_repository.py`, `adapters/persistence/in_memory_task_list_repository.py`
- Create `adapters/workspace_client.py`
- Write unit tests for repositories (mock ports, test in-memory adapters)

### Phase D: Auth dependencies + workspace permissions client

- Copy `adapters/auth/supabase_jwks_token_verifier.py` from workspace-service
- Create `api/dependencies.py` with `get_current_user`, `get_workspace_permissions`
- Verify 401/403 behavior with unit tests (mock JWKS, mock workspace client)

### Phase E: Use cases

- Create all 6 use cases under `use_cases/`
- Wire to ports via constructor injection
- Write unit tests for each use case

### Phase F: Routes

- Create `api/routes.py` with all 6 endpoints
- Wire routes to use cases via dependencies
- End-to-end integration tests for happy path + error paths

### Phase G: Tests

- Execute all tests from Section 9
- Verify pytest passes for planning-service tests
- Verify no regression in workspace-service tests

### Phase H: Docker/local validation

- `docker compose config` passes
- `docker compose build planning-service` succeeds
- `planning-service /health` returns 200 with secret
- `planning-service /health` returns 401 without secret

---

## 13. Acceptance Criteria

- [ ] All planning-service tests pass (pytest)
- [ ] Existing backend tests still pass (or targeted services pass)
- [ ] Docker build planning-service OK
- [ ] planning-service /health OK with X-Shared-Secret
- [ ] planning-service /health returns 401 without X-Shared-Secret
- [ ] Auth 401/403 tests pass
- [ ] Client-generated IDs preserved (POST returns exact id sent by client)
- [ ] workspace_id isolation verified
- [ ] Invalid task state rejected with 422
- [ ] Invalid priority rejected with 422
- [ ] No AWS touched
- [ ] No .env.s3 values read or printed
- [ ] No real secrets printed
- [ ] No git add/commit/push

---

## 14. PM-04.2 — Postgres Real Persistence

**Fecha:** 2026-04-27
**Fase:** PM-04.2 (discovery completado, diseño aprobado)
**HEAD:** acba643 PM-04.1B add planning service runtime API smoke
**Prioridad:** Alta — debe completarse antes de integración frontend/demo

---

### 14.1 Objetivo PM-04.2

Reemplazar los adaptadores in-memory de planning-service con persistencia real en Postgres, manteniendo la arquitectura hexagonal existente y el contrato REST sin cambios en routes ni use cases.

**Scope:**
-Nuevos adaptadores de persistencia Postgres en `adapters/persistence/postgres_*.py`
- Feature flag `PLANNING_STORE_TYPE` para switch entre inmemory/postgres
- Migraciones Alembic dentro de planning-service
- Tests de repository contract y validación Postgres-backed

**No incluye:**
- Frontend integration
- Calendar events
- Schedule
- Soft delete
- TaskList update/delete

---

### 14.2 Stack Decided

| Componente | Decisión |
|---|---|
| ORM | SQLAlchemy 2.0 async (`sqlalchemy[asyncio]>=2.0`) |
| Driver Postgres | `asyncpg>=0.30` |
| Migraciones | `alembic>=1.13` — vive dentro de `planning-service/alembic/` |
| DB real | Postgres opt-in via `PLANNING_STORE_TYPE=postgres` |
| Default | `PLANNING_STORE_TYPE=inmemory` (no rompe Docker local sin Postgres) |
| UUID en DB | UUID nativo Postgres (`gen_random_uuid()`), no TEXT |

**No usar Supabase Python client para DB** — es wrapper REST, no driver Postgres wire.

---

### 14.3 Environment / Config

```python
# planning-service/app/config/settings.py — additions
PLANNING_STORE_TYPE: str = "inmemory"   # "inmemory" | "postgres"
PLANNING_DATABASE_URL: str = ""          # postgresql+asyncpg://user:pass@host:5432/db
```

**.env.example additions:**
```
PLANNING_STORE_TYPE=inmemory
PLANNING_DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/planning
```

**Docker compose — planning-service environment:**
```yaml
environment:
  - PLANNING_STORE_TYPE=${PLANNING_STORE_TYPE:-inmemory}
  - PLANNING_DATABASE_URL=${PLANNING_DATABASE_URL:-}
```

`PLANNING_STORE_TYPE=postgres` requiere que `PLANNING_DATABASE_URL` esté configurada. Si no lo está, el servicio falla en startup con mensaje claro.

---

### 14.4 Schema Design (Postgres)

#### task_lists

```sql
CREATE TABLE task_lists (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
    color        TEXT,          -- nullable, hex color
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID NOT NULL,
    UNIQUE (id, workspace_id)   -- composite uniqueness for FK safety
);

CREATE INDEX idx_task_lists_workspace_id ON task_lists (workspace_id);
```

**Nota:** Aunque el cliente envía `id` en POST, Postgres usa `DEFAULT gen_random_uuid()` para auto-generar si no se envía. Para preservar client-generated IDs, el adapter usa `INSERT ... ON CONFLICT (id) DO NOTHING RETURNING *` y retorna el registro existente si el id ya existe con payload compatible.

#### tasks

```sql
CREATE TABLE tasks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    list_id      UUID,          -- nullable, FK composite (list_id, workspace_id)
    text         TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 10000),
    state        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (state IN ('pending', 'working', 'done')),
    priority     TEXT NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low', 'medium', 'high')),
    assignee_id  UUID,
    due_date     TIMESTAMPTZ,
    description  TEXT,
    tags         TEXT[],         -- Postgres array, max 20 items enforced in app
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_by   UUID NOT NULL,
    FOREIGN KEY (list_id, workspace_id)
        REFERENCES task_lists(id, workspace_id)
        ON DELETE SET NULL
);

CREATE INDEX idx_tasks_workspace_id ON tasks (workspace_id);
CREATE INDEX idx_tasks_list_id ON tasks (list_id) WHERE list_id IS NOT NULL;
CREATE INDEX idx_tasks_assignee ON tasks (assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_tasks_state ON tasks (workspace_id, state);
```

**Composite FK rationale:** `tasks.list_id` references `task_lists(id, workspace_id)` — no solo `task_lists.id`. Esto previene que un task creado en workspace-1 pueda referenciar una task_list que pertenece a workspace-2.

**UUID nativo vs TEXT:** Postgres UUID type es 16 bytes binarios, más eficiente que TEXT para índices. El adapter convierte entre Python `uuid.UUID` ↔ Postgres `UUID`.

---

### 14.5 Duplicate ID / Idempotency Semantics

Esta es la decisión más crítica del schema design.

**Contracto:** Client-generated IDs en POST — el cliente envía el UUID y espera que se preserve.

**Casos:**

| Scenario | Comportamiento |
|---|---|
| `POST /task-lists` con `id` nuevo | Crea, retorna 201 con el id |
| `POST /task-lists` con `id` existente + mismo payload | 200 OK, retorna recurso existente (idempotent retry) |
| `POST /task-lists` con `id` existente + payload diferente | 409 Conflict |
| `POST /tasks` con `id` existente + mismo payload | 200 OK, retorna recurso existente |
| `POST /tasks` con `id` existente + payload diferente | 409 Conflict |
| Mismo `id` en otro workspace (sin FK conflict) | 409 Conflict — id uniqueness es global sobre todos los workspaces |

**Implementación en adapter:**
```python
async def save(self, task: Task) -> Task:
    existing = await self._session.get(TaskModel, task.id)
    if existing:
        # Idempotent check: compare payload
        if self._payload_matches(existing, task):
            return self._to_entity(existing)   # return existing, 200 OK
        else:
            raise DuplicateIdError(f"id {task.id} conflicts with existing resource")
    # Insert new
    self._session.add(model)
    await self._session.flush()
    return self._to_entity(model)
```

**`DuplicateIdError`** es nuevo en `domain/errors.py`. El route handler lo convierte a 409.

**Cross-workspace safety:** El `UNIQUE (id)` en task_lists y `PRIMARY KEY (id)` en tasks actúa globalmente. Un id no puede existir en dos workspaces. El 409 es correcto.

---

### 14.6 Repository Adapter Design

```
adapters/persistence/
├── in_memory_task_repository.py       # existe, no cambia
├── in_memory_task_list_repository.py  # existe, no cambia
├── postgres_task_repository.py        # NUEVO — implementa TaskRepository
└── postgres_task_list_repository.py   # NUEVO — implementa TaskListRepository
```

**Domain / Ports / Use Cases / Routes / Schemas:** SIN CAMBIOS.

Los ports (`TaskRepository`, `TaskListRepository`) son contratos que ambos adaptadores cumplen.

**Dependency injection factory:**
```python
# api/dependencies.py — modified
def get_task_repo() -> TaskRepository:
    if settings.PLANNING_STORE_TYPE == "postgres":
        return PostgresTaskRepository(async_engine)
    return InMemoryTaskRepository()
```

Async engine es inyectado como singleton.

---

### 14.7 Alembic Setup

```
planning-service/
├── alembic.ini           # generated: alembic init alembic
└── alembic/
    ├── env.py            # async engine support
    ├── script.py.mako
    └── versions/
        └── 001_initial_task_tables.py
```

**Alembic location:** dentro de `planning-service/`, no en repo root.

**Initial migration:** `001_initial_task_tables.py` crea ambas tablas, indexes, constraints en un solo migration file.

**Upgrade/Downgrade:**
```bash
alembic upgrade head         # apply all migrations
alembic downgrade base       # rollback all
alembic current              # show current version
alembic history              # show migration chain
```

**Validation:** alembic upgrade → downgrade → upgrade en cada PR validation.

---

### 14.8 Testing Strategy

| Test Type | Strategy |
|---|---|
| Existing PM-04.1 tests | No changes — pasan con `PLANNING_STORE_TYPE=inmemory` |
| Repository contract tests | `test_repository_contract.py` — corre contra ambas implementaciones |
| Postgres adapter unit tests | `test_postgres_task_repository.py` — usa testcontainers o skip si no Docker |
| Idempotency/409 tests | `test_postgres_idempotency.py` — específica para duplicate ID semantics |
| Smoke test | `planning_api_smoke.py` actual — sigue pasando con inmemory |

**SQLite:** puede usarse para unit tests rápidos que no requieran feature Postgres-specific (UUID, TEXT[], ON CONFLICT). **No es source of truth para aceptación** — la aceptación real debe ser Postgres-backed.

**Testcontainers:** Levantará Postgres real en tests de integración. Requiere Docker daemon.

```
# .github/workflows/test.yml — addition
- name: Run planning-service tests
  run: |
    docker compose up -d postgres-test
    PLANNING_STORE_TYPE=postgres PLANNING_DATABASE_URL=postgresql://... pytest apps/backend/planning-service/tests/
```

---

### 14.9 Docker Strategy

**No Postgres en docker-compose por defecto.** El default es `PLANNING_STORE_TYPE=inmemory` — planning-service funciona sin Postgres.

**postgres service (opcional):**
```yaml
postgres-planning:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: planning
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: ${PLANNING_DB_PASSWORD:-changeme}
  ports:
    - "5433:5432"
  volumes:
    - pg-planning-data:/var/lib/postgresql/data
  networks:
    - briefly-internal
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 5s
    timeout: 3s
    retries: 5
```

**PM-04.1B smoke no se rompe:** con `PLANNING_STORE_TYPE=inmemory`, el smoke pasa sin Postgres. No hay breaking change.

**New smoke:** `planning_api_postgres_smoke.py` corre con `PLANNING_STORE_TYPE=postgres` y valida Postgres-backed CRUD completo.

---

### 14.10 Risks / Debt

| Risk | Severity | Mitigation |
|---|---|---|
| `datetime.utcnow()` deprecation en SQLAlchemy | LOW | Usar `func.now()` en migrations; fix warnings en follow-up |
| Alembic migration failure on fresh DB | MEDIUM | Test migrations en CI; idempotent migrations (IF NOT EXISTS) |
| Async SQLAlchemy complexity | MEDIUM | Seguir patrón existente de workspace-service (si tiene async) o docs; pair programming |
| Env secrets (PLANNING_DATABASE_URL) | HIGH | Nunca commitear. Alembic env.py usa `Settings` pydantic, no hardcode |
| Supabase Academy credential expiry | HIGH | No reliance en cloud DB para PM-04.2 dev — usar local Postgres Docker |
| Cross-workspace data leak via list_id | HIGH | Composite FK `(list_id, workspace_id)` previene; tests deben cover this |
| duplicate ID semantics confusion | MEDIUM | Documentar claramente en API spec + integration tests |
| testcontainers Docker dependency in CI | MEDIUM | Provide fallback: `pytest --ignore=postgres_tests` si no Docker |

---

### 14.11 Implementation Phases PM-04.2

**Phase A: Dependencias + Alembic skeleton**
- Agregar `sqlalchemy[asyncio]>=2.0`, `asyncpg>=0.30`, `alembic>=1.13` a `requirements.txt`
- Crear `alembic.ini` dentro de planning-service
- Crear `alembic/env.py` con async engine support
- Generate `001_initial_task_tables.py` migration
- Verify: `alembic upgrade head` + `alembic downgrade base`

**Phase B: SQLAlchemy models**
- Crear `adapters/persistence/models.py` (SQLAlchemy declarative Base)
- `TaskListModel` y `TaskModel` con columnas matching schema
- Mappers `to_entity()` / `to_model()` en adapters

**Phase C: Postgres adapter implementations**
- `postgres_task_list_repository.py` — implementa `TaskListRepository`
- `postgres_task_repository.py` — implementa `TaskRepository`
- Duplicate ID detection + `DuplicateIdError`
- Idempotent retry (same payload → 200 OK)

**Phase D: Dependency factory + feature flag**
- Modificar `api/dependencies.py`: `get_task_repo()` / `get_task_list_repo()` con switch `PLANNING_STORE_TYPE`
- Modificar `config/settings.py`: agregar `PLANNING_STORE_TYPE`, `PLANNING_DATABASE_URL`
- Default `PLANNING_STORE_TYPE=inmemory` — servicio funciona sin Postgres

**Phase E: Repository contract tests**
- `test_repository_contract.py` — interface compliance para ambos adapters
- `test_postgres_idempotency.py` — duplicate ID semantics
- `test_cross_workspace_fk.py` — composite FK safety

**Phase F: Docker Postgres local validation**
- Agregar `postgres-planning` servicio a `docker-compose.yml`
- Agregar env vars `PLANNING_STORE_TYPE`, `PLANNING_DATABASE_URL`
- `docker compose up -d postgres-planning`
- Run: `alembic upgrade head` dentro del container
- Run: existing smoke with `PLANNING_STORE_TYPE=postgres`

**Phase G: Smoke update**
- `planning_api_postgres_smoke.py` — nuevo smoke, mismo pattern que PM-04.1B
- Validates: create task-list, create task, list, update, delete con Postgres

**Phase H: Docs closeout**
- Update `docs/migration/latest_handoff.md` con PM-04.2 completo
- Verify no secrets printed, no AWS touched

---

### 14.12 Acceptance Criteria PM-04.2

- [ ] All existing planning-service tests pass (PLANNING_STORE_TYPE=inmemory)
- [ ] PM-04.1B smoke test passes (PLANNING_STORE_TYPE=inmemory)
- [ ] `alembic upgrade head` applies cleanly
- [ ] `alembic downgrade base` rolls back cleanly
- [ ] `alembic current` shows current migration
- [ ] PostgresTaskRepository implements TaskRepository Protocol
- [ ] PostgresTaskListRepository implements TaskListRepository Protocol
- [ ] Duplicate ID with same payload → 200 OK (idempotent retry)
- [ ] Duplicate ID with different payload → 409 Conflict
- [ ] Cross-workspace `list_id` rejected by FK constraint
- [ ] UUID native in Postgres (not TEXT)
- [ ] TEXT[] for tags stores/retrieves correctly
- [ ] `planning_api_postgres_smoke.py` passes
- [ ] No AWS touched
- [ ] No .env.s3 values read or printed
- [ ] No secrets printed
- [ ] No git add/commit/push

---

## 15. References

- `docs/migration/latest_handoff.md` — PM-03E.5D completion record
- `docs/migration/PM-03E-persistence-design.md` — S3DocumentStore + persistence architecture
- `apps/backend/workspace-service/` — reference architecture (hexagonal pattern + SupabaseJWKSVerifier + httpx permissions client)
- `apps/backend/planning-service/` — skeleton to be implemented
- `migracion_briefly.md` — phase 3 planning scope, Section 3.4 convention of routes
