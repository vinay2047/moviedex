"""FastAPI application factory."""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup/shutdown lifecycle.

    Startup:
      - Loads the Two-Tower retrieval model and NeuMF ONNX ranker into memory
        exactly once, storing the pipeline on ``app.state.pipeline``.
    Shutdown:
      - Disposes the async DB engine connection pool.
    """
    # ── Startup ───────────────────────────────────────────────────────────
    from app.services.pipeline import RecommendationPipeline

    try:
        pipeline = await asyncio.to_thread(
            RecommendationPipeline.from_settings, settings
        )
        app.state.pipeline = pipeline
        logger.info("✓ ML recommendation pipeline loaded successfully")
    except Exception:
        logger.exception("✗ Failed to load ML pipeline — recommendations will be unavailable")
        app.state.pipeline = None

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    from app.database import engine

    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="MovieDex API",
        description="AI-powered movie recommendation engine",
        version="0.2.0",
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
    from app.routers import health, users, movies, recommendations, ratings, watch_history, onboarding, favorites, profile

    app.include_router(health.router)
    app.include_router(users.router)
    app.include_router(movies.router)
    app.include_router(recommendations.router)
    app.include_router(ratings.router)
    app.include_router(watch_history.router)
    app.include_router(onboarding.router)
    app.include_router(favorites.router)
    app.include_router(profile.router)

    return app


app = create_app()
