"""Onboarding routes — quiz candidates and warm-start embedding computation."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import DbSession, AuthUserId
from app.models.movie import Movie
from app.models.user import User
from app.schemas.movie import MovieSummary
from app.schemas.recommendation import OnboardingRequest, OnboardingResponse
from app.services.onboarding import compute_warm_start_embedding

router = APIRouter(prefix="/api/v1/onboarding", tags=["onboarding"])


@router.get("/candidates", response_model=dict)
async def get_onboarding_candidates(
    db: DbSession,
    user_id: AuthUserId,
) -> dict:
    """
    Return ~50 popular, well-known movies for the onboarding quiz.

    Selection criteria: high vote count + high rating + has poster.
    """
    query = (
        select(Movie)
        .where(
            Movie.vote_count.isnot(None),
            Movie.vote_count >= 500,
            Movie.poster_path.isnot(None),
            Movie.vote_average.isnot(None),
            Movie.vote_average >= 7.0,
        )
        .order_by(Movie.vote_count.desc())
        .limit(50)
    )
    result = await db.execute(query)
    movies = result.scalars().all()

    return {
        "data": [MovieSummary.model_validate(m).model_dump() for m in movies]
    }


@router.post("/complete", response_model=dict)
async def complete_onboarding(
    db: DbSession,
    user_id: AuthUserId,
    body: OnboardingRequest,
) -> dict:
    """
    Submit 3-5 movie selections to compute the warm-start user embedding.

    Backend logic:
    1. Fetch item embeddings for selected movies.
    2. Average them.
    3. L2-normalize.
    4. Store as user embedding; mark onboarding complete.
    """
    # Check if already onboarded
    user = await db.get(User, user_id)
    if user is not None and user.onboarding_completed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Onboarding already completed.",
        )

    success = await compute_warm_start_embedding(db, user_id, body.movie_ids)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not compute embedding. Ensure valid movie IDs (minimum 5).",
        )

    return {
        "data": OnboardingResponse(
            onboarding_completed=True,
            message=f"Embedding computed from {len(body.movie_ids)} selections.",
        ).model_dump()
    }
