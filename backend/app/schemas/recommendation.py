"""Recommendation & onboarding schemas."""

from pydantic import BaseModel, Field


class OnboardingRequest(BaseModel):
    movie_ids: list[int] = Field(..., min_length=5, max_length=10)


class OnboardingResponse(BaseModel):
    onboarding_completed: bool
    message: str


class WatchHistoryCreate(BaseModel):
    movie_id: int
    status: str = Field("watchlist", pattern="^(watchlist|watched)$")
