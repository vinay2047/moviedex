"""Onboarding service — warm-start embedding computation."""

import uuid

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.movie import Movie
from app.models.user import User
from app.models.onboarding import OnboardingSelection


async def compute_warm_start_embedding(
    db: AsyncSession,
    user_id: uuid.UUID,
    movie_ids: list[int],
) -> bool:
    """
    Compute a warm-start user embedding from selected onboarding movies.

    1. Fetch item embeddings for the selected movies.
    2. Average them.
    3. L2-normalize.
    4. Store as the user's embedding.
    5. Mark onboarding as completed.
    6. Record selections in onboarding_selections table.

    Returns True on success.
    """
    # 1. Fetch embeddings for selected movies
    result = await db.execute(
        select(Movie.id, Movie.embedding).where(Movie.id.in_(movie_ids))
    )
    rows = result.all()

    if len(rows) < 5:
        return False

    # 2. Average embeddings
    embeddings = np.array([row.embedding for row in rows], dtype=np.float32)
    avg_embedding = embeddings.mean(axis=0)

    # 3. L2-normalize
    norm = np.linalg.norm(avg_embedding)
    if norm > 0:
        avg_embedding = avg_embedding / norm

    # 4. Update user
    user = await db.get(User, user_id)
    if user is None:
        return False

    user.embedding = avg_embedding.tolist()
    user.onboarding_completed = True

    # 5. Record onboarding selections
    for movie_id in movie_ids:
        selection = OnboardingSelection(user_id=user_id, movie_id=movie_id)
        db.add(selection)

    await db.commit()
    return True
