"""initial schema

Revision ID: 20260518_0001
Revises:
Create Date: 2026-05-18 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260518_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


progress_status = sa.Enum("new", "learning", "reviewing", "mastered", name="progressstatus")


def upgrade() -> None:
    op.create_table(
        "user",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_email"), "user", ["email"], unique=True)

    op.create_table(
        "wordbook",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "word",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("text", sa.String(), nullable=False),
        sa.Column("phonetic", sa.String(), nullable=True),
        sa.Column("meaning", sa.String(), nullable=False),
        sa.Column("part_of_speech", sa.String(), nullable=True),
        sa.Column("example_sentence", sa.String(), nullable=True),
        sa.Column("example_translation", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_word_text"), "word", ["text"], unique=False)

    op.create_table(
        "reviewlog",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("word_id", sa.Integer(), nullable=False),
        sa.Column("quality", sa.Integer(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["word_id"], ["word.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reviewlog_user_id"), "reviewlog", ["user_id"], unique=False)
    op.create_index(op.f("ix_reviewlog_word_id"), "reviewlog", ["word_id"], unique=False)

    op.create_table(
        "userwordprogress",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("word_id", sa.Integer(), nullable=False),
        sa.Column("status", progress_status, nullable=False),
        sa.Column("mastery_level", sa.Integer(), nullable=False),
        sa.Column("correct_count", sa.Integer(), nullable=False),
        sa.Column("wrong_count", sa.Integer(), nullable=False),
        sa.Column("last_reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("next_review_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["word_id"], ["word.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_userwordprogress_next_review_at"), "userwordprogress", ["next_review_at"], unique=False)
    op.create_index(op.f("ix_userwordprogress_user_id"), "userwordprogress", ["user_id"], unique=False)
    op.create_index(op.f("ix_userwordprogress_word_id"), "userwordprogress", ["word_id"], unique=False)

    op.create_table(
        "wordbookitem",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("word_book_id", sa.Integer(), nullable=False),
        sa.Column("word_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["word_book_id"], ["wordbook.id"]),
        sa.ForeignKeyConstraint(["word_id"], ["word.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_wordbookitem_word_book_id"), "wordbookitem", ["word_book_id"], unique=False)
    op.create_index(op.f("ix_wordbookitem_word_id"), "wordbookitem", ["word_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_wordbookitem_word_id"), table_name="wordbookitem")
    op.drop_index(op.f("ix_wordbookitem_word_book_id"), table_name="wordbookitem")
    op.drop_table("wordbookitem")

    op.drop_index(op.f("ix_userwordprogress_word_id"), table_name="userwordprogress")
    op.drop_index(op.f("ix_userwordprogress_user_id"), table_name="userwordprogress")
    op.drop_index(op.f("ix_userwordprogress_next_review_at"), table_name="userwordprogress")
    op.drop_table("userwordprogress")

    op.drop_index(op.f("ix_reviewlog_word_id"), table_name="reviewlog")
    op.drop_index(op.f("ix_reviewlog_user_id"), table_name="reviewlog")
    op.drop_table("reviewlog")

    op.drop_index(op.f("ix_word_text"), table_name="word")
    op.drop_table("word")

    op.drop_table("wordbook")

    op.drop_index(op.f("ix_user_email"), table_name="user")
    op.drop_table("user")

    progress_status.drop(op.get_bind(), checkfirst=True)
