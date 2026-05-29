"""Onboarding selection model — movies chosen during the onboarding quiz."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OnboardingSelection(Base):
    __tablename__ = "onboarding_selections"

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
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # ── Relationships ─────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="onboarding_selections")  # type: ignore[name-defined]  # noqa: F821
    movie: Mapped["Movie"] = relationship()

    def __repr__(self) -> str:
        return f"<OnboardingSelection(user_id={self.user_id}, movie_id={self.movie_id})>"
