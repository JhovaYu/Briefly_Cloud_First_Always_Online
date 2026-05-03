from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    SERVICE_PORT: int = 8006
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "local"
    SHARED_SECRET: str = "changeme"

    # Supabase Auth — JWKS/ES256
    SUPABASE_URL: str = "https://gcbwysprkqsfakaqsara.supabase.co"
    SUPABASE_JWT_ISSUER: str = "https://gcbwysprkqsfakaqsara.supabase.co/auth/v1"
    SUPABASE_JWT_AUDIENCE: str = "authenticated"
    SUPABASE_AUTH_STRATEGY: str = "jwks"
    SUPABASE_JWKS_URL: str = "https://gcbwysprkqsfakaqsara.supabase.co/auth/v1/.well-known/jwks.json"

    # Workspace service (for remote authorization)
    WORKSPACE_SERVICE_URL: str = "http://workspace-service:8001"

    # Persistence store type: "inmemory" | "postgres"
    SCHEDULE_STORE_TYPE: str = "inmemory"
    # Only required when SCHEDULE_STORE_TYPE=postgres
    # Format: postgresql+asyncpg://user:password@host:port/dbname
    SCHEDULE_DATABASE_URL: str | None = None