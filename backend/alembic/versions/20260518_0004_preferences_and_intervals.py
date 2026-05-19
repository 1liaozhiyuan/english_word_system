"""preferences and review intervals

Revision ID: 20260518_0004
Revises: 20260518_0003
Create Date: 2026-05-18 00:04:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260518_0004"
down_revision = "20260518_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "usersettings",
        sa.Column("auto_play_word", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "usersettings",
        sa.Column("auto_play_example", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "userwordprogress",
        sa.Column("interval_days", sa.Float(), nullable=False, server_default="0"),
    )
    op.alter_column("usersettings", "auto_play_word", server_default=None)
    op.alter_column("usersettings", "auto_play_example", server_default=None)
    op.alter_column("userwordprogress", "interval_days", server_default=None)


def downgrade() -> None:
    op.drop_column("userwordprogress", "interval_days")
    op.drop_column("usersettings", "auto_play_example")
    op.drop_column("usersettings", "auto_play_word")
