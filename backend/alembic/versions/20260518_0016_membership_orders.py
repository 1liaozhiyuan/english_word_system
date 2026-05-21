"""add membership plans and orders

Revision ID: 20260518_0016
Revises: 20260518_0015
Create Date: 2026-05-18 00:16:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = "20260518_0016"
down_revision: Union[str, None] = "20260518_0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "membershipplan",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("ai_daily_limit", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_recommended", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_membershipplan_code"), "membershipplan", ["code"], unique=True)
    op.create_index(op.f("ix_membershipplan_is_active"), "membershipplan", ["is_active"], unique=False)
    op.create_index(op.f("ix_membershipplan_created_at"), "membershipplan", ["created_at"], unique=False)

    op.create_table(
        "membershiporder",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("order_no", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["membershipplan.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_membershiporder_user_id"), "membershiporder", ["user_id"], unique=False)
    op.create_index(op.f("ix_membershiporder_plan_id"), "membershiporder", ["plan_id"], unique=False)
    op.create_index(op.f("ix_membershiporder_order_no"), "membershiporder", ["order_no"], unique=True)
    op.create_index(op.f("ix_membershiporder_status"), "membershiporder", ["status"], unique=False)
    op.create_index(op.f("ix_membershiporder_paid_at"), "membershiporder", ["paid_at"], unique=False)
    op.create_index(op.f("ix_membershiporder_created_at"), "membershiporder", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_membershiporder_created_at"), table_name="membershiporder")
    op.drop_index(op.f("ix_membershiporder_paid_at"), table_name="membershiporder")
    op.drop_index(op.f("ix_membershiporder_status"), table_name="membershiporder")
    op.drop_index(op.f("ix_membershiporder_order_no"), table_name="membershiporder")
    op.drop_index(op.f("ix_membershiporder_plan_id"), table_name="membershiporder")
    op.drop_index(op.f("ix_membershiporder_user_id"), table_name="membershiporder")
    op.drop_table("membershiporder")
    op.drop_index(op.f("ix_membershipplan_created_at"), table_name="membershipplan")
    op.drop_index(op.f("ix_membershipplan_is_active"), table_name="membershipplan")
    op.drop_index(op.f("ix_membershipplan_code"), table_name="membershipplan")
    op.drop_table("membershipplan")
