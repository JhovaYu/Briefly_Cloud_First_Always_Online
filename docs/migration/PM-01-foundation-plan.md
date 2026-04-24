# PM-01 — Foundation Local Backend (Plan Refinado)

## 1. Objetivo del slice

Establecer la infraestructura local de los 5 microservicios FastAPI (workspace, collaboration, planning, intelligence, utility) con Docker Compose y Nginx reverse proxy. Ningún servicio implementa lógica de negocio. Cada skeleton responde `/health` y permite検証 de `X-Shared-Secret` solo a nivel Nginx (FastAPI no valida en PM-01).

## 2. Estructura final a crear

```
apps/backend/
  workspace-service/
    app/
      __init__.py
      main.py
      config.py
      api/
        __init__.py
        routes.py
      domain/
        __init__.py
      ports/
        __init__.py
      adapters/
        __init__.py
      use_cases/
        __init__.py
    tests/
    Dockerfile
    requirements.txt
    pyproject.toml
  collaboration-service/
  planning-service/
  intelligence-service/
  utility-service/
.env.example
docker-compose.yml
pyrightconfig.json
```

**infra/nginx/** se crea como carpeta hermanos de `apps/backend/` a nivel de raíz.

## 3. Servicios incluidos

**workspace-service** — gestión de espacios de trabajo y pools de notas.
**collaboration-service** — sincronización colaborativa via WebSocket (skeleton sin pycrdt-websocket en PM-01).
**planning-service** — gestión de tareas y scheduling.
**intelligence-service** — resúmenes y procesamiento inteligente (Gemini pospuesto).
**utility-service** — QR, preview, estadísticas textuales.

## 4. Componentes de infraestructura local

**Docker Compose**
5 contenedores Python 3.12-slim + 1 Nginx. Límites de memoria:
- workspace-service: 128m
- collaboration-service: 384m
- planning-service: 128m
- intelligence-service: 128m
- utility-service: 256m
- nginx: 64m

**Nginx**
Reverse proxy interno en puerto 80. Strip de prefijo antes de reenviar. WebSocket en `/collab/`. Middleware `X-Shared-Secret` en todas las rutas proxied excepto `/health` y `/healthz`.

Rutas:
- `/api/workspaces/*` → workspace-service:8001
- `/collab/*` → collaboration-service:8002
- `/api/planning/*` → planning-service:8003
- `/api/intelligence/*` → intelligence-service:8004
- `/api/utility/*` → utility-service:8005

**Variables de entorno**
- `SHARED_SECRET` — clave compartida entre servicios
- `SERVICE_PORT` — puerto interno de cada servicio
- `LOG_LEVEL` — default INFO
- `ENVIRONMENT` — local | development | production

## 5. Decisiones clave (validación obligatoria)

**Ubicación**: `apps/backend/` — el glob `apps/*` de npm workspaces no captura subdirectorios; verificar antes de crear.
**Estructura hexagonal**: cada servicio tiene `domain/`, `ports/`, `adapters/`, `use_cases/`, `api/`; `use_cases/` permanece vacío en PM-01.
**Frontera X-Shared-Secret**: Nginx valida el header en todas las rutas proxied. Los servicios FastAPI NO validan `X-Shared-Secret` en PM-01. `/health` y `/healthz` quedan exentos del middleware para no bloquear Docker healthchecks.
**Estrategia routing**: Nginx usa `rewrite` con strip para eliminar el prefijo antes de reenviar. Cada servicio escucha en su puerto interno sin prefijo en la ruta.
**Soporte WebSocket**: `/collab/` configurado con `proxy_http_version 1.1`, `proxy_read_timeout 86400`, `proxy_set_header Upgrade $http_upgrade` y `proxy_set_header Connection "upgrade"`.

## 6. Riesgos técnicos reales

1. **NPM workspaces captura Python**: `apps/*` en workspaces podría incluir `apps/backend` si existe algún archivo con extensión reconocida por npm; verificar tras creación.
2. **pycrdt / Python 3.12**: compatibilidad real de pycrdt-websocket con Python 3.12 no confirmada documentalmente a fecha de PM-01; diferir validación a PM-03 usando context7 y documentación oficial.
3. **Strip de prefijos en Nginx**: rewrite incorrecto causa 404 en los endpoints FastAPI.
4. **X-Shared-Secret bloquea health probes**: si la excepción no cubre todas las variantes de healthcheck (`/health`, `/healthz`), Docker marca contenedores como unhealthy.
5. **Pyright en Windows**: rutas POSIX en `pythonpath` pueden fallar; usar paths absolutos o configuración por servicio.

## 7. Criterios de aceptación

- `docker compose -f docker-compose.yml build` termina sin error.
- `docker compose -f docker-compose.yml up -d` levanta 5 servicios + nginx.
- `curl http://localhost:8001/health` retorna HTTP 200 en cada servicio (acceso directo).
- `curl http://localhost/api/workspaces/health` retorna HTTP 200 a través de Nginx.
- `curl -H "X-Shared-Secret: wrong" http://localhost/api/workspaces/health` retorna 401.
- `curl -H "X-Shared-Secret: $SHARED_SECRET" http://localhost/api/workspaces/health` retorna 200.
- `curl http://localhost/collab/` retorna HTTP 200 (collaboration-service skeleton responde).
- `pyright --version` corre sin errores. `pyright apps/backend/` retorna 0 errores de tipo en skeletons.
- Nginx enruta cada prefijo al servicio correcto (verificable con curl).

## 8. Qué NO se hará en este slice

- Supabase JWT, DynamoDB, S3
- Gemini AI
- pycrdt ni pycrdt-websocket
- Frontend / Electron
- Infraestructura AWS
- Playwright
- Lógica de negocio real
- Tests unitarios

## 9. Plan de ejecución

1. Crear `apps/backend/` con carpeta de cada servicio.
2. Crear `requirements.txt` y `pyproject.toml` para cada servicio.
3. Crear `config.py` con `pydantic-settings` en cada servicio.
4. Crear `app/main.py` con FastAPI + `/health` y `/healthz` en cada servicio.
5. Crear `app/api/routes.py` con router básico en cada servicio.
6. Crear `Dockerfile` (Python 3.12-slim) para cada servicio.
7. Crear `docker-compose.yml` con los 5 servicios, nginx, networks y límites de memoria corregidos.
8. Crear `infra/nginx/nginx.conf` con routing, strip prefixes, WebSocket y middleware X-Shared-Secret.
9. Crear `.env.example` con todas las variables.
10. Crear `pyrightconfig.json` en raíz.
11. Validar: `docker compose config`, `docker compose build`, `docker compose up -d`.
12. Validar healthchecks, routing y auth header con curl.
13. Actualizar CLAUDE.md con la sección backend.
