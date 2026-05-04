import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.api.routes import router
from app.api.dependencies import ensure_workspace_db_initialized
from app.config.settings import Settings

settings = Settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_workspace_db_initialized()
    yield


app = FastAPI(title="workspace-service", lifespan=lifespan)
app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "workspace-service"}


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "workspace-service"}


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.SERVICE_PORT,
        reload=False,
    )
