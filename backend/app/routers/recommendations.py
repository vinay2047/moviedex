"""Recommendation routes — two-stage retrieval + ranking pipeline.

Replaces the legacy single-stage pgvector recommendation service.
API contract (request/response shapes) is fully backward-compatible.
"""

from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import DbSession, AuthUserId, Pipeline
from app.models.user import User

router = APIRouter(prefix="/api/v1/recommendations", tags=["recommendations"])


@router.get("", response_model=dict)
async def personalized_recommendations(
    db: DbSession,
    user_id: AuthUserId,
    pipeline: Pipeline,
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    genre_id: int | None = Query(None, description="Filter by genre ID"),
    min_year: int | None = Query(None, description="Filter by min release year"),
    max_year: int | None = Query(None, description="Filter by max release year"),
    min_rating: float | None = Query(None, description="Filter by minimum rating"),
    sort_by: str | None = Query(None, description="Sort order: vote_average_desc, release_date_desc"),
) -> dict:
    """Get personalized top-K movie recommendations for the authenticated user.

    Pipeline stages:
      1. Two-Tower user embedding lookup (or warm-start fallback)
      2. pgvector ANN retrieval → top-K candidates
      3. NeuMF ONNX re-ranking → final scores
      4. Sort, paginate, return
    """
    # Guard: onboarding must be completed
    user = await db.get(User, user_id)
    if user is None or not user.onboarding_completed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Onboarding not completed. Please select movies first.",
        )

    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommendation models are not loaded. Please try again later.",
        )

    try:
        recommendations, total, diagnostics = await pipeline.recommend_for_user(
            db,
            user_id,
            limit=limit,
            offset=offset,
            genre_id=genre_id,
            min_year=min_year,
            max_year=max_year,
            min_rating=min_rating,
            sort_by=sort_by,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Recommendation inference failed.",
        )

    return {
        "data": recommendations,
        "pagination": {"limit": limit, "offset": offset, "total": total},
        "diagnostics": diagnostics,
    }


@router.get("/similar/{movie_id}", response_model=dict)
async def similar_movies(
    db: DbSession,
    movie_id: int,
    user_id: AuthUserId,
    pipeline: Pipeline,
    limit: int = Query(10, ge=1, le=30),
) -> dict:
    """Get movies similar to a given movie using item-item embedding similarity."""
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommendation models are not loaded. Please try again later.",
        )

    try:
        results = await pipeline.find_similar_movies(db, movie_id, limit=limit)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Similar movie inference failed.",
        )

    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movie not found.",
        )

    return {"data": results}
