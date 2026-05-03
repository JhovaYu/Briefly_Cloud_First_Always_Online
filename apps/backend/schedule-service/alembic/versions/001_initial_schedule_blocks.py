"""Initial schedule_blocks table

Revision ID: 001_initial_schedule_blocks
Revises:
Create Date: 2026-05-02

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001_initial_schedule_blocks"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "schedule_blocks",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("workspace_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column(
            "start_time",
            sa.Time(timezone=False),
            nullable=False,
        ),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("color", sa.Text(), nullable=True),
        sa.Column("location", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.CheckConstraint("day_of_week BETWEEN 0 AND 6", name="ck_schedule_blocks_day_of_week"),
        sa.CheckConstraint("duration_minutes BETWEEN 5 AND 480", name="ck_schedule_blocks_duration"),
    )
    op.create_index("idx_schedule_blocks_workspace_id", "schedule_blocks", ["workspace_id"])
    op.create_index(
        "idx_schedule_blocks_workspace_dow_start",
        "schedule_blocks",
        ["workspace_id", "day_of_week", "start_time"],
    )


def downgrade() -> None:
    op.drop_index("idx_schedule_blocks_workspace_dow_start", table_name="schedule_blocks")
    op.drop_index("idx_schedule_blocks_workspace_id", table_name="schedule_blocks")
    op.drop_table("schedule_blocks")