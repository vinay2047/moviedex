"""Profile routes — Dashboard stats."""

from fastapi import APIRouter
from sqlalchemy import select, func, distinct
from sqlalchemy.orm import aliased

from app.dependencies import DbSession, AuthUserId
from app.models.rating import Rating
from app.models.watch_history import WatchHistory
from app.models.movie import Movie

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


@router.get("/stats", response_model=dict)
async def get_profile_stats(db: DbSession, user_id: AuthUserId) -> dict:
    """Get dashboard stats for the user's profile."""
    # 1. Total Watched: count of distinct movies either in watch history (status=watched) or rated
    watched_q = select(WatchHistory.movie_id).where(
        WatchHistory.user_id == user_id, WatchHistory.status == "watched"
    )
    rated_q = select(Rating.movie_id).where(Rating.user_id == user_id)
    
    # Union of both subqueries to get distinct movie IDs
    union_q = watched_q.union(rated_q)
    total_watched_q = select(func.count()).select_from(union_q.subquery())
    total_watched = (await db.execute(total_watched_q)).scalar() or 0

    # 2. Average Rating
    avg_rating_q = select(func.avg(Rating.rating)).where(Rating.user_id == user_id)
    avg_rating = (await db.execute(avg_rating_q)).scalar()
    avg_rating = float(avg_rating) if avg_rating is not None else 0.0

    # 3. Rating Distribution
    # bucket by rating value, count occurrences, mapping to integers 1-5
    dist_q = (
        select(Rating.rating, func.count(Rating.id))
        .where(Rating.user_id == user_id)
        .group_by(Rating.rating)
    )
    dist_rows = (await db.execute(dist_q)).all()
    # Initialize integer buckets 1 to 5 with 0 count
    import math
    buckets = {i: 0 for i in range(1, 6)}
    for r, c in dist_rows:
        bucket_val = max(1, min(5, math.ceil(r)))
        buckets[bucket_val] += c
    
    rating_distribution = [{"rating": k, "count": v} for k, v in buckets.items()]

    # 4. Top Genres
    # For all movies rated by the user, compute average rating per genre
    # PostgreSQL JSONB array elements extraction requires lateral join or specialized functions
    # Using raw SQL string for simplicity in computing JSONB aggregate, or we can fetch in Python
    # Since genres are small, fetching all user ratings with movie genres and aggregating in Python is safest across dialects
    movies_rated_q = (
        select(Rating.rating, Movie.genres)
        .join(Movie, Rating.movie_id == Movie.id)
        .where(Rating.user_id == user_id)
    )
    movies_rated = (await db.execute(movies_rated_q)).all()

    genre_stats = {}
    for rating_val, genres_json in movies_rated:
        if genres_json:
            for genre in genres_json:
                g_name = genre["name"]
                if g_name not in genre_stats:
                    genre_stats[g_name] = {"sum": 0, "count": 0}
                genre_stats[g_name]["sum"] += rating_val
                genre_stats[g_name]["count"] += 1
    
    top_genres = []
    for g_name, stats in genre_stats.items():
        avg_r = stats["sum"] / stats["count"]
        top_genres.append({
            "genre": g_name,
            "avg_rating": avg_r,
            "count": stats["count"]
        })
    
    # Sort by avg_rating desc, then by count desc (tie-breaker)
    top_genres.sort(key=lambda x: (x["avg_rating"], x["count"]), reverse=True)
    # Take top 3
    top_genres = top_genres[:3]

    return {
        "data": {
            "total_watched": total_watched,
            "average_rating": round(avg_rating, 1),
            "rating_distribution": rating_distribution,
            "top_genres": [{"genre": g["genre"], "avg_rating": round(g["avg_rating"], 1), "count": g["count"]} for g in top_genres]
        }
    }
