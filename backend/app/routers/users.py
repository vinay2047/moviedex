"""User routes — profile upsert."""

from fastapi import APIRouter

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import DbSession, AuthUserId
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me", response_model=dict)
async def get_or_create_user(
    db: DbSession,
    user_id: AuthUserId,
) -> dict:
    """
    Get the current user's profile. Creates the user row on first call (upsert).
    """
    user = await db.get(User, user_id)

    if user is None:
        user = User(id=user_id, onboarding_completed=False)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return {
        "data": UserResponse(
            id=user.id,
            onboarding_completed=user.onboarding_completed,
            has_embedding=user.embedding is not None,
            created_at=user.created_at,
        ).model_dump()
    }
