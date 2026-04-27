"""Initial planning tables: task_lists and tasks

Revision ID: 001_initial_task_tables
Revises:
Create Date: 2026-04-27

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY

# revision identifiers
revision: str = "001_initial_task_tables"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create task_lists table
    op.create_table(
        "task_lists",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("workspace_id", UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("color", sa.Text(), nullable=True),
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
        sa.Column("created_by", sa.Text(), nullable=False),
        sa.UniqueConstraint("id", "workspace_id", name="uq_task_lists_id_workspace"),
    )
    op.create_index("idx_task_lists_workspace_id", "task_lists", ["workspace_id"])

    # Create tasks table
    op.create_table(
        "tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("workspace_id", UUID(as_uuid=True), nullable=False),
        sa.Column("list_id", UUID(as_uuid=True), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column(
            "state",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'pending'::text"),
        ),
        sa.Column(
            "priority",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'medium'::text"),
        ),
        sa.Column("assignee_id", UUID(as_uuid=True), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("tags", ARRAY(sa.Text()), nullable=True),
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
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Text(), nullable=False),
        # Check constraints for enum values
        sa.CheckConstraint(
            "state IN ('pending', 'working', 'done')",
            name="ck_tasks_state",
        ),
        sa.CheckConstraint(
            "priority IN ('low', 'medium', 'high')",
            name="ck_tasks_priority",
        ),
    )
    op.create_index("idx_tasks_workspace_id", "tasks", ["workspace_id"])
    op.create_index("idx_tasks_list_id", "tasks", ["list_id"], postgresql_where=sa.text("list_id IS NOT NULL"))
    op.create_index("idx_tasks_workspace_state", "tasks", ["workspace_id", "state"])
    op.create_index(
        "idx_tasks_assignee",
        "tasks",
        ["assignee_id"],
        postgresql_where=sa.text("assignee_id IS NOT NULL"),
    )

    # Composite FK: tasks(list_id, workspace_id) -> task_lists(id, workspace_id)
    # This prevents a task in workspace A from referencing a task_list in workspace B.
    # ON DELETE RESTRICT is used instead of ON DELETE SET NULL because Postgres
    # applies SET NULL to ALL columns in the composite FK. Since workspace_id is
    # NOT NULL, SET NULL would fail. TaskList deletion is not implemented in
    # PM-04.2C1 — PM-04.2C2 will handle orphan-task cleanup before list deletion.
    op.create_foreign_key(
        "fk_tasks_list_workspace",
        "tasks",
        "task_lists",
        ["list_id", "workspace_id"],
        ["id", "workspace_id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint("fk_tasks_list_workspace", "tasks", type_="foreignkey")
    op.drop_index("idx_tasks_assignee", table_name="tasks")
    op.drop_index("idx_tasks_workspace_state", table_name="tasks")
    op.drop_index("idx_tasks_list_id", table_name="tasks")
    op.drop_index("idx_tasks_workspace_id", table_name="tasks")
    op.drop_table("tasks")
    op.drop_index("idx_task_lists_workspace_id", table_name="task_lists")
    op.drop_table("task_lists")