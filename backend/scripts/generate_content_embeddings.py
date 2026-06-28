"""
Backfill content embeddings using sentence-transformers.
Generates 384-dimensional vectors for semantic item similarity.
"""

import asyncio
import logging
import math
import sys
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Add backend to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR / "backend"))

from app.config import settings
from app.models.movie import Movie

def format_movie_text(title: str, genres: list[dict] | None, overview: str | None) -> str:
    """Format movie attributes into a text string for the NLP model."""
    genre_names = ", ".join(g.get("name", "") for g in (genres or [])) if genres else "No genres"
    clean_overview = overview if overview else "No overview available."
    return f"{title} [{genre_names}]: {clean_overview}"

async def main():
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        logger.error("sentence-transformers not installed. Please run `pip install sentence-transformers`.")
        sys.exit(1)

    logger.info("Loading sentence-transformers/all-MiniLM-L6-v2 model...")
    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    engine = create_async_engine(settings.database_url, pool_size=5)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    BATCH_SIZE = 1000
    total_processed = 0

    logger.info("Starting content embeddings backfill...")

    while True:
        async with session_factory() as session:
            # Query movies where content_embedding is NULL
            query = select(Movie).where(Movie.content_embedding.is_(None)).limit(BATCH_SIZE)
            result = await session.execute(query)
            movies = result.scalars().all()

            if not movies:
                logger.info("No more movies found with NULL content_embedding. Backfill complete!")
                break

            logger.info(f"Processing batch of {len(movies)} movies...")
            
            # Prepare texts for embedding
            texts = []
            movie_ids = []
            for movie in movies:
                movie_ids.append(movie.id)
                texts.append(format_movie_text(movie.title, movie.genres, movie.overview))

            # Generate embeddings
            try:
                # encode returns a numpy array or torch tensor depending on config, default is numpy
                embeddings = model.encode(texts, show_progress_bar=False, batch_size=256)
                
                # Prepare mappings for bulk update
                mappings = []
                for movie_id, embedding in zip(movie_ids, embeddings):
                    mappings.append({
                        "id": movie_id,
                        "content_embedding": embedding.tolist()
                    })

                # Bulk update using async session
                # Note: bulk_update_mappings is sync, but we can execute an update statement mapped
                await session.execute(
                    update(Movie),
                    mappings
                )
                await session.commit()
                
                total_processed += len(movies)
                logger.info(f"Successfully updated {total_processed} movies total.")

            except Exception as e:
                logger.error(f"Error during batch processing: {e}")
                await session.rollback()
                break

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
