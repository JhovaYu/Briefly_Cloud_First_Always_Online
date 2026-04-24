import uvicorn
from fastapi import FastAPI

from app.api.routes import router

app = FastAPI(title="workspace-service")
app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "workspace-service"}


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "workspace-service"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=False)
