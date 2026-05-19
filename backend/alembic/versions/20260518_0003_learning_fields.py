"""learning fields

Revision ID: 20260518_0003
Revises: 20260518_0002
Create Date: 2026-05-18 00:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260518_0003"
down_revision: Union[str, None] = "20260518_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


study_mode = sa.Enum("en_to_cn", "cn_to_en", "listening", "spelling", name="studymode")


def upgrade() -> None:
    bind = op.get_bind()
    study_mode.create(bind, checkfirst=True)

    op.add_column("user", sa.Column("reset_token", sa.String(), nullable=True))
    op.add_column("user", sa.Column("reset_token_expires_at", sa.DateTime(), nullable=True))
    op.create_index(op.f("ix_user_reset_token"), "user", ["reset_token"], unique=True)

    op.add_column(
        "usersettings",
        sa.Column(
            "default_study_mode",
            study_mode,
            nullable=False,
            server_default="en_to_cn",
        ),
    )

    op.add_column("word", sa.Column("note", sa.String(), nullable=True))

    op.add_column("userwordprogress", sa.Column("word_book_id", sa.Integer(), nullable=True))
    op.add_column(
        "userwordprogress",
        sa.Column("easiness_factor", sa.Float(), nullable=False, server_default="2.5"),
    )
    op.add_column(
        "userwordprogress",
        sa.Column("consecutive_correct", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "userwordprogress",
        sa.Column("is_leech", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        op.f("ix_userwordprogress_word_book_id"),
        "userwordprogress",
        ["word_book_id"],
        unique=False,
    )

    op.add_column("reviewlog", sa.Column("word_book_id", sa.Integer(), nullable=True))
    op.add_column(
        "reviewlog",
        sa.Column("study_mode", study_mode, nullable=False, server_default="en_to_cn"),
    )
    op.create_index(op.f("ix_reviewlog_word_book_id"), "reviewlog", ["word_book_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_reviewlog_word_book_id"), table_name="reviewlog")
    op.drop_column("reviewlog", "study_mode")
    op.drop_column("reviewlog", "word_book_id")

    op.drop_index(op.f("ix_userwordprogress_word_book_id"), table_name="userwordprogress")
    op.drop_column("userwordprogress", "is_leech")
    op.drop_column("userwordprogress", "consecutive_correct")
    op.drop_column("userwordprogress", "easiness_factor")
    op.drop_column("userwordprogress", "word_book_id")

    op.drop_column("word", "note")

    op.drop_column("usersettings", "default_study_mode")

    op.drop_index(op.f("ix_user_reset_token"), table_name="user")
    op.drop_column("user", "reset_token_expires_at")
    op.drop_column("user", "reset_token")

    study_mode.drop(op.get_bind(), checkfirst=True)
