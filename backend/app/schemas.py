from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import ProgressStatus, SpeechAccent, StudyMode, UserRole


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


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class AccountDelete(BaseModel):
    password: str = Field(min_length=1)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: UserRole = UserRole.user


class AdminUserRoleUpdate(BaseModel):
    role: UserRole


class AdminOperationLogRead(BaseModel):
    id: int
    actor_user_id: int
    actor_email: str | None = None
    action: str
    target_type: str | None = None
    target_id: str | None = None
    detail: str | None = None
    created_at: datetime


class UserSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    daily_new_limit: int
    daily_review_limit: int
    default_study_mode: StudyMode = StudyMode.en_to_cn
    auto_play_word: bool = True
    auto_play_example: bool = True
    auto_reveal_after_audio: bool = False
    auto_advance: bool = True
    speech_accent: SpeechAccent = SpeechAccent.us
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


class UserSettingsUpdate(BaseModel):
    daily_new_limit: int | None = Field(default=None, ge=1, le=100)
    daily_review_limit: int | None = Field(default=None, ge=1, le=200)
    default_study_mode: StudyMode | None = None
    auto_play_word: bool | None = None
    auto_play_example: bool | None = None
    auto_reveal_after_audio: bool | None = None
    auto_advance: bool | None = None
    speech_accent: SpeechAccent | None = None
    answer_delay_ms: int | None = Field(default=None, ge=300, le=3000)
    word_book_page_size: int | None = Field(default=None, ge=10, le=100)
    onboarding_completed: bool | None = None
    learning_goal: str | None = Field(default=None, max_length=80)
    english_level: str | None = Field(default=None, max_length=80)
    exam_type: str | None = Field(default=None, max_length=80)
    target_date: str | None = Field(default=None, max_length=20)
    daily_minutes: int | None = Field(default=None, ge=5, le=240)
    wants_speaking: bool | None = None
    wants_listening: bool | None = None
    wants_ai_tutor: bool | None = None
    reminder_enabled: bool | None = None
    reminder_time: str | None = Field(default=None, max_length=20)
    membership_tier: str | None = Field(default=None, max_length=40)
    membership_expires_at: datetime | None = None


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
    english_definition: str | None = None
    root_affix: str | None = None
    collocations: str | None = None
    synonyms: str | None = None
    antonyms: str | None = None
    word_family: str | None = None
    confusing_words: str | None = None
    exam_tags: str | None = None
    difficulty_tag: str | None = None


class WordCreate(BaseModel):
    text: str = Field(min_length=1)
    meaning: str = Field(min_length=1)
    phonetic: str | None = None
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


class WordUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1)
    meaning: str | None = Field(default=None, min_length=1)
    phonetic: str | None = None
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


class WordBookRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    category: str = "通用"
    difficulty: str = "标准"
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
    category: str | None = None
    difficulty: str | None = None


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
    is_favorite: bool = False


class WordDetailRead(WordProgressRead):
    word_book_id: int | None = None


class WordBookImportResult(BaseModel):
    id: int
    title: str
    imported_count: int
    skipped_count: int = 0


class CSVPreviewWord(BaseModel):
    row_number: int
    word: str
    meaning: str
    phonetic: str | None = None
    part_of_speech: str | None = None
    example_sentence: str | None = None
    example_translation: str | None = None
    note: str | None = None
    duplicate_in_file: bool = False
    duplicate_in_database: bool = False


class CSVPreviewError(BaseModel):
    row_number: int
    message: str


class WordBookImportPreview(BaseModel):
    total_rows: int
    valid_count: int
    error_count: int
    duplicate_in_file_count: int
    duplicate_in_database_count: int
    words: list[CSVPreviewWord]
    errors: list[CSVPreviewError]


class StudyItem(BaseModel):
    progress_id: int
    word_book_id: int | None = None
    status: ProgressStatus
    mastery_level: int
    easiness_factor: float = 2.5
    interval_days: float = 0
    correct_count: int = 0
    wrong_count: int = 0
    last_mistake_type: str | None = None
    last_reviewed_at: datetime | None = None
    next_review_at: datetime | None = None
    is_leech: bool = False
    mistake_type: str | None = None
    is_favorite: bool = False
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
    mistake_type: str | None = None
    created_at: datetime


