"""membership and ai quota

Revision ID: 20260518_0011
Revises: 20260518_0010
Create Date: 2026-05-18 00:11:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260518_0011"
down_revision = "20260518_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "usersettings",
        sa.Column("membership_tier", sa.String(), nullable=False, server_default="free"),
    )
    op.add_column("usersettings", sa.Column("membership_expires_at", sa.DateTime(), nullable=True))
    op.alter_column("usersettings", "membership_tier", server_default=None)

    op.create_table(
        "aiusagelog",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("feature", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_aiusagelog_user_id"), "aiusagelog", ["user_id"], unique=False)
    op.create_index(op.f("ix_aiusagelog_feature"), "aiusagelog", ["feature"], unique=False)
    op.create_index(op.f("ix_aiusagelog_created_at"), "aiusagelog", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_aiusagelog_created_at"), table_name="aiusagelog")
    op.drop_index(op.f("ix_aiusagelog_feature"), table_name="aiusagelog")
    op.drop_index(op.f("ix_aiusagelog_user_id"), table_name="aiusagelog")
    op.drop_table("aiusagelog")
    op.drop_column("usersettings", "membership_expires_at")
    op.drop_column("usersettings", "membership_tier")
