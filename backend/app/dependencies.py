"""FastAPI dependency injection — database sessions and authenticated user."""

import uuid
from typing import Annotated, AsyncGenerator

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.middleware.auth import get_current_user_id, security


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session, auto-closing on request completion."""
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_authenticated_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> uuid.UUID:
    """Dependency that extracts and verifies the user UUID from the JWT."""
    return await get_current_user_id(credentials)


# ── Type aliases for cleaner route signatures ─────────────────────────────
DbSession = Annotated[AsyncSession, Depends(get_db)]
AuthUserId = Annotated[uuid.UUID, Depends(get_authenticated_user_id)]
