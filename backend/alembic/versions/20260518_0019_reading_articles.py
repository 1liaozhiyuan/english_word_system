"""add reading articles

Revision ID: 20260518_0019
Revises: 20260518_0018
Create Date: 2026-05-18 00:19:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = "20260518_0019"
down_revision: Union[str, None] = "20260518_0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "readingarticle",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("category", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("level", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("content", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("translation", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("audio_text", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_readingarticle_category"), "readingarticle", ["category"], unique=False)
    op.create_index(op.f("ix_readingarticle_level"), "readingarticle", ["level"], unique=False)
    op.create_index(op.f("ix_readingarticle_created_at"), "readingarticle", ["created_at"], unique=False)

    op.create_table(
        "readingprogress",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("article_id", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=False),
        sa.Column("reading_seconds", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["article_id"], ["readingarticle.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_readingprogress_user_id"), "readingprogress", ["user_id"], unique=False)
    op.create_index(op.f("ix_readingprogress_article_id"), "readingprogress", ["article_id"], unique=False)
    op.create_index(op.f("ix_readingprogress_completed_at"), "readingprogress", ["completed_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_readingprogress_completed_at"), table_name="readingprogress")
    op.drop_index(op.f("ix_readingprogress_article_id"), table_name="readingprogress")
    op.drop_index(op.f("ix_readingprogress_user_id"), table_name="readingprogress")
    op.drop_table("readingprogress")
    op.drop_index(op.f("ix_readingarticle_created_at"), table_name="readingarticle")
    op.drop_index(op.f("ix_readingarticle_level"), table_name="readingarticle")
    op.drop_index(op.f("ix_readingarticle_category"), table_name="readingarticle")
    op.drop_table("readingarticle")
