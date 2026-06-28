"""Onboarding service — warm-start embedding computation."""

import uuid

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.movie import Movie
from app.models.user import User
from app.models.onboarding import OnboardingSelection


async def save_onboarding_selections(
    db: AsyncSession,
    user_id: uuid.UUID,
    movie_ids: list[int],
) -> bool:
    """
    Save the user's explicit onboarding movie selections to the database.
    This explicit data is dynamically used to compute a semantic centroid
    for cold-start recommendations at request time.
    
    1. Mark onboarding as completed.
    2. Record selections in onboarding_selections table.

    Returns True on success.
    """
    if len(movie_ids) < 5:
        return False

    user = await db.get(User, user_id)
    if user is None:
        return False

    user.onboarding_completed = True

    # Record onboarding selections
    for movie_id in movie_ids:
        selection = OnboardingSelection(user_id=user_id, movie_id=movie_id)
        db.add(selection)

    await db.commit()
    return True
