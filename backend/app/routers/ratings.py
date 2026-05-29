"""Rating routes — CRUD for explicit user ratings."""

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import delete, select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.dependencies import DbSession, AuthUserId
from app.models.rating import Rating
from app.models.movie import Movie
from app.schemas.rating import RatingCreate, RatingResponse, RatingWithMovie

router = APIRouter(prefix="/api/v1/ratings", tags=["ratings"])


@router.get("", response_model=dict)
async def get_user_ratings(
    db: DbSession,
    user_id: AuthUserId,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> dict:
    """Get all ratings for the authenticated user, joined with movie metadata."""
    count_q = select(func.count(Rating.id)).where(Rating.user_id == user_id)
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        select(
            Rating.movie_id,
            Movie.title,
            Movie.poster_path,
            Rating.rating,
            Rating.updated_at,
        )
        .join(Movie, Rating.movie_id == Movie.id)
        .where(Rating.user_id == user_id)
        .order_by(Rating.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    rows = result.all()

    data = [
        RatingWithMovie(
            movie_id=row.movie_id,
            title=row.title,
            poster_path=row.poster_path,
            rating=row.rating,
            updated_at=row.updated_at,
        ).model_dump()
        for row in rows
    ]

    return {
        "data": data,
        "pagination": {"limit": limit, "offset": offset, "total": total},
    }


@router.post("", response_model=dict, status_code=status.HTTP_200_OK)
async def upsert_rating(
    db: DbSession,
    user_id: AuthUserId,
    body: RatingCreate,
) -> dict:
    """Create or update a rating for a movie (upsert on user_id + movie_id)."""
    # Verify movie exists
    movie = await db.get(Movie, body.movie_id)
    if movie is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movie not found.",
        )

    stmt = pg_insert(Rating).values(
        user_id=user_id,
        movie_id=body.movie_id,
        rating=body.rating,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_ratings_user_movie",
        set_={"rating": stmt.excluded.rating, "updated_at": func.now()},
    )
    await db.execute(stmt)
    await db.commit()

    # Fetch the upserted row
    result = await db.execute(
        select(Rating).where(
            Rating.user_id == user_id,
            Rating.movie_id == body.movie_id,
        )
    )
    rating = result.scalar_one()

    return {
        "data": RatingResponse(
            movie_id=rating.movie_id,
            rating=rating.rating,
            updated_at=rating.updated_at,
        ).model_dump()
    }


@router.delete("/{movie_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rating(
    db: DbSession,
    user_id: AuthUserId,
    movie_id: int,
) -> None:
    """Delete a user's rating for a specific movie."""
    result = await db.execute(
        delete(Rating).where(
            Rating.user_id == user_id,
            Rating.movie_id == movie_id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rating not found.",
        )
    await db.commit()
