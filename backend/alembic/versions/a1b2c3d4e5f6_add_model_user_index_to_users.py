"""add_model_user_index_to_users

Revision ID: a1b2c3d4e5f6
Revises: 6507a3cd67f8
Create Date: 2026-05-31 18:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '6507a3cd67f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('model_user_index', sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f('ix_users_model_user_index'),
        'users',
        ['model_user_index'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_users_model_user_index'), table_name='users')
    op.drop_column('users', 'model_user_index')
