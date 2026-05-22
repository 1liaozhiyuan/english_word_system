from datetime import datetime
from enum import Enum

from sqlalchemy import Column
from sqlalchemy import Enum as SAEnum
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


class SpeechAccent(str, Enum):
    us = "en-US"
    uk = "en-GB"


class UserRole(str, Enum):
    user = "user"
    admin = "admin"
    operator = "operator"
    reviewer = "reviewer"


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    role: UserRole = Field(default=UserRole.user)
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
    auto_reveal_after_audio: bool = False
    auto_advance: bool = True
    speech_accent: SpeechAccent = Field(
        default=SpeechAccent.us,
        sa_column=Column(
            SAEnum(
                SpeechAccent,
                values_callable=lambda enum_class: [item.value for item in enum_class],
            ),
            nullable=False,
        ),
    )
    answer_delay_ms: int = 800
    word_book_page_size: int = 30
    onboarding_completed: bool = False
    learning_goal: str | None = None
    english_level: str | None = None
    exam_type: str | None = None
    target_date: str | None = None
    daily_minutes: int = 20
    wants_speaking: bool = False
    wants_listening: bool = False
    wants_ai_tutor: bool = True
    reminder_enabled: bool = False
    reminder_time: str | None = None
    membership_tier: str = "free"
    membership_expires_at: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class WordBook(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    description: str = ""
    category: str = "通用"
    difficulty: str = "标准"

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
    english_definition: str | None = None
    root_affix: str | None = None
    collocations: str | None = None
    synonyms: str | None = None
    antonyms: str | None = None
    word_family: str | None = None
    confusing_words: str | None = None
    exam_tags: str | None = None
    difficulty_tag: str | None = None

    books: list["WordBookItem"] = Relationship(back_populates="word")
    progress: list["UserWordProgress"] = Relationship(back_populates="word")
    favorites: list["FavoriteWord"] = Relationship(back_populates="word")


class FavoriteWord(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    word_id: int = Field(foreign_key="word.id", index=True)
    created_at: datetime = Field(default_factory=utc_now)

    word: Word = Relationship(back_populates="favorites")


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
    last_mistake_type: str | None = Field(default=None, index=True)
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
    mistake_type: str | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utc_now)

    word: Word = Relationship()


class Feedback(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    category: str = Field(default="general", index=True)
    contact: str | None = None
    content: str
    status: str = Field(default="open", index=True)
    created_at: datetime = Field(default_factory=utc_now)


class AIUsageLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    feature: str = Field(default="ai", index=True)
    created_at: datetime = Field(default_factory=utc_now, index=True)


class AISavedExample(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    word_id: int = Field(foreign_key="word.id", index=True)
    sentence: str
    translation: str | None = None
    raw_content: str | None = None
    source: str = Field(default="ai", index=True)
    created_at: datetime = Field(default_factory=utc_now, index=True)

    word: Word = Relationship()


class AIMistakeAnalysis(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    word_ids_json: str = "[]"
    word_count: int = Field(default=0, index=True)
    content: str
    source: str = Field(default="ai", index=True)
    created_at: datetime = Field(default_factory=utc_now, index=True)


class AdminOperationLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    actor_user_id: int = Field(foreign_key="user.id", index=True)
    action: str = Field(index=True)
    target_type: str | None = Field(default=None, index=True)
    target_id: str | None = Field(default=None, index=True)
    detail: str | None = None
    created_at: datetime = Field(default_factory=utc_now, index=True)


class AIQuestion(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    word_id: int | None = Field(default=None, foreign_key="word.id", index=True)
    question_type: str = Field(index=True)
    prompt: str
    options_json: str = "[]"
    answer: str
    explanation: str = ""
    related_word: str | None = Field(default=None, index=True)
    source: str = Field(default="ai", index=True)
    created_at: datetime = Field(default_factory=utc_now, index=True)

    word: Word | None = Relationship()


class AIQuestionAttempt(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    question_id: int = Field(foreign_key="aiquestion.id", index=True)
    answer: str
    is_correct: bool = Field(index=True)
    created_at: datetime = Field(default_factory=utc_now, index=True)

    question: AIQuestion = Relationship()


class Notification(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    type: str = Field(index=True)
    title: str
    content: str
    action_url: str | None = None
    scheduled_at: datetime | None = Field(default=None, index=True)
    read_at: datetime | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utc_now, index=True)


class MembershipPlan(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    code: str = Field(unique=True, index=True)
    name: str
    description: str = ""
    price_cents: int = 0
    duration_days: int = 30
    ai_daily_limit: int = 100
    is_active: bool = Field(default=True, index=True)
    is_recommended: bool = False
    created_at: datetime = Field(default_factory=utc_now, index=True)


class Order(SQLModel, table=True):
    __tablename__ = "membershiporder"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    plan_id: int = Field(foreign_key="membershipplan.id", index=True)
    order_no: str = Field(unique=True, index=True)
    amount_cents: int = 0
    status: str = Field(default="pending", index=True)
    paid_at: datetime | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utc_now, index=True)

    user: User = Relationship()
    plan: MembershipPlan = Relationship()


class SpeakingAttempt(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    word_id: int = Field(foreign_key="word.id", index=True)
    prompt_text: str
    transcript: str
    accuracy_score: int = Field(default=0, index=True)
    feedback: str = ""
    created_at: datetime = Field(default_factory=utc_now, index=True)

    word: Word = Relationship()


class ContentReport(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    source_type: str = Field(default="ai", index=True)
    source_id: str | None = Field(default=None, index=True)
    reason: str = Field(default="inaccurate", index=True)
    content: str
    status: str = Field(default="open", index=True)
    reviewer_user_id: int | None = Field(default=None, foreign_key="user.id", index=True)
    review_note: str | None = None
    created_at: datetime = Field(default_factory=utc_now, index=True)
    updated_at: datetime = Field(default_factory=utc_now, index=True)


class ReadingArticle(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    category: str = Field(default="daily", index=True)
    level: str = Field(default="A2", index=True)
    content: str
    translation: str | None = None
    audio_text: str | None = None
    created_at: datetime = Field(default_factory=utc_now, index=True)


class ReadingProgress(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    article_id: int = Field(foreign_key="readingarticle.id", index=True)
    completed_at: datetime = Field(default_factory=utc_now, index=True)
    reading_seconds: int = 0

    article: ReadingArticle = Relationship()


class WritingSubmission(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    prompt: str
    content: str
    score: int = Field(default=0, index=True)
    feedback: str = ""
    created_at: datetime = Field(default_factory=utc_now, index=True)