class DailyActivity(BaseModel):
    date: str
    reviews: int
    correct: int


class StatsOverview(BaseModel):
    total_learning: int
    mastered: int
    mastered_rate: int = 0
    mistakes: int
    leeches: int = 0
    due_today: int
    due_new: int
    due_review: int
    available_new: int = 0
    available_review: int = 0
    daily_new_limit: int = 10
    daily_review_limit: int = 20
    new_completed_today: int = 0
    review_completed_today: int = 0
    completed_today: int
    total_reviews: int = 0
    correct_reviews: int = 0
    correct_rate: int
    weekly_reviews: int = 0
    weekly_correct_rate: int = 0
    active_days_30: int = 0
    streak_days: int
    activity: list[DailyActivity]
    monthly_activity: list[DailyActivity] = []


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int


class DataImportResult(BaseModel):
    progress_imported: int = 0
    logs_imported: int = 0
    favorites_imported: int = 0
    settings_imported: bool = False


class FeedbackCreate(BaseModel):
    category: str = Field(default="general", max_length=40)
    contact: str | None = Field(default=None, max_length=120)
    content: str = Field(min_length=5, max_length=2000)


class FeedbackRead(BaseModel):
    id: int
    category: str
    contact: str | None = None
    content: str
    status: str
    created_at: datetime


class ContentReportCreate(BaseModel):
    source_type: str = Field(default="ai", max_length=40)
    source_id: str | None = Field(default=None, max_length=80)
    reason: str = Field(default="inaccurate", max_length=80)
    content: str = Field(min_length=1, max_length=4000)


class ContentReportUpdate(BaseModel):
    status: str
    review_note: str | None = Field(default=None, max_length=1000)


class ContentReportRead(BaseModel):
    id: int
    user_id: int
    user_email: str | None = None
    source_type: str
    source_id: str | None = None
    reason: str
    content: str
    status: str
    reviewer_user_id: int | None = None
    review_note: str | None = None
    created_at: datetime
    updated_at: datetime


class MembershipRead(BaseModel):
    tier: str
    is_member: bool
    expires_at: datetime | None = None
    daily_ai_limit: int
    ai_used_today: int
    ai_remaining_today: int


class MembershipPlanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    description: str
    price_cents: int
    duration_days: int
    ai_daily_limit: int
    is_active: bool
    is_recommended: bool
    created_at: datetime


class MembershipOrderCreate(BaseModel):
    plan_id: int


class MembershipOrderRead(BaseModel):
    id: int
    order_no: str
    user_id: int
    user_email: str | None = None
    plan_id: int
    plan_name: str
    amount_cents: int
    status: str
    paid_at: datetime | None = None
    created_at: datetime


class LearningPlanRead(BaseModel):
    learning_goal: str | None = None
    english_level: str | None = None
    target_date: str | None = None
    daily_minutes: int
    daily_new_limit: int
    daily_review_limit: int
    total_words: int
    studied_words: int
    mastered_words: int
    remaining_words: int
    overall_completion_rate: int
    today_completion_rate: int
    days_left: int | None = None
    estimated_finish_days: int | None = None
    recommended_daily_new_limit: int
    risk_level: str
    risk_message: str
    current_books: list[WordBookProgressRead]


class CheckInBadgeRead(BaseModel):
    code: str
    title: str
    description: str
    earned: bool
    progress: int
    target: int


class CheckInStatusRead(BaseModel):
    checked_in_today: bool
    can_check_in: bool
    remaining_tasks: int
    completed_today: int
    today_progress_rate: int
    streak_days: int
    active_days_30: int
    total_learning_days: int
    total_reviews: int
    correct_rate: int
    mastered_words: int
    badges: list[CheckInBadgeRead]


class LearningReportFocusRead(BaseModel):
    word_id: int
    text: str
    meaning: str
    wrong_count: int
    correct_count: int
    mastery_level: int
    mistake_type: str | None = None


