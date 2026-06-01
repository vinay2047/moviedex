"""FastAPI dependency injection — database sessions, authenticated user, and ML pipeline."""

import uuid
from typing import Annotated, AsyncGenerator, TYPE_CHECKING

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.middleware.auth import get_current_user_id, security

if TYPE_CHECKING:
    from app.services.pipeline import RecommendationPipeline


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


def get_pipeline(request: Request) -> "RecommendationPipeline":
    """Extract the recommendation pipeline singleton from application state."""
    return request.app.state.pipeline


# ── Type aliases for cleaner route signatures ─────────────────────────────
DbSession = Annotated[AsyncSession, Depends(get_db)]
AuthUserId = Annotated[uuid.UUID, Depends(get_authenticated_user_id)]
Pipeline = Annotated["RecommendationPipeline", Depends(get_pipeline)]
