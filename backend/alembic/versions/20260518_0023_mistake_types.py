"""add mistake types

Revision ID: 20260518_0023
Revises: 20260518_0022
Create Date: 2026-05-18 00:23:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = "20260518_0023"
down_revision: Union[str, None] = "20260518_0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("userwordprogress", sa.Column("last_mistake_type", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.create_index(op.f("ix_userwordprogress_last_mistake_type"), "userwordprogress", ["last_mistake_type"], unique=False)
    op.add_column("reviewlog", sa.Column("mistake_type", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.create_index(op.f("ix_reviewlog_mistake_type"), "reviewlog", ["mistake_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_reviewlog_mistake_type"), table_name="reviewlog")
    op.drop_column("reviewlog", "mistake_type")
    op.drop_index(op.f("ix_userwordprogress_last_mistake_type"), table_name="userwordprogress")
    op.drop_column("userwordprogress", "last_mistake_type")
