"""Supabase JWT verification middleware for FastAPI."""

import uuid
from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

security = HTTPBearer(auto_error=False)

# ── JWKS client for ES256 tokens ─────────────────────────────────
# Supabase newer projects sign JWTs with ES256 (asymmetric).
# We fetch the public key from the project's JWKS endpoint and cache it.
_jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
_jwks_client = PyJWKClient(_jwks_url, cache_keys=True)


def verify_supabase_jwt(token: str) -> dict:
    """
    Decode and verify a Supabase-issued JWT.

    Supports both:
      - ES256 (newer projects) — verified via JWKS public key
      - HS256 (legacy projects) — verified via JWT secret

    Returns the decoded payload on success.
    Raises HTTPException on any verification failure.
    """
    try:
        # Peek at the token header to determine the algorithm
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "")

        if alg == "ES256":
            # ── ES256: fetch the matching public key from JWKS ──
            signing_key = _jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
            )
        else:
            # ── HS256 / legacy: use the shared secret ──
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )

        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
        )
    except jwt.InvalidAudienceError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token audience.",
        )
    except jwt.DecodeError as e:
        print(f"JWT DECODE ERROR: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
        )
    except jwt.PyJWTError as e:
        print(f"JWT VERIFICATION ERROR: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {e}",
        )
    except Exception as e:
        # Catch-all for JWKS fetch errors, network issues, etc.
        print(f"JWT UNEXPECTED ERROR: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed.",
        )


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials],
) -> uuid.UUID:
    """
    Extract and validate the user UUID from a Supabase JWT.

    Used as a FastAPI dependency in protected routes.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header.",
        )

    payload = verify_supabase_jwt(credentials.credentials)
    sub = payload.get("sub")

    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim.",
        )

    try:
        return uuid.UUID(sub)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token.",
        )
