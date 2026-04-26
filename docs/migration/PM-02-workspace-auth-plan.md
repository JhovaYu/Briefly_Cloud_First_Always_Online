# PM-02 — Workspace Service + Supabase Auth
## Plan Refinado

**Versión:** 1.0
**Fecha:** 2026-04-24
**Dependencias:** PM-01 (completado), arquitectura v2.1/v2.2
**Ámbito:** workspace service con autenticación Supabase JWT

---

## 0. Contexto y dependencias

PM-01 entregó foundation local con:
- 5 servicios FastAPI skeleton
- Docker Compose + Nginx
- Healthchecks + X-Shared-Secret
- `/collab/*` hotfix aplicado (prefix preservado)

**Duda académica pendiente** (v2.2): profesor no ha respondido sobre si "5 bases de datos independientes" acepta ownership DynamoDB/S3 por servicio o exige separación física.

**PM-02 scope:** Workspace Service mínimo con Supabase JWT, dominio workspace/membership/document metadata y autorización base.

---

## 1. Objetivo del slice

Implementar Workspace Service funcional con:
1. **Verificación JWT de Supabase** — validar tokens en cada request protegido
2. **Dominio workspace/membership/document metadata** — modelos puros sin dependencias de infraestructura
3. **Puerto de repositorio** — abstracción que permite cambiar persistencia sin tocar lógica de negocio
4. **Endpoints mínimos** — CRUD de workspaces y documentos, con autorización por membresía

---

## 2. Alcance PM-02

### 2.1 Endpoints

| Método | Path | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | Público | Healthcheck público |
| GET | `/healthz` | Público | Healthcheck alternativo |
| GET | `/me` | JWT requerido | Perfil del usuario autenticado (del JWT) |
| POST | `/workspaces` | JWT requerido | Crear workspace |
| GET | `/workspaces` | JWT requerido | Listar workspaces del usuario |
| GET | `/workspaces/{workspace_id}` | JWT requerido + membresía | Obtener workspace |
| POST | `/workspaces/{workspace_id}/documents` | JWT requerido + membresía | Crear documento metadata |
| GET | `/workspaces/{workspace_id}/documents` | JWT requerido + membresía | Listar documentos |
| GET | `/workspaces/{workspace_id}/permissions` | JWT requerido + membresía | Obtener permisos del usuario |

### 2.2 Modelos de dominio

```python
# domain/workspace.py
@dataclass
class Workspace:
    id: str              # UUID generado por el servicio
    name: str
    owner_id: str        # sub del JWT
    created_at: datetime
    updated_at: datetime

# domain/membership.py
@dataclass
class Membership:
    id: str
    workspace_id: str
    user_id: str          # sub del JWT
    role: MembershipRole  # enum: owner, member, viewer
    joined_at: datetime

class MembershipRole(str, Enum):
    OWNER = "owner"
    MEMBER = "member"
    VIEWER = "viewer"

# domain/document_metadata.py
@dataclass
class DocumentMetadata:
    id: str
    workspace_id: str
    title: str
    created_by: str       # sub del JWT
    created_at: datetime
    updated_at: datetime
```

### 2.3 Errores de dominio

```python
# domain/errors.py
class WorkspaceError(Exception):
    """Excepción base para errores de workspace"""
    pass

class WorkspaceNotFound(WorkspaceError):
    """Workspace no existe o usuario no tiene acceso"""
    pass

class MembershipNotFound(WorkspaceError):
    """Usuario no es miembro del workspace"""
    pass

class Unauthorized(WorkspaceError):
    """Token inválido o expirado"""
    pass
```

---

## 3. Restricción crítica: adapter de persistencia desacoplado

### 3.1 Resolución de rúbrica

**Para PM-02 se usa adapter in-memory** por las siguientes razones:

1. **Duda académica pendiente**: hasta que el profesor responda sobre bases de datos, no se debe acoplar el dominio a DynamoDB
2. **Velocidad de demo**: adapter in-memory permite iterar rápido y validar lógica sin infraestructura
3. **Arquitectura hexagonal**: el puerto existe desde el inicio, el cambio a DynamoDB es transparente cuando se confirme
4. **PM-02 no necesita persistencia real** para la demo de 2 horas si el frontend aún no existe

