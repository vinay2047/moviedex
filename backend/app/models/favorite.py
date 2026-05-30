"""Favorite model — user's top 5 favorite movies."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, UniqueConstraint, CheckConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Favorite(Base):
    __tablename__ = "favorites"

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
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Timestamps ────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # ── Relationships ─────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="favorites")  # type: ignore[name-defined]  # noqa: F821
    movie: Mapped["Movie"] = relationship(back_populates="favorites")  # type: ignore[name-defined]  # noqa: F821

    __table_args__ = (
        UniqueConstraint("user_id", "movie_id", name="uq_favorites_user_movie"),
        UniqueConstraint("user_id", "position", name="uq_favorites_user_position"),
        CheckConstraint("position >= 1 AND position <= 5", name="ck_favorites_position_range"),
    )

    def __repr__(self) -> str:
        return f"<Favorite(user_id={self.user_id}, movie_id={self.movie_id}, position={self.position})>"
