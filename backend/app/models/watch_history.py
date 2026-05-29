"""Watch history model — implicit consumption signals."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WatchHistory(Base):
    __tablename__ = "watch_history"

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
    watched_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # ── Relationships ─────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="watch_history_entries")  # type: ignore[name-defined]  # noqa: F821
    movie: Mapped["Movie"] = relationship(back_populates="watch_history_entries")  # type: ignore[name-defined]  # noqa: F821

    __table_args__ = (
        UniqueConstraint("user_id", "movie_id", name="uq_watch_history_user_movie"),
    )

    def __repr__(self) -> str:
        return f"<WatchHistory(user_id={self.user_id}, movie_id={self.movie_id})>"
