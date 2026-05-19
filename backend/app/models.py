from datetime import datetime
from enum import Enum

from sqlmodel import Field, Relationship, SQLModel


def utc_now() -> datetime:
    return datetime.utcnow()


class ProgressStatus(str, Enum):
    new = "new"
    learning = "learning"
    reviewing = "reviewing"
    mastered = "mastered"


class StudyMode(str, Enum):
    en_to_cn = "en_to_cn"
    cn_to_en = "cn_to_en"
    listening = "listening"
    spelling = "spelling"


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    reset_token: str | None = Field(default=None, unique=True)
    reset_token_expires_at: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)

    progress: list["UserWordProgress"] = Relationship(back_populates="user")


class UserSettings(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True, index=True)
    daily_new_limit: int = 10
    daily_review_limit: int = 20
    default_study_mode: StudyMode = StudyMode.en_to_cn
    auto_play_word: bool = True
    auto_play_example: bool = True
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class WordBook(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    description: str = ""

    items: list["WordBookItem"] = Relationship(back_populates="word_book")


class Word(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    text: str = Field(index=True)
    phonetic: str | None = None
    meaning: str
    part_of_speech: str | None = None
    example_sentence: str | None = None
    example_translation: str | None = None
    note: str | None = None

    books: list["WordBookItem"] = Relationship(back_populates="word")
    progress: list["UserWordProgress"] = Relationship(back_populates="word")


class WordBookItem(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    word_book_id: int = Field(foreign_key="wordbook.id", index=True)
    word_id: int = Field(foreign_key="word.id", index=True)

    word_book: WordBook = Relationship(back_populates="items")
    word: Word = Relationship(back_populates="books")


class UserWordProgress(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    word_id: int = Field(foreign_key="word.id", index=True)
    word_book_id: int | None = Field(default=None, index=True)
    status: ProgressStatus = Field(default=ProgressStatus.new)
    mastery_level: int = 0
    easiness_factor: float = 2.5
    interval_days: float = 0
    correct_count: int = 0
    wrong_count: int = 0
    consecutive_correct: int = 0
    last_reviewed_at: datetime | None = None
    next_review_at: datetime = Field(default_factory=utc_now, index=True)
    is_leech: bool = False
    created_at: datetime = Field(default_factory=utc_now)

    user: User = Relationship(back_populates="progress")
    word: Word = Relationship(back_populates="progress")


class ReviewLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    word_id: int = Field(foreign_key="word.id", index=True)
    word_book_id: int | None = Field(default=None, index=True)
    study_mode: StudyMode = Field(default=StudyMode.en_to_cn)
    quality: int
    is_correct: bool
    created_at: datetime = Field(default_factory=utc_now)

    word: Word = Relationship()
