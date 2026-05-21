"""favorite words

Revision ID: 20260518_0005
Revises: 20260518_0004
Create Date: 2026-05-18 00:05:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260518_0005"
down_revision = "20260518_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "favoriteword",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("word_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["word_id"], ["word.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "word_id", name="uq_favoriteword_user_word"),
    )
    op.create_index("ix_favoriteword_user_id", "favoriteword", ["user_id"])
    op.create_index("ix_favoriteword_word_id", "favoriteword", ["word_id"])


def downgrade() -> None:
    op.drop_index("ix_favoriteword_word_id", table_name="favoriteword")
    op.drop_index("ix_favoriteword_user_id", table_name="favoriteword")
    op.drop_table("favoriteword")
