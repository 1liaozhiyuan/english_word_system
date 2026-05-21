"""add speaking attempts

Revision ID: 20260518_0017
Revises: 20260518_0016
Create Date: 2026-05-18 00:17:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = "20260518_0017"
down_revision: Union[str, None] = "20260518_0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "speakingattempt",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("word_id", sa.Integer(), nullable=False),
        sa.Column("prompt_text", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("transcript", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("accuracy_score", sa.Integer(), nullable=False),
        sa.Column("feedback", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["word_id"], ["word.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_speakingattempt_user_id"), "speakingattempt", ["user_id"], unique=False)
    op.create_index(op.f("ix_speakingattempt_word_id"), "speakingattempt", ["word_id"], unique=False)
    op.create_index(op.f("ix_speakingattempt_accuracy_score"), "speakingattempt", ["accuracy_score"], unique=False)
    op.create_index(op.f("ix_speakingattempt_created_at"), "speakingattempt", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_speakingattempt_created_at"), table_name="speakingattempt")
    op.drop_index(op.f("ix_speakingattempt_accuracy_score"), table_name="speakingattempt")
    op.drop_index(op.f("ix_speakingattempt_word_id"), table_name="speakingattempt")
    op.drop_index(op.f("ix_speakingattempt_user_id"), table_name="speakingattempt")
    op.drop_table("speakingattempt")
