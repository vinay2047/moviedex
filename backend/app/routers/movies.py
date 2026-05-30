"""Movie routes — search, detail, popular, genres."""

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import DbSession, AuthUserId
from app.models.movie import Movie
from app.models.rating import Rating
from app.models.watch_history import WatchHistory
from app.schemas.movie import MovieDetail, MovieSummary

router = APIRouter(prefix="/api/v1/movies", tags=["movies"])


@router.get("/search", response_model=dict)
async def search_movies(
    db: DbSession,
    q: str = Query(..., min_length=1, max_length=200, description="Search query"),
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
) -> dict:
    """Search movies by title using ILIKE against the local database."""
    pattern = f"%{q}%"

    # Count total matches
    count_query = select(func.count(Movie.id)).where(Movie.title.ilike(pattern))
    total = (await db.execute(count_query)).scalar() or 0

    # Fetch page
    query = (
        select(Movie)
        .where(Movie.title.ilike(pattern))
        .order_by(Movie.vote_average.desc().nullslast())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    movies = result.scalars().all()

    return {
        "data": [MovieSummary.model_validate(m).model_dump() for m in movies],
        "pagination": {"limit": limit, "offset": offset, "total": total},
    }


from sqlalchemy import extract

@router.get("/popular", response_model=dict)
async def get_popular_movies(
    db: DbSession,
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    genre_id: int | None = Query(None, description="Filter by genre ID"),
    min_year: int | None = Query(None, description="Filter by min release year"),
    max_year: int | None = Query(None, description="Filter by max release year"),
    min_rating: float | None = Query(None, description="Filter by minimum rating"),
    sort_by: str | None = Query(None, description="Sort order: vote_average_desc, release_date_desc")
) -> dict:
    """Get popular movies ordered by TMDB vote average (with vote count threshold)."""
    # Require at least 50 votes to avoid obscure high-rated movies
    vote_threshold = 50

    conditions = [
        Movie.vote_count.isnot(None),
        Movie.vote_count >= vote_threshold,
    ]

    if genre_id is not None:
        conditions.append(Movie.genres.contains([{"id": genre_id}]))
    if min_year is not None:
        conditions.append(extract('year', Movie.release_date) >= min_year)
    if max_year is not None:
        conditions.append(extract('year', Movie.release_date) <= max_year)
    if min_rating is not None:
        conditions.append(Movie.vote_average >= min_rating)

    count_query = select(func.count(Movie.id)).where(*conditions)
    total = (await db.execute(count_query)).scalar() or 0

    order_col = Movie.vote_average.desc().nullslast()
    if sort_by == "release_date_desc":
        order_col = Movie.release_date.desc().nullslast()

    query = (
        select(Movie)
        .where(*conditions)
        .order_by(order_col)
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    movies = result.scalars().all()

    return {
        "data": [MovieSummary.model_validate(m).model_dump() for m in movies],
        "pagination": {"limit": limit, "offset": offset, "total": total},
    }


@router.get("/genres", response_model=dict)
async def get_genres(db: DbSession) -> dict:
    """Return distinct genres from the database."""
    result = await db.execute(
        select(Movie.genres).where(Movie.genres.isnot(None))
    )
    rows = result.scalars().all()

    # Flatten and deduplicate
    seen: dict[int, str] = {}
    for genre_list in rows:
        if isinstance(genre_list, list):
            for g in genre_list:
                if isinstance(g, dict) and "id" in g and "name" in g:
                    seen[g["id"]] = g["name"]

    genres = [{"id": gid, "name": gname} for gid, gname in sorted(seen.items(), key=lambda x: x[1])]
    return {"data": genres}


@router.get("/{movie_id}", response_model=dict)
async def get_movie_detail(
    db: DbSession,
    movie_id: int,
    user_id: AuthUserId,
) -> dict:
    """Get full movie detail with user-specific rating and watch history status."""
    movie = await db.get(Movie, movie_id)
    if movie is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")

    # Check user's rating
    rating_result = await db.execute(
        select(Rating.rating).where(
            Rating.user_id == user_id,
            Rating.movie_id == movie_id,
        )
    )
    user_rating = rating_result.scalar_one_or_none()

    # Check watch history status
    watch_result = await db.execute(
        select(WatchHistory.status).where(
            WatchHistory.user_id == user_id,
            WatchHistory.movie_id == movie_id,
        )
    )
    watch_status = watch_result.scalar_one_or_none()

    detail = MovieDetail.model_validate(movie)
    detail.user_rating = user_rating
    detail.watch_status = watch_status

    return {"data": detail.model_dump()}
