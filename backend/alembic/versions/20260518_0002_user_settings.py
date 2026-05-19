"""user settings

Revision ID: 20260518_0002
Revises: 20260518_0001
Create Date: 2026-05-18 00:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260518_0002"
down_revision: Union[str, None] = "20260518_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "usersettings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("daily_new_limit", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("daily_review_limit", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_usersettings_user_id"), "usersettings", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_usersettings_user_id"), table_name="usersettings")
    op.drop_table("usersettings")
