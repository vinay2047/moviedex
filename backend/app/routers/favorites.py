"""Favorites routes — Top 5 favorite movies for a user."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.dependencies import DbSession, AuthUserId
from app.models.favorite import Favorite
from app.models.movie import Movie
from app.schemas.favorite import FavoriteCreate, FavoriteResponse, FavoriteWithMovie

router = APIRouter(prefix="/api/v1/favorites", tags=["favorites"])


@router.get("", response_model=dict)
async def get_favorites(db: DbSession, user_id: AuthUserId) -> dict:
    """Get the user's top 5 favorite movies."""
    query = (
        select(
            Favorite.movie_id,
            Favorite.position,
            Movie.title,
            Movie.poster_path,
        )
        .join(Movie, Favorite.movie_id == Movie.id)
        .where(Favorite.user_id == user_id)
        .order_by(Favorite.position.asc())
    )
    result = await db.execute(query)
    rows = result.all()

    data = [
        FavoriteWithMovie(
            movie_id=row.movie_id,
            position=row.position,
            title=row.title,
            poster_path=row.poster_path,
        ).model_dump()
        for row in rows
    ]

    return {"data": data}


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def add_favorite(db: DbSession, user_id: AuthUserId, body: FavoriteCreate) -> dict:
    """Add a movie to favorites. Enforces a maximum of 5 favorites."""
    # Check current count
    count_q = select(func.count(Favorite.id)).where(Favorite.user_id == user_id)
    count = (await db.execute(count_q)).scalar() or 0

    if count >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have 5 favorites. Remove one first.",
        )

    # Verify movie exists
    movie = await db.get(Movie, body.movie_id)
    if not movie:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movie not found.",
        )

    # Determine next position
    pos_q = select(func.max(Favorite.position)).where(Favorite.user_id == user_id)
    max_pos = (await db.execute(pos_q)).scalar() or 0
    next_pos = max_pos + 1

    favorite = Favorite(user_id=user_id, movie_id=body.movie_id, position=next_pos)
    db.add(favorite)
    try:
        await db.commit()
        await db.refresh(favorite)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not add to favorites. Movie might already be favorited.",
        )

    return {
        "data": FavoriteResponse(
            movie_id=favorite.movie_id,
            position=favorite.position,
            created_at=favorite.created_at,
        ).model_dump()
    }


@router.delete("/{movie_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(db: DbSession, user_id: AuthUserId, movie_id: int) -> None:
    """Remove a movie from favorites and shift positions."""
    # Find the favorite to delete
    query = select(Favorite).where(Favorite.user_id == user_id, Favorite.movie_id == movie_id)
    result = await db.execute(query)
    favorite = result.scalar_one_or_none()

    if not favorite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorite not found.")

    deleted_pos = favorite.position
    await db.delete(favorite)

    # Shift remaining favorites down
    shift_query = select(Favorite).where(
        Favorite.user_id == user_id, Favorite.position > deleted_pos
    )
    shift_result = await db.execute(shift_query)
    for fav in shift_result.scalars():
        fav.position -= 1

    await db.commit()


@router.get("/{movie_id}/status", response_model=dict)
async def get_favorite_status(db: DbSession, user_id: AuthUserId, movie_id: int) -> dict:
    """Check if a specific movie is favorited by the user."""
    query = select(Favorite).where(Favorite.user_id == user_id, Favorite.movie_id == movie_id)
    result = await db.execute(query)
    favorite = result.scalar_one_or_none()

    # Also return total count so the client knows if it can add more
    count_q = select(func.count(Favorite.id)).where(Favorite.user_id == user_id)
    count = (await db.execute(count_q)).scalar() or 0

    return {
        "data": {
            "is_favorite": favorite is not None,
            "total_favorites": count,
        }
    }