class LearningReportRead(BaseModel):
    summary: str
    total_learning: int
    mastered: int
    mastered_rate: int
    mistakes: int
    leeches: int
    total_reviews: int
    correct_rate: int
    weekly_reviews: int
    weekly_correct_rate: int
    streak_days: int
    active_days_30: int
    today_completed: int
    today_remaining: int
    strengths: list[str]
    weaknesses: list[str]
    recommendations: list[str]
    focus_words: list[LearningReportFocusRead]
    weak_question_types: list[str] = []
    suggested_review_count: int = 0
    activity: list[DailyActivity]


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


class AIMistakeAnalysisCreate(BaseModel):
    word_ids: list[int] = Field(default_factory=list, max_length=50)
    content: str = Field(min_length=1, max_length=12000)
    source: str = Field(default="ai", max_length=30)


class AIMistakeAnalysisRead(BaseModel):
    id: int
    word_ids: list[int]
    word_count: int
    content: str
    source: str
    created_at: datetime


class AISavedExampleCreate(BaseModel):
    word_id: int
    sentence: str = Field(min_length=1, max_length=1000)
    translation: str | None = Field(default=None, max_length=1000)
    raw_content: str | None = Field(default=None, max_length=4000)
    source: str = Field(default="ai", max_length=30)


class AISavedExampleRead(BaseModel):
    id: int
    word_id: int
    sentence: str
    translation: str | None = None
    raw_content: str | None = None
    source: str
    created_at: datetime


class AIQuizQuestionRead(BaseModel):
    id: str
    type: str
    prompt: str
    options: list[str] = []
    answer: str
    explanation: str
    related_word: str | None = None


class AIQuizStructuredResponse(BaseModel):
    questions: list[AIQuizQuestionRead]


class AIQuestionAttemptCreate(BaseModel):
    answer: str = Field(min_length=1, max_length=1000)


class AIQuestionAttemptRead(BaseModel):
    id: int
    question_id: int
    answer: str
    is_correct: bool
    created_at: datetime


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    title: str
    content: str
    action_url: str | None = None
    scheduled_at: datetime | None = None
    read_at: datetime | None = None
    created_at: datetime


class NotificationSummary(BaseModel):
    unread_count: int
    items: list[NotificationRead]


class ListeningQuestionRead(BaseModel):
    id: str
    word_id: int
    word_book_id: int | None = None
    audio_text: str
    phonetic: str | None = None
    options: list[str]


class ListeningAnswerCreate(BaseModel):
    word_id: int
    selected_meaning: str = Field(min_length=1, max_length=1000)
    word_book_id: int | None = None


class ListeningAnswerResult(BaseModel):
    word_id: int
    is_correct: bool
    correct_answer: str
    explanation: str
    progress: AnswerResult


class SpeakingPromptRead(BaseModel):
    word_id: int
    word_text: str
    phonetic: str | None = None
    meaning: str
    prompt_text: str
    translation: str | None = None


class SpeakingAttemptCreate(BaseModel):
    word_id: int
    prompt_text: str = Field(min_length=1, max_length=1000)
    transcript: str = Field(min_length=1, max_length=1000)


class SpeakingAttemptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    word_id: int
    prompt_text: str
    transcript: str
    accuracy_score: int
    feedback: str
    created_at: datetime


class ReadingKnownWordRead(BaseModel):
    word_id: int
    text: str
    meaning: str
    mastery_level: int


class ReadingArticleRead(BaseModel):
    id: int
    title: str
    category: str
    level: str
    content: str
    translation: str | None = None
    audio_text: str | None = None
    created_at: datetime
    completed: bool
    known_words: list[ReadingKnownWordRead]


class ReadingCompleteCreate(BaseModel):
    reading_seconds: int = Field(default=0, ge=0, le=86400)


class ReadingProgressRead(BaseModel):
    id: int
    article_id: int
    completed_at: datetime
    reading_seconds: int


class WritingPromptRead(BaseModel):
    prompt: str
    keyword: str | None = None
    meaning: str | None = None


class WritingSubmissionCreate(BaseModel):
    prompt: str = Field(min_length=1, max_length=1000)
    content: str = Field(min_length=1, max_length=5000)


class WritingSubmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    prompt: str
    content: str
    score: int
    feedback: str
    created_at: datetime
