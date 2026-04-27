import uvicorn
from fastapi import FastAPI

from app.api.routes import router
from app.config.settings import Settings

settings = Settings()

app = FastAPI(title="planning-service")
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