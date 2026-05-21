"""add ai questions and attempts

Revision ID: 20260518_0014
Revises: 20260518_0013
Create Date: 2026-05-18 00:14:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = "20260518_0014"
down_revision: Union[str, None] = "20260518_0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "aiquestion",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("word_id", sa.Integer(), nullable=True),
        sa.Column("question_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("prompt", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("options_json", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("answer", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("explanation", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("related_word", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("source", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["word_id"], ["word.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_aiquestion_user_id"), "aiquestion", ["user_id"], unique=False)
    op.create_index(op.f("ix_aiquestion_word_id"), "aiquestion", ["word_id"], unique=False)
    op.create_index(op.f("ix_aiquestion_question_type"), "aiquestion", ["question_type"], unique=False)
    op.create_index(op.f("ix_aiquestion_related_word"), "aiquestion", ["related_word"], unique=False)
    op.create_index(op.f("ix_aiquestion_source"), "aiquestion", ["source"], unique=False)
    op.create_index(op.f("ix_aiquestion_created_at"), "aiquestion", ["created_at"], unique=False)

    op.create_table(
        "aiquestionattempt",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("answer", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["question_id"], ["aiquestion.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_aiquestionattempt_user_id"), "aiquestionattempt", ["user_id"], unique=False)
    op.create_index(op.f("ix_aiquestionattempt_question_id"), "aiquestionattempt", ["question_id"], unique=False)
    op.create_index(op.f("ix_aiquestionattempt_is_correct"), "aiquestionattempt", ["is_correct"], unique=False)
    op.create_index(op.f("ix_aiquestionattempt_created_at"), "aiquestionattempt", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_aiquestionattempt_created_at"), table_name="aiquestionattempt")
    op.drop_index(op.f("ix_aiquestionattempt_is_correct"), table_name="aiquestionattempt")
    op.drop_index(op.f("ix_aiquestionattempt_question_id"), table_name="aiquestionattempt")
    op.drop_index(op.f("ix_aiquestionattempt_user_id"), table_name="aiquestionattempt")
    op.drop_table("aiquestionattempt")
    op.drop_index(op.f("ix_aiquestion_created_at"), table_name="aiquestion")
    op.drop_index(op.f("ix_aiquestion_source"), table_name="aiquestion")
    op.drop_index(op.f("ix_aiquestion_related_word"), table_name="aiquestion")
    op.drop_index(op.f("ix_aiquestion_question_type"), table_name="aiquestion")
    op.drop_index(op.f("ix_aiquestion_word_id"), table_name="aiquestion")
    op.drop_index(op.f("ix_aiquestion_user_id"), table_name="aiquestion")
    op.drop_table("aiquestion")
