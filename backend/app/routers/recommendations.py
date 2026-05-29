"""Recommendation routes — personalized and item-item similarity."""

from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import DbSession, AuthUserId
from app.models.user import User
from app.services.recommendation import get_personalized_recommendations, get_similar_movies

router = APIRouter(prefix="/api/v1/recommendations", tags=["recommendations"])


@router.get("", response_model=dict)
async def personalized_recommendations(
    db: DbSession,
    user_id: AuthUserId,
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
) -> dict:
    """Get personalized top-K movie recommendations for the authenticated user."""
    # Check onboarding status
    user = await db.get(User, user_id)
    if user is None or not user.onboarding_completed or user.embedding is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Onboarding not completed. Please select movies first.",
        )

    recommendations, total = await get_personalized_recommendations(
        db, user_id, limit, offset
    )

    return {
        "data": recommendations,
        "pagination": {"limit": limit, "offset": offset, "total": total},
    }


@router.get("/similar/{movie_id}", response_model=dict)
async def similar_movies(
    db: DbSession,
    movie_id: int,
    user_id: AuthUserId,
    limit: int = Query(10, ge=1, le=30),
) -> dict:
    """Get movies similar to a given movie using item-item embedding similarity."""
    results = await get_similar_movies(db, movie_id, limit)

    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movie not found.",
        )

    return {"data": results}
