"""add content reports

Revision ID: 20260518_0018
Revises: 20260518_0017
Create Date: 2026-05-18 00:18:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = "20260518_0018"
down_revision: Union[str, None] = "20260518_0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "contentreport",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("source_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("source_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("reason", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("content", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("reviewer_user_id", sa.Integer(), nullable=True),
        sa.Column("review_note", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["reviewer_user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_contentreport_user_id"), "contentreport", ["user_id"], unique=False)
    op.create_index(op.f("ix_contentreport_source_type"), "contentreport", ["source_type"], unique=False)
    op.create_index(op.f("ix_contentreport_source_id"), "contentreport", ["source_id"], unique=False)
    op.create_index(op.f("ix_contentreport_reason"), "contentreport", ["reason"], unique=False)
    op.create_index(op.f("ix_contentreport_status"), "contentreport", ["status"], unique=False)
    op.create_index(op.f("ix_contentreport_reviewer_user_id"), "contentreport", ["reviewer_user_id"], unique=False)
    op.create_index(op.f("ix_contentreport_created_at"), "contentreport", ["created_at"], unique=False)
    op.create_index(op.f("ix_contentreport_updated_at"), "contentreport", ["updated_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_contentreport_updated_at"), table_name="contentreport")
    op.drop_index(op.f("ix_contentreport_created_at"), table_name="contentreport")
    op.drop_index(op.f("ix_contentreport_reviewer_user_id"), table_name="contentreport")
    op.drop_index(op.f("ix_contentreport_status"), table_name="contentreport")
    op.drop_index(op.f("ix_contentreport_reason"), table_name="contentreport")
    op.drop_index(op.f("ix_contentreport_source_id"), table_name="contentreport")
    op.drop_index(op.f("ix_contentreport_source_type"), table_name="contentreport")
    op.drop_index(op.f("ix_contentreport_user_id"), table_name="contentreport")
    op.drop_table("contentreport")
