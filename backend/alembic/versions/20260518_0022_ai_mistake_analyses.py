"""add ai mistake analyses

Revision ID: 20260518_0022
Revises: 20260518_0021
Create Date: 2026-05-18 00:22:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = "20260518_0022"
down_revision: Union[str, None] = "20260518_0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "aimistakeanalysis",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("word_ids_json", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("word_count", sa.Integer(), nullable=False),
        sa.Column("content", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("source", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_aimistakeanalysis_user_id"), "aimistakeanalysis", ["user_id"], unique=False)
    op.create_index(op.f("ix_aimistakeanalysis_word_count"), "aimistakeanalysis", ["word_count"], unique=False)
    op.create_index(op.f("ix_aimistakeanalysis_source"), "aimistakeanalysis", ["source"], unique=False)
    op.create_index(op.f("ix_aimistakeanalysis_created_at"), "aimistakeanalysis", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_aimistakeanalysis_created_at"), table_name="aimistakeanalysis")
    op.drop_index(op.f("ix_aimistakeanalysis_source"), table_name="aimistakeanalysis")
    op.drop_index(op.f("ix_aimistakeanalysis_word_count"), table_name="aimistakeanalysis")
    op.drop_index(op.f("ix_aimistakeanalysis_user_id"), table_name="aimistakeanalysis")
    op.drop_table("aimistakeanalysis")
