from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    SERVICE_PORT: int = 8001
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "local"
    SHARED_SECRET: str = "changeme"

    # Supabase Auth — JWKS/ES256
    SUPABASE_URL: str = "https://gcbwysprkqsfakaqsara.supabase.co"
    SUPABASE_JWT_ISSUER: str = "https://gcbwysprkqsfakaqsara.supabase.co/auth/v1"
    SUPABASE_JWT_AUDIENCE: str = "authenticated"
    SUPABASE_AUTH_STRATEGY: str = "jwks"
    SUPABASE_JWKS_URL: str = "https://gcbwysprkqsfakaqsara.supabase.co/auth/v1/.well-known/jwks.json"
