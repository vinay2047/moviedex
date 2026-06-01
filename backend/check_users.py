import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import settings

async def main():
    engine = create_async_engine(settings.database_url)
    async with engine.connect() as conn:
        res = await conn.execute(text('SELECT email, model_user_index FROM users LIMIT 5'))
        print(res.fetchall())
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
