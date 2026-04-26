from abc import ABC, abstractmethod
from pydantic import BaseModel


class TokenPayload(BaseModel):
    sub: str
    email: str | None = None
    exp: int
    iss: str
    aud: str | list[str] | None = None


class TokenVerifier(ABC):
    @abstractmethod
    def verify(self, token: str) -> TokenPayload: ...
