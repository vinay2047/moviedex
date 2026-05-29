"""Rating request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class RatingCreate(BaseModel):
    movie_id: int
    rating: float = Field(..., ge=0.5, le=5.0)


class RatingResponse(BaseModel):
    movie_id: int
    rating: float
    updated_at: datetime

    model_config = {"from_attributes": True}


class RatingWithMovie(BaseModel):
    movie_id: int
    title: str
    poster_path: str | None = None
    rating: float
    updated_at: datetime

    model_config = {"from_attributes": True}
