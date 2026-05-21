"""add notifications

Revision ID: 20260518_0015
Revises: 20260518_0014
Create Date: 2026-05-18 00:15:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = "20260518_0015"
down_revision: Union[str, None] = "20260518_0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notification",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("content", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("action_url", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(), nullable=True),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notification_user_id"), "notification", ["user_id"], unique=False)
    op.create_index(op.f("ix_notification_type"), "notification", ["type"], unique=False)
    op.create_index(op.f("ix_notification_scheduled_at"), "notification", ["scheduled_at"], unique=False)
    op.create_index(op.f("ix_notification_read_at"), "notification", ["read_at"], unique=False)
    op.create_index(op.f("ix_notification_created_at"), "notification", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_notification_created_at"), table_name="notification")
    op.drop_index(op.f("ix_notification_read_at"), table_name="notification")
    op.drop_index(op.f("ix_notification_scheduled_at"), table_name="notification")
    op.drop_index(op.f("ix_notification_type"), table_name="notification")
    op.drop_index(op.f("ix_notification_user_id"), table_name="notification")
    op.drop_table("notification")
