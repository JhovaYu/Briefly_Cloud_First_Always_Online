"""initial workspace shared text table

Revision ID: 001
Revises:
Create Date: 2026-05-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'workspace_shared_text',
        sa.Column('workspace_id', sa.String(36), primary_key=True, server_default=sa.text('gen_random_uuid()::text')),
        sa.Column('content', sa.Text(), nullable=False, server_default=''),
        sa.Column('updated_by', sa.String(36), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('version', sa.Integer(), nullable=False, server_default=sa.text('1')),
    )
    op.create_index('ix_workspace_shared_text_workspace_id', 'workspace_shared_text', ['workspace_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_workspace_shared_text_workspace_id', 'workspace_shared_text')
    op.drop_table('workspace_shared_text')