### 3.2 Decisión PM-02

```
Puerto (interface) → InMemoryWorkspaceRepository → producción futura
                                                    ↓
                                            DynamoDBWorkspaceRepository (cuando profesor confirme)
                                                    ↓
                                            SQLite/PostgreSQLWorkspaceRepository (si profesor exige DB física)
```

### 3.3 Puerto de repositorio

```python
# ports/workspace_repository.py
from abc import ABC, abstractmethod

class WorkspaceRepository(ABC):
    @abstractmethod
    async def create(self, workspace: Workspace) -> Workspace: ...

    @abstractmethod
    async def get_by_id(self, workspace_id: str) -> Workspace | None: ...

    @abstractmethod
    async def list_by_owner(self, owner_id: str) -> list[Workspace]: ...

# ports/membership_repository.py
class MembershipRepository(ABC):
    @abstractmethod
    async def create(self, membership: Membership) -> Membership: ...

    @abstractmethod
    async def get_by_workspace_and_user(self, workspace_id: str, user_id: str) -> Membership | None: ...

    @abstractmethod
    async def list_by_workspace(self, workspace_id: str) -> list[Membership]: ...

# ports/document_repository.py
class DocumentRepository(ABC):
    @abstractmethod
    async def create(self, document: DocumentMetadata) -> DocumentMetadata: ...

    @abstractmethod
    async def list_by_workspace(self, workspace_id: str) -> list[DocumentMetadata]: ...
```

### 3.4 Adapter in-memory

```python
# adapters/persistence/in_memory_workspace.py
from collections import defaultdict
from typing import Any

class InMemoryWorkspaceRepository(WorkspaceRepository):
    def __init__(self):
        self._workspaces: dict[str, Workspace] = {}

    async def create(self, workspace: Workspace) -> Workspace:
        self._workspaces[workspace.id] = workspace
        return workspace

    async def get_by_id(self, workspace_id: str) -> Workspace | None:
        return self._workspaces.get(workspace_id)

    async def list_by_owner(self, owner_id: str) -> list[Workspace]:
        return [w for w in self._workspaces.values() if w.owner_id == owner_id]
```

---

## 4. Seguridad / Auth

### 4.1 Variables necesarias

```python
# config/settings.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SERVICE_PORT: int = 8001
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "local"
    SHARED_SECRET: str = "changeme"

    # Supabase Auth — JWKS/ES256
    SUPABASE_URL: str = "https://gcbwysprkqsfakaqsara.supabase.co"
    SUPABASE_JWT_ISSUER: str = "https://gcbwysprkqsfakaqsara.supabase.co/auth/v1"
    SUPABASE_JWT_AUDIENCE: str = "authenticated"
    SUPABASE_AUTH_STRATEGY: str = "jwks"
    SUPABASE_JWKS_URL: str = "https://gcbwysprkqsfakaqsara.supabase.co/auth/v1/.well-known/jwks.json"

    class Config:
        env_file = ".env"
        case_sensitive = True
```

### 4.2 Verificación JWT

**Estrategia: JWKS + ES256 ( asymmetric ).**

Supabase usa ES256 por defecto para authenticate tokens. La clave pública se resuelve dinámicamente desde JWKS endpoint.

> **No usar HS256 ni SUPABASE_JWT_SECRET.** La validación se hace vía JWKS con PyJWKClient de `PyJWT[crypto]`.

**Issuer:** `https://gcbwysprkqsfakaqsara.supabase.co/auth/v1` (formato estándar Supabase v1)

**Audience:** `authenticated` (token para API autenticada)

**JWKS URL:** `https://gcbwysprkqsfakaqsara.supabase.co/auth/v1/.well-known/jwks.json`

