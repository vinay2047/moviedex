"""
Load movie_id_mapping.csv, movies.csv, and item_embeddings_db.pt into the `movies` table.

Usage:
    cd backend/
    python -m scripts.load_embeddings

Prerequisites:
    - Supabase PostgreSQL with pgvector extension enabled
    - .env configured with DATABASE_URL
    - Alembic migrations applied (tables exist)
"""

import asyncio
import csv
import math
import sys
from pathlib import Path

import torch
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# ── Resolve paths ─────────────────────────────────────────────────────────
ROOT_DIR = Path(__file__).resolve().parent.parent.parent  # moviedex/
DATA_DIR = ROOT_DIR / "data"
MAPPING_CSV = DATA_DIR / "movie_id_mapping.csv"
MOVIES_CSV = DATA_DIR / "movies.csv"
EMBEDDINGS_PT = DATA_DIR / "item_embeddings_db.pt"

# Add backend/ to sys.path so we can import app.config
sys.path.insert(0, str(ROOT_DIR / "backend"))

from app.config import settings  # noqa: E402
from app.models.movie import Movie  # noqa: E402


async def ensure_pgvector(engine) -> None:  # type: ignore[no-untyped-def]
    """Enable pgvector extension if not already enabled."""
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    print("[OK] pgvector extension enabled")


def load_mapping() -> dict[int, dict]:
    """Load movie_id_mapping.csv → {movie_index: {movieId, tmdbId, imdbId}}."""
    mapping: dict[int, dict] = {}
    with open(MAPPING_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            idx = int(row["movie_index"])
            tmdb_raw = row["tmdbId"]
            tmdb_id = None if (not tmdb_raw or tmdb_raw == "nan" or math.isnan(float(tmdb_raw))) else int(float(tmdb_raw))
            mapping[idx] = {
                "movieId": int(row["movieId"]),
                "tmdbId": tmdb_id,
                "imdbId": row.get("imdbId", ""),
            }
    return mapping


def load_titles() -> dict[int, str]:
    """Load movies.csv → {movieId: title}."""
    titles: dict[int, str] = {}
    with open(MOVIES_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            titles[int(row["movieId"])] = row["title"]
    return titles


async def load_embeddings() -> None:
    """Main pipeline: load CSVs + .pt tensor → insert into movies table."""
    print(f"Loading embeddings from {EMBEDDINGS_PT}")
    embeddings = torch.load(EMBEDDINGS_PT, map_location="cpu")
    print(f"  Shape: {embeddings.shape} | Dtype: {embeddings.dtype}")

    mapping = load_mapping()
    titles = load_titles()
    print(f"  Mapping entries: {len(mapping)} | Title entries: {len(titles)}")

    assert embeddings.shape[0] == len(mapping), (
        f"Embedding count ({embeddings.shape[0]}) != mapping count ({len(mapping)})"
    )

    engine = create_async_engine(settings.database_url, pool_size=5)
    await ensure_pgvector(engine)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # ── Batch insert ──────────────────────────────────────────────────────
    BATCH_SIZE = 500
    rows_to_insert = []

    for movie_index in range(embeddings.shape[0]):
        meta = mapping[movie_index]
        movie_id = meta["movieId"]
        title = titles.get(movie_id, f"Unknown (movieId={movie_id})")
        emb_vector = embeddings[movie_index].tolist()

        rows_to_insert.append({
            "movielens_id": movie_id,
            "movie_index": movie_index,
            "tmdb_id": meta["tmdbId"],
            "title": title,
            "embedding": emb_vector,
        })

    inserted = 0
    for i in range(0, len(rows_to_insert), BATCH_SIZE):
        batch = rows_to_insert[i : i + BATCH_SIZE]
        
        async with session_factory() as session:
            stmt = pg_insert(Movie).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=["movielens_id"],
                set_={
                    "movie_index": stmt.excluded.movie_index,
                    "tmdb_id": stmt.excluded.tmdb_id,
                    "title": stmt.excluded.title,
                    "embedding": stmt.excluded.embedding,
                },
            )
            await session.execute(stmt)
            await session.commit()
            
        inserted += len(batch)
        print(f"  Inserted/updated {inserted}/{len(rows_to_insert)} movies")

    await engine.dispose()
    print(f"\n✓ Done. {inserted} movies loaded into the database.")


if __name__ == "__main__":
    asyncio.run(load_embeddings())
