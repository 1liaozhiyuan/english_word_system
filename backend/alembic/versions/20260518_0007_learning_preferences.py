"""learning preferences

Revision ID: 20260518_0007
Revises: 20260518_0006
Create Date: 2026-05-18 00:07:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260518_0007"
down_revision = "20260518_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "usersettings",
        sa.Column("auto_reveal_after_audio", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "usersettings",
        sa.Column("auto_advance", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "usersettings",
        sa.Column("answer_delay_ms", sa.Integer(), nullable=False, server_default="800"),
    )
    op.alter_column("usersettings", "auto_reveal_after_audio", server_default=None)
    op.alter_column("usersettings", "auto_advance", server_default=None)
    op.alter_column("usersettings", "answer_delay_ms", server_default=None)


def downgrade() -> None:
    op.drop_column("usersettings", "answer_delay_ms")
    op.drop_column("usersettings", "auto_advance")
    op.drop_column("usersettings", "auto_reveal_after_audio")
