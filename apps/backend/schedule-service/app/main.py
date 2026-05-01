import logging

import uvicorn
from fastapi import FastAPI

from app.api.routes import router
from app.config.settings import Settings

logger = logging.getLogger(__name__)

settings = Settings()

app = FastAPI(title="schedule-service")
app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "schedule-service"}


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "schedule-service"}


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.SERVICE_PORT,
        reload=False,
    )