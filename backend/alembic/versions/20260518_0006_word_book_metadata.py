"""word book metadata

Revision ID: 20260518_0006
Revises: 20260518_0005
Create Date: 2026-05-18 00:06:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260518_0006"
down_revision = "20260518_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "wordbook",
        sa.Column("category", sa.String(), nullable=False, server_default="通用"),
    )
    op.add_column(
        "wordbook",
        sa.Column("difficulty", sa.String(), nullable=False, server_default="标准"),
    )
    op.alter_column("wordbook", "category", server_default=None)
    op.alter_column("wordbook", "difficulty", server_default=None)


def downgrade() -> None:
    op.drop_column("wordbook", "difficulty")
    op.drop_column("wordbook", "category")
