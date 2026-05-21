"""add writing submissions

Revision ID: 20260518_0020
Revises: 20260518_0019
Create Date: 2026-05-18 00:20:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = "20260518_0020"
down_revision: Union[str, None] = "20260518_0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "writingsubmission",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("prompt", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("content", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("feedback", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_writingsubmission_user_id"), "writingsubmission", ["user_id"], unique=False)
    op.create_index(op.f("ix_writingsubmission_score"), "writingsubmission", ["score"], unique=False)
    op.create_index(op.f("ix_writingsubmission_created_at"), "writingsubmission", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_writingsubmission_created_at"), table_name="writingsubmission")
    op.drop_index(op.f("ix_writingsubmission_score"), table_name="writingsubmission")
    op.drop_index(op.f("ix_writingsubmission_user_id"), table_name="writingsubmission")
    op.drop_table("writingsubmission")
