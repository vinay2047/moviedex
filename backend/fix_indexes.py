import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import settings

async def main():
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        await conn.execute(text('UPDATE movies SET movie_index = -id'))
    print('Updated all movie_index to -id to clear unique constraint collisions.')
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
