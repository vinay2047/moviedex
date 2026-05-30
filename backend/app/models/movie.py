"""Movie model — core entity with TMDB metadata and pgvector embedding."""

from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Date, Float, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

EMBEDDING_DIM = 32


class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    movielens_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    movie_index: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    tmdb_id: Mapped[int | None] = mapped_column(Integer, unique=False, nullable=True)

    # ── Core metadata (from movies.csv) ───────────────────────────────────
    title: Mapped[str] = mapped_column(String(512), nullable=False)

    # ── TMDB-hydrated fields ──────────────────────────────────────────────
    original_title: Mapped[str | None] = mapped_column(String(512))
    overview: Mapped[str | None] = mapped_column(Text)
    poster_path: Mapped[str | None] = mapped_column(String(255))
    backdrop_path: Mapped[str | None] = mapped_column(String(255))
    release_date: Mapped[date | None] = mapped_column(Date)
    vote_average: Mapped[float | None] = mapped_column(Float)
    vote_count: Mapped[int | None] = mapped_column(Integer)
    runtime: Mapped[int | None] = mapped_column(Integer)
    genres: Mapped[dict | None] = mapped_column(JSONB)  # [{"id": 28, "name": "Action"}, ...]
    cast_top5: Mapped[dict | None] = mapped_column(JSONB)  # [{"name": "...", "character": "...", ...}]
    trailer_key: Mapped[str | None] = mapped_column(String(64))

    # ── Embedding ─────────────────────────────────────────────────────────
    embedding = mapped_column(Vector(EMBEDDING_DIM), nullable=False)

    # ── Timestamps ────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────────────
    ratings: Mapped[list["Rating"]] = relationship(back_populates="movie")  # type: ignore[name-defined]  # noqa: F821
    watch_history_entries: Mapped[list["WatchHistory"]] = relationship(back_populates="movie")  # type: ignore[name-defined]  # noqa: F821
    favorites: Mapped[list["Favorite"]] = relationship(back_populates="movie")  # type: ignore[name-defined]  # noqa: F821

    __table_args__ = (
        Index(
            "ix_movies_embedding_hnsw",
            embedding,
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_ip_ops"},
        ),
    )

    def __repr__(self) -> str:
        return f"<Movie(id={self.id}, title='{self.title}', movielens_id={self.movielens_id})>"
