from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    SERVICE_PORT: int = 8002
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "local"
    SHARED_SECRET: str = "changeme"
    WORKSPACE_SERVICE_URL: str = "http://workspace-service:8001"
    WORKSPACE_PERMISSION_TIMEOUT_SECONDS: float = 3.0
    COLLAB_AUTH_TIMEOUT_SECONDS: float = 5.0
    ENABLE_EXPERIMENTAL_CRDT_ENDPOINT: bool = False
    TICKET_TTL_SECONDS: int = 60
    DOCUMENT_STORE_TYPE: str = "memory"  # "memory" | "local" | "disabled"
    DOCUMENT_STORE_PATH: str = ".data/collab-snapshots"
    MAX_SNAPSHOT_BYTES: int = 52_428_800  # 50 MB