```python
# adapters/auth/supabase_jwks_token_verifier.py
import jwt
from jwt import PyJWKClient
from pydantic import BaseModel

class TokenPayload(BaseModel):
    sub: str
    email: str | None = None
    exp: int
    iss: str
    aud: str | list[str] | None = None

class SupabaseJWKSVerifier:
    def __init__(self, jwks_url: str, issuer: str, audience: str):
        self._jwks_client = PyJWKClient(jwks_url)
        self.issuer = issuer
        self.audience = audience

    def verify(self, token: str) -> TokenPayload:
        try:
            signing_key = self._jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                issuer=self.issuer,
                audience=self.audience,
            )
            return TokenPayload(**payload)
        except jwt.PyJWKClientError as e:
            raise Unauthorized(f"JWKS error: {e}")
        except jwt.ExpiredSignatureError:
            raise Unauthorized("Token expired")
        except jwt.InvalidTokenError as e:
            raise Unauthorized(f"Token inválido: {e}")
```

### 4.3 Manejo de errores de auth

| Situación | Response | Causa |
|---|---|---|
| Token ausente | `401 Unauthorized` | Header `Authorization: Bearer <token>` no presente |
| Token malformado | `401 Unauthorized` | JWT no es válido |
| Token expirado | `401 Unauthorized` | `exp` claim en el pasado |
| Issuer inválido | `401 Unauthorized` | `iss` no coincide con `SUPABASE_JWT_ISSUER` |
| Audience inválido | `401 Unauthorized` | `aud` no coincide con `authenticated` |
| Token válido | Continuar | Extraer `sub` para lógica de negocio |

### 4.4 Dependencies de FastAPI

```python
# api/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    verifier: SupabaseTokenVerifier = Depends(get_token_verifier)
) -> TokenPayload:
    try:
        token = credentials.credentials
        payload = verifier.verify(token)
        return payload
    except Unauthorized as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )
```

### 4.5 Reglas de seguridad

1. **No loggear JWT completo** — solo extraer `sub` para logs
2. **Validar firma siempre** — no confiar en payload sin verificar
3. **Validar expiración** — `exp` debe ser futuro
4. **Validar issuer** — debe coincidir con configuración
5. **No confiar en claims sin validar** — extraer del payload verificado

---

## 5. Autonomía entre microservicios

### 5.1 Regla de Workspace como fuente de autorización

Workspace Service es la **única fuente de verdad para permisos**:
- Cuando Collaboration Service recibe una conexión WebSocket, debe verificar que el usuario tiene membresía active en el workspace
- Esa verificación se hace preguntando a Workspace Service, no leyendo su DB directamente

### 5.2 Contrato interservicio (documentado, no implementado en PM-02)

```
GET /internal/workspaces/{workspace_id}/memberships/{user_id}
Authorization: X-Shared-Secret: {secret}

Response 200:
{"role": "owner"|"member"|"viewer"}

Response 404:
{"error": "membership_not_found"}
```

Este endpoint **no se implementa en PM-02**, se documenta para futuro.

### 5.3 Comportamiento cuando Workspace cae

| Operación | Comportamiento esperado |
|---|---|
| GET /workspaces | Devolver lista vacía o error 503 (sin corromper) |
| GET /workspaces/{id} | 503 Service Unavailable si no hay forma de verificar acceso |
| POST /workspaces | 503 Service Unavailable |

**Regla**: nunca devolver datos stale de membresías caches sin validar. No implementar cache aún.

---

## 6. Arquitectura hexagonal — estructura exacta

```
workspace-service/
├── app/
│   ├── api/
│   │   ├── routes.py          # endpoints FastAPI
│   │   ├── dependencies.py    # get_current_user, get_repository
│   │   └── schemas.py         # Pydantic request/response models (DTO)
│   ├── domain/
│   │   ├── workspace.py       # Workspace dataclass
│   │   ├── membership.py      # Membership dataclass + MembershipRole enum
│   │   ├── document_metadata.py  # DocumentMetadata dataclass
│   │   └── errors.py          # WorkspaceError, WorkspaceNotFound, etc.
│   ├── ports/
│   │   ├── workspace_repository.py    # ABC WorkspaceRepository
│   │   ├── membership_repository.py   # ABC MembershipRepository
│   │   ├── document_repository.py     # ABC DocumentRepository
│   │   └── token_verifier.py          # ABC TokenVerifier
│   ├── adapters/
│   │   ├── auth/
│   │   │   └── supabase_token_verifier.py  # SupabaseTokenVerifier impl
│   │   └── persistence/
│   │       └── in_memory_workspace.py  # InMemory*Repository impls
│   ├── use_cases/
│   │   ├── create_workspace.py
│   │   ├── list_workspaces.py
│   │   ├── get_workspace.py
│   │   ├── create_document.py
│   │   ├── list_documents.py
│   │   └── get_permissions.py
│   ├── config/
│   │   └── settings.py        # Pydantic Settings
│   └── main.py               # FastAPI app + router.include
├── tests/
├── Dockerfile
├── requirements.txt
└── pyproject.toml
```

