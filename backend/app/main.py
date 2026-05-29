"""FastAPI application factory."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup/shutdown lifecycle."""
    # ── Startup ───────────────────────────────────────────────────────────
    # Future: warm caches, verify DB connectivity, etc.
    yield
    # ── Shutdown ──────────────────────────────────────────────────────────
    from app.database import engine

    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="MovieDex API",
        description="AI-powered movie recommendation engine",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
    )

    # ── CORS ──────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ───────────────────────────────────────────────────────────
    from app.routers import health, users, movies, recommendations, ratings, watch_history, onboarding

    app.include_router(health.router)
    app.include_router(users.router)
    app.include_router(movies.router)
    app.include_router(recommendations.router)
    app.include_router(ratings.router)
    app.include_router(watch_history.router)
    app.include_router(onboarding.router)

    return app


app = create_app()
