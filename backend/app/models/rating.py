"""Rating model — explicit user ratings (0.5–5.0)."""

import uuid
from datetime import datetime

from sqlalchemy import Float, ForeignKey, Integer, UniqueConstraint, CheckConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Rating(Base):
    __tablename__ = "ratings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    movie_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("movies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rating: Mapped[float] = mapped_column(Float, nullable=False)

    # ── Timestamps ────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="ratings")  # type: ignore[name-defined]  # noqa: F821
    movie: Mapped["Movie"] = relationship(back_populates="ratings")  # type: ignore[name-defined]  # noqa: F821

    __table_args__ = (
        UniqueConstraint("user_id", "movie_id", name="uq_ratings_user_movie"),
        CheckConstraint("rating >= 0.5 AND rating <= 5.0", name="ck_ratings_range"),
    )

    def __repr__(self) -> str:
        return f"<Rating(user_id={self.user_id}, movie_id={self.movie_id}, rating={self.rating})>"
