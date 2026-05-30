"""Watch history routes — CRUD for implicit consumption signals."""

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.dependencies import DbSession, AuthUserId
from app.models.watch_history import WatchHistory
from app.models.movie import Movie
from app.schemas.movie import MovieSummary
from app.schemas.recommendation import WatchHistoryCreate

router = APIRouter(prefix="/api/v1/watch-history", tags=["watch-history"])


@router.get("", response_model=dict)
async def get_watch_history(
    db: DbSession,
    user_id: AuthUserId,
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> dict:
    """Get the authenticated user's watch history, most recent first."""
    count_q = select(func.count(WatchHistory.id)).where(WatchHistory.user_id == user_id)
    if status_filter:
        count_q = count_q.where(WatchHistory.status == status_filter)
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        select(Movie)
        .join(WatchHistory, WatchHistory.movie_id == Movie.id)
        .where(WatchHistory.user_id == user_id)
    )
    if status_filter:
        query = query.where(WatchHistory.status == status_filter)
        
    query = query.order_by(WatchHistory.watched_at.desc()).limit(limit).offset(offset)
    
    result = await db.execute(query)
    movies = result.scalars().all()

    return {
        "data": [MovieSummary.model_validate(m).model_dump() for m in movies],
        "pagination": {"limit": limit, "offset": offset, "total": total},
    }


@router.post("", response_model=dict, status_code=status.HTTP_200_OK)
async def add_to_watch_history(
    db: DbSession,
    user_id: AuthUserId,
    body: WatchHistoryCreate,
) -> dict:
    """Add a movie to the user's watch history (upsert — updates watched_at on re-watch)."""
    movie = await db.get(Movie, body.movie_id)
    if movie is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movie not found.",
        )

    stmt = pg_insert(WatchHistory).values(
        user_id=user_id,
        movie_id=body.movie_id,
        status=body.status,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_watch_history_user_movie",
        set_={"watched_at": func.now(), "status": body.status},
    )
    await db.execute(stmt)
    await db.commit()

    return {"data": {"movie_id": body.movie_id, "status": body.status}}


@router.delete("/{movie_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watch_history(
    db: DbSession,
    user_id: AuthUserId,
    movie_id: int,
) -> None:
    """Remove a movie from the user's watch history."""
    result = await db.execute(
        delete(WatchHistory).where(
            WatchHistory.user_id == user_id,
            WatchHistory.movie_id == movie_id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movie not in watch history.",
        )
    await db.commit()
