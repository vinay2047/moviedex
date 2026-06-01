import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import settings

async def main():
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        await conn.execute(text('UPDATE users SET model_user_index = NULL WHERE model_user_index = 42'))
    print('Reverted model_user_index.')
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