**Nota sobre estructura existente:** El skeleton PM-01 ya tiene `config.py` en `app/` raíz. En PM-02 se mueve a `app/config/settings.py` para mantener la convención de la estructura propuesta. El archivo `app/config.py` existente se migra.

---

## 7. Contratos de API

### 7.1 GET /me

**Response 200:**
```json
{
  "user_id": "uuid-sub-from-jwt",
  "email": "user@example.com"
}
```

### 7.2 POST /workspaces

**Request:**
```json
{
  "name": "Mi Workspace"
}
```

**Response 201:**
```json
{
  "id": "uuid-generated",
  "name": "Mi Workspace",
  "owner_id": "user-sub",
  "created_at": "2026-04-24T12:00:00Z"
}
```

### 7.3 GET /workspaces

**Response 200:**
```json
{
  "workspaces": [
    {
      "id": "uuid",
      "name": "Mi Workspace",
      "owner_id": "user-sub",
      "created_at": "2026-04-24T12:00:00Z"
    }
  ]
}
```

### 7.4 GET /workspaces/{workspace_id}

**Response 200:**
```json
{
  "id": "uuid",
  "name": "Mi Workspace",
  "owner_id": "user-sub",
  "created_at": "2026-04-24T12:00:00Z",
  "updated_at": "2026-04-24T12:00:00Z"
}
```

**Response 404:**
```json
{"detail": "Workspace not found or access denied"}
```

### 7.5 POST /workspaces/{workspace_id}/documents

**Request:**
```json
{
  "title": "Mi Documento"
}
```

**Response 201:**
```json
{
  "id": "uuid-generated",
  "workspace_id": "workspace-uuid",
  "title": "Mi Documento",
  "created_by": "user-sub",
  "created_at": "2026-04-24T12:00:00Z"
}
```

**Response 404:**
```json
{"detail": "Workspace not found or access denied"}
```

### 7.6 GET /workspaces/{workspace_id}/documents

**Response 200:**
```json
{
  "documents": [
    {
      "id": "uuid",
      "workspace_id": "workspace-uuid",
      "title": "Mi Documento",
      "created_by": "user-sub",
      "created_at": "2026-04-24T12:00:00Z"
    }
  ]
}
```

### 7.7 GET /workspaces/{workspace_id}/permissions

**Response 200:**
```json
{
  "workspace_id": "uuid",
  "user_id": "user-sub",
  "role": "owner"
}
```

**Response 404:**
```json
{"detail": "Access denied"}
```

---

## 8. Validaciones esperadas (cuando se implemente)

```
# Build
docker compose build workspace-service  # debe pasar

# Start
docker compose up -d workspace-service
curl http://localhost:8001/health  # 200 OK

# Auth público
curl http://localhost:8001/api/workspaces/health  # 401 (Nginx)
curl http://localhost:8001/api/workspaces/health -H "X-Shared-Secret: changeme"  # 200 (Nginx sin auth)

# Auth JWT
curl http://localhost:8001/api/workspaces/me  # 401 (sin JWT)
curl -H "Authorization: Bearer invalid-token" http://localhost:8001/api/workspaces/me  # 401 (JWT inválido)

# Workspace CRUD
curl -X POST http://localhost/api/workspaces/workspaces \
  -H "Authorization: Bearer <valid-jwt>" \
  -H "X-Shared-Secret: changeme" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Workspace"}'  # 201

# Document CRUD
curl -X POST http://localhost/api/workspaces/workspaces/{id}/documents \
  -H "Authorization: Bearer <valid-jwt>" \
  -H "X-Shared-Secret: changeme" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Doc"}'  # 201

# Pyright
pyright apps/backend/workspace-service  # 0 errors
```

