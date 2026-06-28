import asyncio
from app.database import async_session_maker
from sqlalchemy import select, text
from app.models.movie import Movie

async def run():
    async with async_session_maker() as db:
        movie = await db.get(Movie, 862) # Toy story
        rows = (await db.execute(
            select(Movie.title, -Movie.embedding.max_inner_product(movie.embedding))
            .where(Movie.id != 862)
            .order_by(text('2 DESC'))
            .limit(15)
        )).all()
        print('Toy Story similarities:')
        for r in rows:
            print(f'{r[0]}: {r[1]}')

asyncio.run(run())
