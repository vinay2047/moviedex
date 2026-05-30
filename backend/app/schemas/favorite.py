"""Favorite request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class FavoriteCreate(BaseModel):
    movie_id: int


class FavoriteResponse(BaseModel):
    movie_id: int
    position: int
    created_at: datetime

    model_config = {"from_attributes": True}


class FavoriteWithMovie(BaseModel):
    movie_id: int
    position: int
    title: str
    poster_path: str | None = None

    model_config = {"from_attributes": True}
