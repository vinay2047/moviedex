"""Movie request/response schemas."""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


class CastMember(BaseModel):
    name: str | None = None
    character: str | None = None
    profile_path: str | None = None


class GenreItem(BaseModel):
    id: int
    name: str


class MovieSummary(BaseModel):
    """Compact movie representation for lists and search results."""
    id: int
    title: str
    poster_path: str | None = None
    genres: list[GenreItem] | None = None
    vote_average: float | None = None
    release_date: date | None = None

    model_config = {"from_attributes": True}


class MovieDetail(BaseModel):
    """Full movie representation for the detail page."""
    id: int
    movielens_id: int
    tmdb_id: int | None = None
    title: str
    original_title: str | None = None
    overview: str | None = None
    poster_path: str | None = None
    backdrop_path: str | None = None
    release_date: date | None = None
    vote_average: float | None = None
    vote_count: int | None = None
    runtime: int | None = None
    genres: list[GenreItem] | None = None
    cast_top5: list[CastMember] | None = None
    trailer_key: str | None = None
    user_rating: float | None = None
    in_watch_history: bool = False

    model_config = {"from_attributes": True}


class MovieRecommendation(BaseModel):
    """Movie with a similarity score from pgvector."""
    id: int
    title: str
    poster_path: str | None = None
    genres: list[GenreItem] | None = None
    vote_average: float | None = None
    release_date: date | None = None
    score: float

    model_config = {"from_attributes": True}
