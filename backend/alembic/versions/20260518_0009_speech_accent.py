"""speech accent setting

Revision ID: 20260518_0009
Revises: 20260518_0008
Create Date: 2026-05-18 00:09:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260518_0009"
down_revision = "20260518_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "usersettings",
        sa.Column("speech_accent", sa.String(), nullable=False, server_default="en-US"),
    )
    op.alter_column("usersettings", "speech_accent", server_default=None)


def downgrade() -> None:
    op.drop_column("usersettings", "speech_accent")
