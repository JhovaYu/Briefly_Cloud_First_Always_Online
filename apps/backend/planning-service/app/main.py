import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from app.api.routes import router
from app.config.settings import Settings

logger = logging.getLogger(__name__)

settings = Settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize postgres engine on startup if using postgres store
    if settings.PLANNING_STORE_TYPE == "postgres":
        from app.adapters.persistence.sqlalchemy.database import create_async_engine_if_not_exists, dispose_engine

        try:
            create_async_engine_if_not_exists(settings)
            logger.info("Postgres engine initialized for planning-service")
        except ValueError as ve:
            logger.error(f"Failed to initialize postgres engine: {ve}")
            raise
    yield
    # Dispose engine on shutdown
    if settings.PLANNING_STORE_TYPE == "postgres":
        from app.adapters.persistence.sqlalchemy.database import dispose_engine

        await dispose_engine()
        logger.info("Postgres engine disposed")


app = FastAPI(title="planning-service", lifespan=lifespan)
app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "planning-service"}


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "planning-service"}


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.SERVICE_PORT,
        reload=False,
    )