"""Recommendation service — pgvector similarity queries."""

import math
import uuid
from typing import Sequence

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.movie import Movie
from app.models.user import User
from app.models.rating import Rating
from app.models.watch_history import WatchHistory


def _sigmoid(x: float, temperature: float = 10.0) -> float:
    """Sigmoid with temperature scaling: maps any real number to (0, 1).

    Temperature controls the spread — higher values produce a wider range
    of outputs instead of saturating near 0 or 1.
    """
    return 1.0 / (1.0 + math.exp(-x / temperature))


from sqlalchemy import extract

async def get_personalized_recommendations(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
    genre_id: int | None = None,
    min_year: int | None = None,
    max_year: int | None = None,
    min_rating: float | None = None,
    sort_by: str | None = None,
) -> tuple[list[dict], int]:
    """
    Retrieve top-K personalized recommendations for a user via pgvector.

    Uses the negative inner product operator (<#>) for maximum dot-product
    similarity.  Raw dot-product scores are passed through sigmoid to produce
    a bounded (0, 1) match score.
    Excludes movies the user has already rated or watched.

    Returns (list_of_movie_dicts_with_score, total_count).
    """
    # 1. Fetch user embedding
    user = await db.get(User, user_id)
    if user is None or user.embedding is None:
        return [], 0

    user_emb = user.embedding

    # 2. Get IDs of movies already rated or watched (to exclude)
    rated_subq = select(Rating.movie_id).where(Rating.user_id == user_id)
    watched_subq = select(WatchHistory.movie_id).where(WatchHistory.user_id == user_id)

    # 3. Base conditions
    conditions = [
        Movie.id.notin_(rated_subq),
        Movie.id.notin_(watched_subq),
    ]

    if genre_id is not None:
        conditions.append(Movie.genres.contains([{"id": genre_id}]))
    if min_year is not None:
        conditions.append(extract('year', Movie.release_date) >= min_year)
    if max_year is not None:
        conditions.append(extract('year', Movie.release_date) <= max_year)
    if min_rating is not None:
        conditions.append(Movie.vote_average >= min_rating)

    # 4. If sort_by is provided, we fetch a larger candidate pool (e.g. 100), sort them in Python
    fetch_limit = limit
    if sort_by:
        fetch_limit = 100
        offset = 0  # Re-sorting requires fetching the top 100 from offset 0

    # 5. pgvector ANN query with inner product
    query = (
        select(
            Movie.id,
            Movie.title,
            Movie.poster_path,
            Movie.genres,
            Movie.vote_average,
            Movie.release_date,
            (Movie.embedding.max_inner_product(user_emb)).label("neg_score"),
        )
        .where(*conditions)
        .order_by(text("neg_score ASC"))
        .limit(fetch_limit)
        .offset(offset)
    )

    result = await db.execute(query)
    rows = result.all()

    recommendations = []
    for row in rows:
        dot_product = -row.neg_score  # negate to get actual inner product
        recommendations.append({
            "id": row.id,
            "title": row.title,
            "poster_path": row.poster_path,
            "genres": row.genres,
            "vote_average": row.vote_average,
            "release_date": row.release_date,
            "score": round(_sigmoid(dot_product), 4),
        })

    if sort_by == "release_date_desc":
        recommendations.sort(key=lambda x: str(x["release_date"] or ""), reverse=True)
    elif sort_by == "vote_average_desc":
        recommendations.sort(key=lambda x: x["vote_average"] or 0.0, reverse=True)

    if sort_by:
        recommendations = recommendations[:limit]

    return recommendations, len(recommendations)


async def get_similar_movies(
    db: AsyncSession,
    movie_id: int,
    limit: int = 10,
) -> list[dict]:
    """
    Retrieve movies similar to a given movie via item-item embedding similarity.

    Uses pgvector's negative inner product operator (<#>).
    Raw scores are passed through sigmoid for a (0, 1) match score.
    """
    # 1. Fetch source movie embedding
    movie = await db.get(Movie, movie_id)
    if movie is None:
        return []

    source_emb = movie.embedding

    # 2. pgvector ANN query with inner product
    query = (
        select(
            Movie.id,
            Movie.title,
            Movie.poster_path,
            Movie.genres,
            Movie.vote_average,
            Movie.release_date,
            (Movie.embedding.max_inner_product(source_emb)).label("neg_score"),
        )
        .where(Movie.id != movie_id)
        .order_by(text("neg_score ASC"))
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": row.id,
            "title": row.title,
            "poster_path": row.poster_path,
            "genres": row.genres,
            "vote_average": row.vote_average,
            "release_date": row.release_date,
            "score": round(_sigmoid(-row.neg_score, temperature=250.0), 4),
        }
        for row in rows
    ]
