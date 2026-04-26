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
    DOCUMENT_STORE_TYPE: str = "memory"  # "memory" | "local" | "s3" | "disabled"
    DOCUMENT_STORE_PATH: str = ".data/collab-snapshots"
    AWS_S3_BUCKET_NAME: str = ""
    AWS_REGION: str = "us-east-1"
    AWS_ENDPOINT_URL: str = ""  # Optional: for moto tests or S3-compatible storage
    MAX_SNAPSHOT_BYTES: int = 52_428_800  # 50 MB
    DOCUMENT_SNAPSHOT_INTERVAL_SECONDS: float = 30.0
    DOCUMENT_EMPTY_ROOM_GRACE_SECONDS: float = 5.0
    DOCUMENT_PERIODIC_SNAPSHOT_ENABLED: bool = False
