from fastapi import APIRouter

router = APIRouter(prefix="/collab")


@router.get("/health")
def collab_health():
    return {"status": "ok", "service": "collaboration-service"}


@router.get("/healthz")
def collab_healthz():
    return {"status": "ok", "service": "collaboration-service"}
