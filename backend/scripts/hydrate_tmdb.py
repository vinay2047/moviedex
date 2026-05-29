"""
Hydrate the movies table with TMDB metadata (poster, backdrop, overview, cast, trailer).

Usage:
    cd backend/
    python -m scripts.hydrate_tmdb

Rate limiting:
    TMDB free tier allows ~40 requests/second. This script uses aiolimiter
    to stay safely under that at 35 req/s with concurrent workers.
"""

import asyncio
import sys
from pathlib import Path

import httpx
from aiolimiter import AsyncLimiter
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# ── Resolve paths ─────────────────────────────────────────────────────────
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR / "backend"))

from app.config import settings  # noqa: E402
from app.models.movie import Movie  # noqa: E402

# TMDB API config
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_HEADERS = {
    "Authorization": f"Bearer {settings.tmdb_read_access_token}",
    "Accept": "application/json",
}

# 35 requests per second — safe margin under the 40/s free-tier limit
rate_limiter = AsyncLimiter(35, 1.0)

# Concurrency
MAX_WORKERS = 10


async def fetch_movie_details(client: httpx.AsyncClient, tmdb_id: int) -> dict | None:
    """Fetch movie details + credits + videos in a single appended request."""
    async with rate_limiter:
        try:
            resp = await client.get(
                f"{TMDB_BASE_URL}/movie/{tmdb_id}",
                params={"append_to_response": "credits,videos"},
                headers=TMDB_HEADERS,
                timeout=15.0,
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as e:
            print(f"  ✗ TMDB error for tmdb_id={tmdb_id}: {e}")
            return None


def extract_metadata(data: dict) -> dict:
    """Extract the fields we care about from the TMDB response."""
    # ── Cast (top 5) ──────────────────────────────────────────────────────
    credits = data.get("credits", {})
    cast_raw = credits.get("cast", [])[:5]
    cast_top5 = [
        {
            "name": c.get("name"),
            "character": c.get("character"),
            "profile_path": c.get("profile_path"),
        }
        for c in cast_raw
    ]

    # ── Trailer (first YouTube trailer) ───────────────────────────────────
    videos = data.get("videos", {}).get("results", [])
    trailer_key = None
    for v in videos:
        if v.get("site") == "YouTube" and v.get("type") == "Trailer":
            trailer_key = v["key"]
            break

    return {
        "original_title": data.get("original_title"),
        "overview": data.get("overview"),
        "poster_path": data.get("poster_path"),
        "backdrop_path": data.get("backdrop_path"),
        "release_date": data.get("release_date") or None,
        "vote_average": data.get("vote_average"),
        "vote_count": data.get("vote_count"),
        "runtime": data.get("runtime"),
        "genres": data.get("genres"),
        "cast_top5": cast_top5,
        "trailer_key": trailer_key,
    }


async def hydrate_batch(
    session: AsyncSession,
    client: httpx.AsyncClient,
    movies: list[tuple[int, int]],  # (movie.id, tmdb_id)
    progress: dict,
) -> None:
    """Hydrate a batch of movies concurrently."""
    tasks = []
    for movie_pk, tmdb_id in movies:
        tasks.append(fetch_and_update(session, client, movie_pk, tmdb_id, progress))
    await asyncio.gather(*tasks)


async def fetch_and_update(
    session: AsyncSession,
    client: httpx.AsyncClient,
    movie_pk: int,
    tmdb_id: int,
    progress: dict,
) -> None:
    """Fetch TMDB data for a single movie and update the DB row."""
    data = await fetch_movie_details(client, tmdb_id)
    progress["processed"] += 1

    if data is None:
        progress["skipped"] += 1
        return

    metadata = extract_metadata(data)

    # Handle empty release_date string or convert to date
    if metadata["release_date"]:
        from datetime import datetime
        try:
            metadata["release_date"] = datetime.strptime(metadata["release_date"], "%Y-%m-%d").date()
        except ValueError:
            metadata["release_date"] = None
    else:
        metadata["release_date"] = None

    await session.execute(
        update(Movie).where(Movie.id == movie_pk).values(**metadata)
    )
    progress["updated"] += 1

    if progress["processed"] % 100 == 0:
        print(f"  Progress: {progress['processed']}/{progress['total']} "
              f"(updated={progress['updated']}, skipped={progress['skipped']})")


async def hydrate_tmdb() -> None:
    """Main pipeline: fetch all movies with a tmdb_id and hydrate metadata."""
    engine = create_async_engine(settings.database_url, pool_size=5)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # ── Get all movies that have a tmdb_id but no poster yet ──────────
        result = await session.execute(
            select(Movie.id, Movie.tmdb_id).where(
                Movie.tmdb_id.isnot(None),
                Movie.poster_path.is_(None),  # Skip already-hydrated rows
            )
        )
        movies_to_hydrate = result.all()

    total = len(movies_to_hydrate)
    print(f"Found {total} movies to hydrate from TMDB")

    if total == 0:
        print("Nothing to do. All movies already hydrated.")
        await engine.dispose()
        return

    progress = {"total": total, "processed": 0, "updated": 0, "skipped": 0}

    BATCH_SIZE = MAX_WORKERS
    async with httpx.AsyncClient() as client:
        async with session_factory() as session:
            for i in range(0, total, BATCH_SIZE):
                batch = movies_to_hydrate[i : i + BATCH_SIZE]
                await hydrate_batch(session, client, batch, progress)

                # Commit every 100 movies to avoid holding a massive transaction
                if progress["processed"] % 100 == 0:
                    await session.commit()

            await session.commit()

    await engine.dispose()
    print(f"\n✓ Hydration complete. Updated={progress['updated']}, "
          f"Skipped={progress['skipped']}, Total={progress['total']}")


if __name__ == "__main__":
    asyncio.run(hydrate_tmdb())
