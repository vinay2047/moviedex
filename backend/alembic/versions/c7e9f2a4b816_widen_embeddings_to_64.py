"""Widen embedding columns from vector(32) to vector(64)

Revision ID: c7e9f2a4b816
Revises: fa64594ae420
Create Date: 2026-06-11 01:57:00.000000
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c7e9f2a4b816'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop the HNSW index (it references the old vector dimension)
    op.drop_index('ix_movies_embedding_hnsw', table_name='movies')

    # 2. Drop NOT NULL constraint on movies.embedding so we can NULL it out
    op.execute("ALTER TABLE movies ALTER COLUMN embedding DROP NOT NULL")

    # 3. NULL out existing 32-dim embeddings (incompatible with vector(64))
    op.execute("UPDATE movies SET embedding = NULL")
    op.execute("UPDATE users SET embedding = NULL")

    # 4. Alter column types to vector(64)
    op.execute("ALTER TABLE movies ALTER COLUMN embedding TYPE vector(64)")
    op.execute("ALTER TABLE users ALTER COLUMN embedding TYPE vector(64)")

    # 5. Recreate the HNSW index with the new dimension
    op.execute("""
        CREATE INDEX ix_movies_embedding_hnsw
        ON movies USING hnsw (embedding vector_ip_ops)
        WITH (m = 16, ef_construction = 64)
    """)


def downgrade() -> None:
    op.drop_index('ix_movies_embedding_hnsw', table_name='movies')

    op.execute("UPDATE movies SET embedding = NULL")
    op.execute("UPDATE users SET embedding = NULL")

    op.execute("ALTER TABLE movies ALTER COLUMN embedding TYPE vector(32)")
    op.execute("ALTER TABLE users ALTER COLUMN embedding TYPE vector(32)")

    op.execute("""
        CREATE INDEX ix_movies_embedding_hnsw
        ON movies USING hnsw (embedding vector_ip_ops)
        WITH (m = 16, ef_construction = 64)
    """)
