"""ORM model registry — import all models here so Alembic and Base.metadata see them."""

from app.models.movie import Movie
from app.models.user import User
from app.models.rating import Rating
from app.models.watch_history import WatchHistory
from app.models.onboarding import OnboardingSelection
from app.models.favorite import Favorite

__all__ = ["Movie", "User", "Rating", "WatchHistory", "OnboardingSelection", "Favorite"]
