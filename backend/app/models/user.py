"""User model — application-specific state (auth lives in Supabase Auth)."""

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.movie import EMBEDDING_DIM


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        doc="Mirrors auth.users.id from Supabase Auth",
    )
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    embedding = mapped_column(Vector(EMBEDDING_DIM), nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────────────
    ratings: Mapped[list["Rating"]] = relationship(back_populates="user")  # type: ignore[name-defined]  # noqa: F821
    watch_history_entries: Mapped[list["WatchHistory"]] = relationship(back_populates="user")  # type: ignore[name-defined]  # noqa: F821
    onboarding_selections: Mapped[list["OnboardingSelection"]] = relationship(back_populates="user")  # type: ignore[name-defined]  # noqa: F821

    def __repr__(self) -> str:
        return f"<User(id={self.id}, onboarding_completed={self.onboarding_completed})>"
