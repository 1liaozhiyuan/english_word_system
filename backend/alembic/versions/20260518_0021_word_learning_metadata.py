"""add word learning metadata

Revision ID: 20260518_0021
Revises: 20260518_0020
Create Date: 2026-05-18 00:21:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = "20260518_0021"
down_revision: Union[str, None] = "20260518_0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


WORD_METADATA_COLUMNS = [
    "english_definition",
    "root_affix",
    "collocations",
    "synonyms",
    "antonyms",
    "word_family",
    "confusing_words",
    "exam_tags",
    "difficulty_tag",
]


def upgrade() -> None:
    for column_name in WORD_METADATA_COLUMNS:
        op.add_column(
            "word",
            sa.Column(column_name, sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        )


def downgrade() -> None:
    for column_name in reversed(WORD_METADATA_COLUMNS):
        op.drop_column("word", column_name)
