import jwt
from jwt import PyJWKClient, PyJWKClientError, ExpiredSignatureError, InvalidTokenError

from app.domain.errors import Unauthorized, AuthServiceUnavailable
from app.ports.token_verifier import TokenVerifier, TokenPayload


class SupabaseJWKSVerifier(TokenVerifier):
    def __init__(self, jwks_url: str, issuer: str, audience: str):
        self._jwks_client = PyJWKClient(jwks_url)
        self.issuer = issuer
        self.audience = audience

    def verify(self, token: str) -> TokenPayload:
        try:
            signing_key = self._jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                issuer=self.issuer,
                audience=self.audience,
            )
            return TokenPayload(**payload)
        except PyJWKClientError as e:
            raise AuthServiceUnavailable(f"JWKS error: {e}")
        except ExpiredSignatureError:
            raise Unauthorized("Token expired")
        except InvalidTokenError as e:
            raise Unauthorized(f"Token inválido: {e}")
