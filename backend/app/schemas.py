from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import ProgressStatus, StudyMode


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordReset(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str


class UserSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    daily_new_limit: int
    daily_review_limit: int
    default_study_mode: StudyMode = StudyMode.en_to_cn
    auto_play_word: bool = True
    auto_play_example: bool = True


class UserSettingsUpdate(BaseModel):
    daily_new_limit: int | None = Field(default=None, ge=1, le=100)
    daily_review_limit: int | None = Field(default=None, ge=1, le=200)
    default_study_mode: StudyMode | None = None
    auto_play_word: bool | None = None
    auto_play_example: bool | None = None


class WordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    phonetic: str | None
    meaning: str
    part_of_speech: str | None
    example_sentence: str | None
    example_translation: str | None
    note: str | None = None


class WordCreate(BaseModel):
    text: str = Field(min_length=1)
    meaning: str = Field(min_length=1)
    phonetic: str | None = None
    part_of_speech: str | None = None
    example_sentence: str | None = None
    example_translation: str | None = None
    note: str | None = None


class WordUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1)
    meaning: str | None = Field(default=None, min_length=1)
    phonetic: str | None = None
    part_of_speech: str | None = None
    example_sentence: str | None = None
    example_translation: str | None = None
    note: str | None = None


class WordBookRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    word_count: int


class WordBookProgressRead(WordBookRead):
    added_count: int
    studied_count: int
    learning_count: int
    mastered_count: int
    mistake_count: int
    completion_rate: int


class WordBookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1)
    description: str | None = None


class WordBookDetail(WordBookRead):
    words: list[WordRead]


class WordProgressRead(BaseModel):
    word: WordRead
    status: ProgressStatus | None
    mastery_level: int
    easiness_factor: float = 2.5
    interval_days: float = 0
    correct_count: int
    wrong_count: int
    last_reviewed_at: datetime | None
    next_review_at: datetime | None
    is_leech: bool = False


class WordBookImportResult(BaseModel):
    id: int
    title: str
    imported_count: int


class StudyItem(BaseModel):
    progress_id: int
    word_book_id: int | None = None
    status: ProgressStatus
    mastery_level: int
    easiness_factor: float = 2.5
    interval_days: float = 0
    is_leech: bool = False
    word: WordRead


class AnswerCreate(BaseModel):
    word_id: int
    quality: int = Field(ge=0, le=3, description="0 wrong, 1 hard, 2 good, 3 easy")
    study_mode: StudyMode = StudyMode.en_to_cn
    word_book_id: int | None = None


class AnswerResult(BaseModel):
    word_id: int
    status: ProgressStatus
    mastery_level: int
    easiness_factor: float
    interval_days: float
    next_review_at: datetime
    is_leech: bool = False


class ReviewLogRead(BaseModel):
    id: int
    word_id: int
    word_text: str
    word: WordRead | None = None
    quality: int
    is_correct: bool
    study_mode: StudyMode
    created_at: datetime


class DailyActivity(BaseModel):
    date: str
    reviews: int
    correct: int


class StatsOverview(BaseModel):
    total_learning: int
    mastered: int
    mistakes: int
    leeches: int = 0
    due_today: int
    due_new: int
    due_review: int
    completed_today: int
    correct_rate: int
    streak_days: int
    activity: list[DailyActivity]


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int


class BatchDeleteWords(BaseModel):
    word_ids: list[int] = Field(min_length=1, max_length=500)


class BatchDeleteWordBooks(BaseModel):
    word_book_ids: list[int] = Field(min_length=1, max_length=500)


class BatchMoveWords(BaseModel):
    word_ids: list[int] = Field(min_length=1, max_length=500)
    target_word_book_id: int


class AIWordPayload(BaseModel):
    word: WordRead


class AIExamplePayload(BaseModel):
    word: WordRead
    level: str = Field(default="中等", max_length=20)


class AIMistakePayload(BaseModel):
    words: list[WordRead] = Field(default_factory=list, max_length=30)


class AIQuizPayload(BaseModel):
    words: list[WordRead] = Field(default_factory=list, max_length=30)
    quiz_type: str = Field(default="混合测试", max_length=30)


class AITextResponse(BaseModel):
    content: str
