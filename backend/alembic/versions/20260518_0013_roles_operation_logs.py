"""add user roles and admin operation logs

Revision ID: 20260518_0013
Revises: 20260518_0012
Create Date: 2026-05-18 00:13:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = "20260518_0013"
down_revision: Union[str, None] = "20260518_0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user", sa.Column("role", sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default="user"))
    op.create_table(
        "adminoperationlog",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=False),
        sa.Column("action", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("target_type", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("target_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("detail", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_adminoperationlog_actor_user_id"), "adminoperationlog", ["actor_user_id"], unique=False)
    op.create_index(op.f("ix_adminoperationlog_action"), "adminoperationlog", ["action"], unique=False)
    op.create_index(op.f("ix_adminoperationlog_target_type"), "adminoperationlog", ["target_type"], unique=False)
    op.create_index(op.f("ix_adminoperationlog_target_id"), "adminoperationlog", ["target_id"], unique=False)
    op.create_index(op.f("ix_adminoperationlog_created_at"), "adminoperationlog", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_adminoperationlog_created_at"), table_name="adminoperationlog")
    op.drop_index(op.f("ix_adminoperationlog_target_id"), table_name="adminoperationlog")
    op.drop_index(op.f("ix_adminoperationlog_target_type"), table_name="adminoperationlog")
    op.drop_index(op.f("ix_adminoperationlog_action"), table_name="adminoperationlog")
    op.drop_index(op.f("ix_adminoperationlog_actor_user_id"), table_name="adminoperationlog")
    op.drop_table("adminoperationlog")
    op.drop_column("user", "role")
