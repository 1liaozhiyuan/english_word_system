"""word book page size setting

Revision ID: 20260518_0008
Revises: 20260518_0007
Create Date: 2026-05-18 00:08:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260518_0008"
down_revision = "20260518_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "usersettings",
        sa.Column("word_book_page_size", sa.Integer(), nullable=False, server_default="30"),
    )
    op.alter_column("usersettings", "word_book_page_size", server_default=None)


def downgrade() -> None:
    op.drop_column("usersettings", "word_book_page_size")
