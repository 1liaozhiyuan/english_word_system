"""add ai saved examples

Revision ID: 20260518_0012
Revises: 20260518_0011
Create Date: 2026-05-18 00:12:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = "20260518_0012"
down_revision: Union[str, None] = "20260518_0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "aisavedexample",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("word_id", sa.Integer(), nullable=False),
        sa.Column("sentence", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("translation", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("raw_content", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("source", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["word_id"], ["word.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_aisavedexample_user_id"), "aisavedexample", ["user_id"], unique=False)
    op.create_index(op.f("ix_aisavedexample_word_id"), "aisavedexample", ["word_id"], unique=False)
    op.create_index(op.f("ix_aisavedexample_source"), "aisavedexample", ["source"], unique=False)
    op.create_index(op.f("ix_aisavedexample_created_at"), "aisavedexample", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_aisavedexample_created_at"), table_name="aisavedexample")
    op.drop_index(op.f("ix_aisavedexample_source"), table_name="aisavedexample")
    op.drop_index(op.f("ix_aisavedexample_word_id"), table_name="aisavedexample")
    op.drop_index(op.f("ix_aisavedexample_user_id"), table_name="aisavedexample")
    op.drop_table("aisavedexample")
