import uvicorn
from fastapi import FastAPI

from app.api.routes import router

app = FastAPI(title="utility-service")
app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "utility-service"}


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "utility-service"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8005, reload=False)
