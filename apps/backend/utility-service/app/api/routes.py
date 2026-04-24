from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "service": "utility-service"}


@router.get("/healthz")
def healthz():
    return {"status": "ok", "service": "utility-service"}
