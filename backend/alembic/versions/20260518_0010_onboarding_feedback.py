"""onboarding settings and feedback

Revision ID: 20260518_0010
Revises: 20260518_0009
Create Date: 2026-05-18 00:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260518_0010"
down_revision = "20260518_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "usersettings",
        sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("usersettings", sa.Column("learning_goal", sa.String(), nullable=True))
    op.add_column("usersettings", sa.Column("english_level", sa.String(), nullable=True))
    op.add_column("usersettings", sa.Column("exam_type", sa.String(), nullable=True))
    op.add_column("usersettings", sa.Column("target_date", sa.String(), nullable=True))
    op.add_column(
        "usersettings",
        sa.Column("daily_minutes", sa.Integer(), nullable=False, server_default="20"),
    )
    op.add_column(
        "usersettings",
        sa.Column("wants_speaking", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "usersettings",
        sa.Column("wants_listening", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "usersettings",
        sa.Column("wants_ai_tutor", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "usersettings",
        sa.Column("reminder_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("usersettings", sa.Column("reminder_time", sa.String(), nullable=True))

    op.create_table(
        "feedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("contact", sa.String(), nullable=True),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_feedback_user_id"), "feedback", ["user_id"], unique=False)
    op.create_index(op.f("ix_feedback_category"), "feedback", ["category"], unique=False)
    op.create_index(op.f("ix_feedback_status"), "feedback", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_feedback_status"), table_name="feedback")
    op.drop_index(op.f("ix_feedback_category"), table_name="feedback")
    op.drop_index(op.f("ix_feedback_user_id"), table_name="feedback")
    op.drop_table("feedback")
    op.drop_column("usersettings", "reminder_time")
    op.drop_column("usersettings", "reminder_enabled")
    op.drop_column("usersettings", "wants_ai_tutor")
    op.drop_column("usersettings", "wants_listening")
    op.drop_column("usersettings", "wants_speaking")
    op.drop_column("usersettings", "daily_minutes")
    op.drop_column("usersettings", "target_date")
    op.drop_column("usersettings", "exam_type")
    op.drop_column("usersettings", "english_level")
    op.drop_column("usersettings", "learning_goal")
    op.drop_column("usersettings", "onboarding_completed")