---

## 9. Riesgos

| ID | Descripción | Severidad | Mitigación |
|---|---|---|---|
| R1 | Supabase JWT mal validado — exp no verificada, issuer no checks | **CRÍTICO** | Implementar verificador completo con jose, verificar todos los claims |
| R2 | claims/audience/issuer incorrectos — servicio rechaza tokens válidos | **CRÍTICO** | Usar variables de entorno, no hardcodear, validar contra config real de Supabase |
| R3 | Acoplar dominio a DynamoDB antes de confirmación del profesor | **ALTO** | Usar adapter in-memory hasta tener respuesta; puertos ya definidos |
| R4 | Autorización metida en routers — lógica de negocio en endpoints | **ALTO** | Usar use_cases, routers solo reciben dependencies y delegan |
| R5 | Dependencia futura de Workspace — otros servicios leen DB directamente | **ALTO** | Documentar contrato interservicio, no implementar aún |
| R6 | Sin entorno local con token válido — no se puede probar JWT | **MEDIO** | Crear test con mock de token verifier; crear script que genere token válido para testing |
| R7 | Membership creada en in-memory se pierde al restart | **BAJA** | Aceptable para PM-02 demo; DynamoDB vendrá después |
| R8 | No validar que user tiene rol suficiente para operaciones | **MEDIO** | Implementar check de membership rol en use_cases |

---

## 10. Dependencias y orden de implementación

```
1. config/settings.py         — variables de entorno + pydantic
2. domain/*                   — entidades puras + errores
3. ports/*                    — interfaces abstractas
4. adapters/auth/*            — SupabaseTokenVerifier
5. adapters/persistence/*     — InMemory*Repository
6. use_cases/*                — lógica de negocio desacoplada
7. api/schemas.py             — Pydantic DTOs request/response
8. api/dependencies.py        — FastAPI dependencies
9. api/routes.py              — endpoints con use_cases
10. main.py                   —组装 app
```

---

## 11. Recomendación final

**PM-02 debe implementarse con adapter in-memory** por las siguientes razones:

1. **Duda de rúbrica pendiente**: hasta que el profesor responda, no sabemos si DynamoDB es aceptable
2. **Velocidad de iteración**: in-memory permite implementar lógica completa sin infraestructura
3. **Arquitectura limpia**: los puertos ya existen, el cambio a DynamoDB es替换透明
4. **Demo funcional**: con in-memory la demo funciona aunque el backend no esté en producción

**Cuando el profesor responda** sobre bases de datos:
- Si acepta ownership DynamoDB → agregar `DynamoDBWorkspaceRepository` implementando el puerto
- Si exige DB física → agregar `PostgreSQLWorkspaceRepository` implementando el puerto
- En ambos casos los use_cases NO cambian

**No esperar respuesta del profesor** para comenzar PM-02 porque:
- La duda de DB no afecta la implementación del dominio
- El adapter in-memory es temporal y reemplazable
- La estructura de puertos ya permite el reemplazo después

---

## 12. Preguntas abiertas

1. ¿El profesor ya respondió sobre bases de datos independientes?
2. ~~¿Se usará `SUPABASE_JWT_SECRET` (HS256) o JWKS URL para validación?~~ → **RESUELTO: JWKS/ES256**
3. ¿El `audience` claim es obligatorio para el proyecto o puede estar vacío? → **RESUELTO: `authenticated`**
4. ¿Hay un project ID específico de Supabase que debamos usar en configuración?

---

## 13. Confirmación

Este documento **NO implementa código**. Solo registra:
- Plan refinado para PM-02
- Estructura de archivos propuesta
- Contratos de API
- Riesgos y mitigaciones
- Recomendación de adapter in-memory

La implementación startará cuando este documento sea aprobado.