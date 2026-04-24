from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SERVICE_PORT: int = 8003
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "local"
    SHARED_SECRET: str = "changeme"

    class Config:
        env_file = ".env"
        case_sensitive = True
