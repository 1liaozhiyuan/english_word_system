from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from app.ai_service import (
    analyze_mistakes_prompt,
    call_ai,
    ensure_ai_configured,
    explain_word_prompt,
    generate_example_prompt,
    generate_quiz_prompt,
    generate_structured_quiz_prompt,
    parse_structured_quiz,
    stream_ai,
)
from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import engine, get_session
from app.dependencies import get_current_user, require_admin
from app.models import User
from app.models import UserWordProgress
from app.schemas import (
    AccountDelete,
    AnswerCreate,
    AnswerResult,
    AIExamplePayload,
    AIMistakeAnalysisCreate,
    AIMistakeAnalysisRead,
    AIMistakePayload,
    AIQuestionAttemptCreate,
    AIQuestionAttemptRead,
    AdminOperationLogRead,
    AdminUserRoleUpdate,
    AIQuizPayload,
    AIQuizStructuredResponse,
    AISavedExampleCreate,
    AISavedExampleRead,
    AITextResponse,
    AIWordPayload,
    BatchDeleteWordBooks,
    BatchDeleteWords,
    BatchMoveWords,
    CheckInStatusRead,
    ContentReportCreate,
    ContentReportRead,
    ContentReportUpdate,
    DataImportResult,
    FeedbackCreate,
    FeedbackRead,
    LearningPlanRead,
    LearningReportRead,
    ListeningAnswerCreate,
    ListeningAnswerResult,
    ListeningQuestionRead,
    MembershipOrderCreate,
    MembershipOrderRead,
    MembershipPlanRead,
    MembershipRead,
    NotificationRead,
    NotificationSummary,
    PasswordChange,
    PasswordReset,
    PasswordResetRequest,
    ReadingArticleRead,
    ReadingCompleteCreate,
    ReadingProgressRead,
    ReviewLogRead,
    SpeakingAttemptCreate,
    SpeakingAttemptRead,
    SpeakingPromptRead,
    StatsOverview,
    StudyItem,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserRead,
    UserSettingsRead,
    UserSettingsUpdate,
    WordCreate,
    WordBookDetail,
    WordBookImportPreview,
    WordBookImportResult,
    WordBookProgressRead,
    WordBookRead,
    WordBookUpdate,
    WordDetailRead,
    WordProgressRead,
    WordRead,
    WordUpdate,
    WritingPromptRead,
    WritingSubmissionCreate,
    WritingSubmissionRead,
)
from app.services import (
    add_word_to_book,
    answer_word,
    answer_listening_question,
    authenticate_user,
    batch_delete_word_books,
    batch_delete_words,
    batch_move_words,
    activate_demo_membership,
    change_password,
    create_feedback,
    create_admin_operation_log,
    create_content_report,
    create_demo_membership_order,
    delete_user_account,
    delete_ai_example,
    delete_word_book,
    export_user_anki_tsv,
    export_user_data,
    export_word_book_csv,
    complete_reading_article,
    ensure_default_reading_articles,
    get_due_study_items,
    favorite_word,
    get_favorite_words_paginated,
    get_due_new_items,
    get_due_review_items,
    get_admin_overview,
    get_check_in_status,
    get_learning_plan,
    get_learning_report,
    get_listening_questions,
    get_mistakes,
    get_mistakes_paginated,
    get_membership_status,
    get_or_create_user_settings,
    get_review_history,
    get_review_history_paginated,
    get_reading_article,
    get_speaking_prompts,
    get_stats,
    get_word_book_progress_summary,
    get_word_book_with_count,
    get_word_detail_for_user,
    get_writing_prompts,
    import_user_data,
    import_word_book_from_csv,
    parse_word_book_csv,
    list_word_book_progress,
    list_word_book_word_progress_paginated,
    list_word_book_word_progress,
    list_word_book_words,
    list_word_books,
    list_word_books_paginated,
    list_admin_ai_usage,
    list_admin_feedback,
    list_admin_operation_logs,
    list_admin_orders,
    list_admin_content_reports,
    list_admin_users,
    list_membership_plans,
    list_notifications,
    list_reading_articles,
    list_speaking_attempts,
    list_user_orders,
    mark_notification_read,
    register_user,
    record_ai_usage,
    remove_word_from_book,
    request_password_reset,
    reset_password,
    resolve_mistake,
    schedule_mistake_practice,
    schedule_mistake_practice_batch,
    search_word_book_words,
    seed_demo_data,
    select_word_book,
    submit_speaking_attempt,
    submit_writing,
    list_writing_submissions,
    list_ai_examples_for_word,
    list_mistake_analyses,
    save_ai_example,
    save_mistake_analysis,
    save_ai_questions,
    serialize_mistake_analysis,
    record_ai_question_attempt,
    update_word_book,
    update_word,
    update_user_settings,
    update_feedback_status,
    update_content_report_status,
    update_admin_user_role,
    is_favorite_word,
    unfavorite_word,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    with Session(engine) as session:
        seed_demo_data(session)
        ensure_default_reading_articles(session)
    yield


app = FastAPI(title="English Word System", lifespan=lifespan)

cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def build_study_item(item: UserWordProgress) -> StudyItem:
    return StudyItem(
        progress_id=item.id,
        word_book_id=item.word_book_id,
        status=item.status,
        mastery_level=item.mastery_level,
        easiness_factor=item.easiness_factor,
        interval_days=item.interval_days,
        correct_count=item.correct_count,
        wrong_count=item.wrong_count,
        last_mistake_type=item.last_mistake_type,
        last_reviewed_at=item.last_reviewed_at,
        next_review_at=item.next_review_at,
        is_leech=item.is_leech,
        word=item.word,
    )


def build_study_item_for_user(session: Session, user: User, item: UserWordProgress) -> StudyItem:
    study_item = build_study_item(item)
    study_item.is_favorite = is_favorite_word(session, user, item.word_id)
    return study_item


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ── Auth ──

@app.post("/auth/register", response_model=TokenResponse)
def register(payload: UserCreate, session: Session = Depends(get_session)) -> TokenResponse:
    user = register_user(session, payload.email, payload.password)
    return TokenResponse(access_token=create_access_token(str(user.id)))


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: UserLogin, session: Session = Depends(get_session)) -> TokenResponse:
    user = authenticate_user(session, payload.email, payload.password)
    return TokenResponse(access_token=create_access_token(str(user.id)))


@app.post("/auth/forgot-password")
def forgot_password(
    payload: PasswordResetRequest, session: Session = Depends(get_session)
) -> dict[str, str]:
    token = request_password_reset(session, payload.email)
    response = {"message": "If the account exists, a reset link has been prepared."}
    if token and settings.expose_reset_token_in_response:
        response["reset_token"] = token
    return response


@app.post("/auth/reset-password", response_model=TokenResponse)
def do_reset_password(
    payload: PasswordReset, session: Session = Depends(get_session)
) -> TokenResponse:
    user = reset_password(session, payload.token, payload.new_password)
    return TokenResponse(access_token=create_access_token(str(user.id)))


@app.post("/auth/change-password")
def do_change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    change_password(session, current_user, payload.current_password, payload.new_password)
    return {"status": "password_changed"}


@app.delete("/auth/account")
def delete_account(
    payload: AccountDelete,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    delete_user_account(session, current_user, payload.password)
    return {"status": "account_deleted"}


@app.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead(id=current_user.id, email=current_user.email, role=current_user.role)


# ── Settings ──

@app.get("/settings", response_model=UserSettingsRead)
def read_settings(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> UserSettingsRead:
    return get_or_create_user_settings(session, current_user)


@app.patch("/settings", response_model=UserSettingsRead)
def patch_settings(
    payload: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> UserSettingsRead:
    return update_user_settings(
        session,
        current_user,
        payload.daily_new_limit,
        payload.daily_review_limit,
        payload.default_study_mode,
        payload.auto_play_word,
        payload.auto_play_example,
        payload.auto_reveal_after_audio,
        payload.auto_advance,
        payload.speech_accent,
        payload.answer_delay_ms,
        payload.word_book_page_size,
        payload.onboarding_completed,
        payload.learning_goal,
        payload.english_level,
        payload.exam_type,
        payload.target_date,
        payload.daily_minutes,
        payload.wants_speaking,
        payload.wants_listening,
        payload.wants_ai_tutor,
        payload.reminder_enabled,
        payload.reminder_time,
        payload.membership_tier,
        payload.membership_expires_at,
    )


@app.post("/feedback", response_model=FeedbackRead)
def submit_feedback(
    payload: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FeedbackRead:
    return create_feedback(
        session,
        current_user,
        payload.category,
        payload.content,
        payload.contact,
    )


@app.post("/content-reports", response_model=ContentReportRead)
def submit_content_report(
    payload: ContentReportCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ContentReportRead:
    report = create_content_report(
        session,
        current_user,
        payload.source_type,
        payload.content,
        payload.reason,
        payload.source_id,
    )
    return ContentReportRead(
        id=report.id,
        user_id=report.user_id,
        user_email=current_user.email,
        source_type=report.source_type,
        source_id=report.source_id,
        reason=report.reason,
        content=report.content,
        status=report.status,
        reviewer_user_id=report.reviewer_user_id,
        review_note=report.review_note,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@app.get("/membership/status", response_model=MembershipRead)
def membership_status(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MembershipRead:
    return MembershipRead(**get_membership_status(session, current_user))


@app.get("/membership/plans", response_model=list[MembershipPlanRead])
def membership_plans(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[MembershipPlanRead]:
    return list_membership_plans(session)


@app.get("/membership/orders", response_model=list[MembershipOrderRead])
def membership_orders(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[MembershipOrderRead]:
    return list_user_orders(session, current_user)


@app.post("/membership/orders/demo-pay", response_model=MembershipOrderRead)
def membership_demo_pay(
    payload: MembershipOrderCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MembershipOrderRead:
    order = create_demo_membership_order(session, current_user, payload.plan_id)
    return list_user_orders(session, current_user)[0]


@app.post("/membership/orders/checkout", response_model=MembershipOrderRead)
def membership_checkout(
    payload: MembershipOrderCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MembershipOrderRead:
    create_demo_membership_order(session, current_user, payload.plan_id)
    return list_user_orders(session, current_user)[0]


@app.post("/membership/demo-upgrade", response_model=MembershipRead)
def membership_demo_upgrade(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MembershipRead:
    activate_demo_membership(session, current_user)
    return MembershipRead(**get_membership_status(session, current_user))


# ─── Admin ───

@app.get("/admin/overview")
def admin_overview(
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    return get_admin_overview(session)


@app.get("/admin/users")
def admin_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str = Query(default="", min_length=0),
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    return list_admin_users(session, page, page_size, q)


@app.get("/admin/word-books")
def admin_word_books(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str = Query(default="", min_length=0),
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    return list_word_books_paginated(session, page, page_size, q)


@app.get("/admin/feedback")
def admin_feedback(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: str = Query(default="all"),
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    return list_admin_feedback(session, page, page_size, status_filter)


@app.patch("/admin/feedback/{feedback_id}")
def admin_feedback_status(
    feedback_id: int,
    status: str = Query(...),
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    feedback = update_feedback_status(session, feedback_id, status)
    create_admin_operation_log(session, current_user, "update_feedback_status", "feedback", feedback_id, status)
    return {"id": feedback.id, "status": feedback.status}


@app.get("/admin/ai-usage")
def admin_ai_usage(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    return list_admin_ai_usage(session, page, page_size)


@app.patch("/admin/users/{user_id}/role", response_model=UserRead)
def admin_update_user_role(
    user_id: int,
    payload: AdminUserRoleUpdate,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> UserRead:
    user = update_admin_user_role(session, current_user, user_id, payload.role)
    return UserRead(id=user.id, email=user.email, role=user.role)


@app.get("/admin/operation-logs")
def admin_operation_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    return list_admin_operation_logs(session, page, page_size)


@app.get("/admin/orders")
def admin_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    return list_admin_orders(session, page, page_size)


@app.get("/admin/membership-plans", response_model=list[MembershipPlanRead])
def admin_membership_plans(
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> list[MembershipPlanRead]:
    return list_membership_plans(session, active_only=False)


@app.get("/admin/content-reports")
def admin_content_reports(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: str = Query(default="all"),
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    return list_admin_content_reports(session, page, page_size, status_filter)


@app.patch("/admin/content-reports/{report_id}", response_model=ContentReportRead)
def admin_update_content_report(
    report_id: int,
    payload: ContentReportUpdate,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ContentReportRead:
    report = update_content_report_status(
        session,
        current_user,
        report_id,
        payload.status,
        payload.review_note,
    )
    return ContentReportRead(
        id=report.id,
        user_id=report.user_id,
        user_email=None,
        source_type=report.source_type,
        source_id=report.source_id,
        reason=report.reason,
        content=report.content,
        status=report.status,
        reviewer_user_id=report.reviewer_user_id,
        review_note=report.review_note,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


# ── Word Books ──

@app.get("/word-books", response_model=list[WordBookRead])
def word_books(session: Session = Depends(get_session)) -> list[WordBookRead]:
    return [
        WordBookRead(
            id=book.id,
            title=book.title,
            description=book.description,
            category=book.category,
            difficulty=book.difficulty,
            word_count=count,
        )
        for book, count in list_word_books(session)
    ]


@app.get("/word-books-paginated")
def word_books_paginated(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str = Query(default="", min_length=0),
    session: Session = Depends(get_session),
) -> dict:
    return list_word_books_paginated(session, page, page_size, q)


@app.get("/word-books/progress", response_model=list[WordBookProgressRead])
def word_books_progress(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[WordBookProgressRead]:
    return [WordBookProgressRead(**item) for item in list_word_book_progress(session, current_user)]


@app.get("/word-books/progress-paginated")
def word_books_progress_paginated(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str = Query(default="", min_length=0),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    return list_word_book_progress(session, current_user, page, page_size, q)


@app.post("/word-books/batch-delete")
def batch_delete_word_books_endpoint(
    payload: BatchDeleteWordBooks,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, int]:
    return {"deleted": batch_delete_word_books(session, payload.word_book_ids)}


@app.get("/word-books/{word_book_id}", response_model=WordBookDetail)
def word_book_detail(
    word_book_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> WordBookDetail:
    book, count = get_word_book_with_count(session, word_book_id)
    raw = list_word_book_words(session, word_book_id)
    words = raw["items"] if isinstance(raw, dict) else raw
    return WordBookDetail(
        id=book.id,
        title=book.title,
        description=book.description,
        category=book.category,
        difficulty=book.difficulty,
        word_count=count,
        words=words,
    )


@app.patch("/word-books/{word_book_id}", response_model=WordBookRead)
def patch_word_book(
    word_book_id: int,
    payload: WordBookUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> WordBookRead:
    book = update_word_book(session, word_book_id, payload.model_dump(exclude_unset=True))
    _, count = get_word_book_with_count(session, word_book_id)
    return WordBookRead(
        id=book.id,
        title=book.title,
        description=book.description,
        category=book.category,
        difficulty=book.difficulty,
        word_count=count,
    )


@app.delete("/word-books/{word_book_id}")
def remove_word_book(
    word_book_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    delete_word_book(session, word_book_id)
    return {"status": "deleted"}


@app.get("/word-books/{word_book_id}/export")
def export_word_book(
    word_book_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    csv_text = export_word_book_csv(session, word_book_id)
    return Response(
        content=csv_text.encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="word-book-{word_book_id}.csv"',
        },
    )


@app.get("/word-books/{word_book_id}/words", response_model=list[WordRead])
def word_book_words(
    word_book_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[WordRead]:
    raw = list_word_book_words(session, word_book_id)
    return raw["items"] if isinstance(raw, dict) else raw


@app.get("/word-books/{word_book_id}/words-paginated")
def word_book_words_paginated(
    word_book_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    return list_word_book_words(session, word_book_id, page, page_size)


@app.get("/word-books/{word_book_id}/words/search")
def search_words(
    word_book_id: int,
    q: str = Query(default="", min_length=0),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    return search_word_book_words(session, word_book_id, q, page, page_size)


@app.get("/word-books/{word_book_id}/word-progress", response_model=list[WordProgressRead])
def word_book_word_progress(
    word_book_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[WordProgressRead]:
    return [
        WordProgressRead(**item)
        for item in list_word_book_word_progress(session, current_user, word_book_id)
    ]


@app.get("/word-books/{word_book_id}/word-progress-paginated")
def word_book_word_progress_paginated(
    word_book_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    q: str = Query(default="", min_length=0),
    status_filter: str = Query(default="all"),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    return list_word_book_word_progress_paginated(
        session, current_user, word_book_id, page, page_size, q, status_filter
    )


@app.get("/word-books/{word_book_id}/progress-summary")
def word_book_progress_summary(
    word_book_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, int]:
    return get_word_book_progress_summary(session, current_user, word_book_id)


@app.post("/word-books/{word_book_id}/words", response_model=WordRead)
def create_word_in_book(
    word_book_id: int,
    payload: WordCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> WordRead:
    return add_word_to_book(session, word_book_id, payload.model_dump(), current_user)


@app.patch("/words/{word_id}", response_model=WordRead)
def patch_word(
    word_id: int,
    payload: WordUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> WordRead:
    return update_word(session, word_id, payload.model_dump(exclude_unset=True))


@app.get("/words/{word_id}", response_model=WordDetailRead)
def word_detail(
    word_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> WordDetailRead:
    return WordDetailRead(**get_word_detail_for_user(session, current_user, word_id))


@app.delete("/word-books/{word_book_id}/words/{word_id}")
def delete_word_from_book(
    word_book_id: int,
    word_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, str | bool]:
    word_book_deleted = remove_word_from_book(session, word_book_id, word_id)
    return {"status": "deleted", "word_book_deleted": word_book_deleted}


@app.post("/word-books/{word_book_id}/words/batch-delete")
def batch_delete_words_endpoint(
    word_book_id: int,
    payload: BatchDeleteWords,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, int | bool]:
    deleted, word_book_deleted = batch_delete_words(session, word_book_id, payload.word_ids)
    return {"deleted": deleted, "word_book_deleted": word_book_deleted}


@app.post("/word-books/{word_book_id}/words/batch-move")
def batch_move_words_endpoint(
    word_book_id: int,
    payload: BatchMoveWords,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, int]:
    return {"moved": batch_move_words(session, word_book_id, payload.word_ids, payload.target_word_book_id)}


@app.post("/word-books/import", response_model=WordBookImportResult)
async def import_word_book(
    title: str = Form(...),
    description: str = Form(""),
    category: str = Form("通用"),
    difficulty: str = Form("标准"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> WordBookImportResult:
    if not file.filename.lower().endswith(".csv"):
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    book, imported_count, skipped_count = import_word_book_from_csv(
        session, title, description, content, category, difficulty,
    )
    return WordBookImportResult(
        id=book.id,
        title=book.title,
        imported_count=imported_count,
        skipped_count=skipped_count,
    )


@app.post("/word-books/import/preview", response_model=WordBookImportPreview)
async def preview_word_book_import(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> WordBookImportPreview:
    if not file.filename.lower().endswith(".csv"):
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    return WordBookImportPreview(**parse_word_book_csv(session, content))


@app.post("/word-books/{word_book_id}/select")
def select_book(
    word_book_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, int]:
    return {"created": select_word_book(session, current_user, word_book_id)}


# ── Study ──

@app.get("/study/today", response_model=list[StudyItem])
def today_study(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[StudyItem]:
    return [build_study_item(item) for item in get_due_study_items(session, current_user)]


@app.get("/study/new", response_model=list[StudyItem])
def new_study(
    limit: int | None = Query(default=None, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[StudyItem]:
    return [build_study_item(item) for item in get_due_new_items(session, current_user, limit)]


@app.get("/review/today", response_model=list[StudyItem])
def today_review(
    limit: int | None = Query(default=None, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[StudyItem]:
    return [build_study_item(item) for item in get_due_review_items(session, current_user, limit)]


@app.post("/study/answer", response_model=AnswerResult)
def submit_answer(
    payload: AnswerCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AnswerResult:
    progress = answer_word(
        session, current_user, payload.word_id, payload.quality,
        payload.study_mode, payload.word_book_id,
    )
    return AnswerResult(
        word_id=progress.word_id,
        status=progress.status,
        mastery_level=progress.mastery_level,
        easiness_factor=progress.easiness_factor,
        interval_days=progress.interval_days,
        next_review_at=progress.next_review_at,
        is_leech=progress.is_leech,
        mistake_type=progress.last_mistake_type,
    )


# ── Favorites ──

@app.get("/favorites-paginated")
def favorites_paginated(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str = Query(default="", min_length=0),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    result = get_favorite_words_paginated(session, current_user, page, page_size, q)
    return {
        **result,
        "items": [
            build_study_item_for_user(session, current_user, item)
            for item in result["items"]
        ],
    }


@app.get("/words/{word_id}/favorite")
def get_favorite_status(
    word_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    return {"is_favorite": is_favorite_word(session, current_user, word_id)}


@app.post("/words/{word_id}/favorite")
def add_favorite_word(
    word_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    return {"is_favorite": favorite_word(session, current_user, word_id)}


@app.delete("/words/{word_id}/favorite")
def delete_favorite_word(
    word_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    return {"is_favorite": unfavorite_word(session, current_user, word_id)}


# ── Mistakes ──

@app.get("/mistakes", response_model=list[StudyItem])
def mistakes(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[StudyItem]:
    return [build_study_item(item) for item in get_mistakes(session, current_user)]


@app.get("/mistakes-paginated")
def mistakes_paginated(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str = Query(default="", min_length=0),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    result = get_mistakes_paginated(session, current_user, page, page_size, q)
    return {
        **result,
        "items": [build_study_item(item) for item in result["items"]],
    }


@app.post("/mistakes/{word_id}/practice", response_model=StudyItem)
def practice_mistake(
    word_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StudyItem:
    item = schedule_mistake_practice(session, current_user, word_id)
    return build_study_item(item)


# ── History & Stats ──

@app.post("/mistakes/practice-batch")
def practice_mistakes_batch(
    payload: BatchDeleteWords,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, int]:
    return {"scheduled": schedule_mistake_practice_batch(session, current_user, payload.word_ids)}


@app.post("/mistakes/{word_id}/resolve", response_model=StudyItem)
def resolve_mistake_endpoint(
    word_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StudyItem:
    return build_study_item(resolve_mistake(session, current_user, word_id))


@app.get("/study/history", response_model=list[ReviewLogRead])
def study_history(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[ReviewLogRead]:
    return [
        ReviewLogRead(
            id=log.id,
            word_id=log.word_id,
            word_text=log.word.text if log.word else "",
            word=log.word,
            quality=log.quality,
            is_correct=log.is_correct,
            study_mode=log.study_mode,
            created_at=log.created_at,
        )
        for log in get_review_history(session, current_user)
    ]


@app.get("/study/history-paginated")
def study_history_paginated(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str = Query(default="", min_length=0),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    result = get_review_history_paginated(session, current_user, page, page_size, q)
    return {
        **result,
        "items": [
            ReviewLogRead(
                id=log.id,
                word_id=log.word_id,
                word_text=log.word.text if log.word else "",
                word=log.word,
                quality=log.quality,
                is_correct=log.is_correct,
                study_mode=log.study_mode,
                created_at=log.created_at,
            )
            for log in result["items"]
        ],
    }


@app.get("/stats/overview", response_model=StatsOverview)
def stats(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StatsOverview:
    return StatsOverview(**get_stats(session, current_user))


@app.get("/learning-plan", response_model=LearningPlanRead)
def learning_plan(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LearningPlanRead:
    return LearningPlanRead(**get_learning_plan(session, current_user))


@app.get("/check-in/status", response_model=CheckInStatusRead)
def check_in_status(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CheckInStatusRead:
    return CheckInStatusRead(**get_check_in_status(session, current_user))


@app.get("/learning-report", response_model=LearningReportRead)
def learning_report(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LearningReportRead:
    return LearningReportRead(**get_learning_report(session, current_user))


@app.get("/reading/articles", response_model=list[ReadingArticleRead])
def reading_articles(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[ReadingArticleRead]:
    return [ReadingArticleRead(**item) for item in list_reading_articles(session, current_user)]


@app.get("/reading/articles/{article_id}", response_model=ReadingArticleRead)
def reading_article_detail(
    article_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ReadingArticleRead:
    return ReadingArticleRead(**get_reading_article(session, current_user, article_id))


@app.post("/reading/articles/{article_id}/complete", response_model=ReadingProgressRead)
def reading_article_complete(
    article_id: int,
    payload: ReadingCompleteCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ReadingProgressRead:
    progress = complete_reading_article(session, current_user, article_id, payload.reading_seconds)
    return ReadingProgressRead(
        id=progress.id,
        article_id=progress.article_id,
        completed_at=progress.completed_at,
        reading_seconds=progress.reading_seconds,
    )


@app.get("/listening/session", response_model=list[ListeningQuestionRead])
def listening_session(
    limit: int = Query(default=10, ge=1, le=30),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[ListeningQuestionRead]:
    return [ListeningQuestionRead(**item) for item in get_listening_questions(session, current_user, limit)]


@app.post("/listening/answer", response_model=ListeningAnswerResult)
def listening_answer(
    payload: ListeningAnswerCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ListeningAnswerResult:
    return ListeningAnswerResult(
        **answer_listening_question(
            session,
            current_user,
            payload.word_id,
            payload.selected_meaning,
            payload.word_book_id,
        )
    )


@app.get("/speaking/session", response_model=list[SpeakingPromptRead])
def speaking_session(
    limit: int = Query(default=8, ge=1, le=30),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[SpeakingPromptRead]:
    return [SpeakingPromptRead(**item) for item in get_speaking_prompts(session, current_user, limit)]


@app.post("/speaking/attempts", response_model=SpeakingAttemptRead)
def speaking_attempt(
    payload: SpeakingAttemptCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> SpeakingAttemptRead:
    return submit_speaking_attempt(
        session,
        current_user,
        payload.word_id,
        payload.prompt_text,
        payload.transcript,
    )


@app.get("/speaking/attempts", response_model=list[SpeakingAttemptRead])
def speaking_attempts(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[SpeakingAttemptRead]:
    return list_speaking_attempts(session, current_user)


@app.get("/writing/prompts", response_model=list[WritingPromptRead])
def writing_prompts(
    limit: int = Query(default=8, ge=1, le=30),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[WritingPromptRead]:
    return [WritingPromptRead(**item) for item in get_writing_prompts(session, current_user, limit)]


@app.post("/writing/submissions", response_model=WritingSubmissionRead)
def create_writing_submission(
    payload: WritingSubmissionCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> WritingSubmissionRead:
    return submit_writing(session, current_user, payload.prompt, payload.content)


@app.get("/writing/submissions", response_model=list[WritingSubmissionRead])
def writing_submissions(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[WritingSubmissionRead]:
    return list_writing_submissions(session, current_user, limit)


@app.get("/notifications", response_model=NotificationSummary)
def notifications(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> NotificationSummary:
    return NotificationSummary(**list_notifications(session, current_user))


@app.post("/notifications/{notification_id}/read", response_model=NotificationRead)
def read_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> NotificationRead:
    return mark_notification_read(session, current_user, notification_id)


# ── Data Export ──

# AI

@app.post("/ai/explain-word", response_model=AITextResponse)
async def ai_explain_word(
    payload: AIWordPayload,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AITextResponse:
    record_ai_usage(session, current_user, "explain_word")
    return AITextResponse(content=await call_ai(explain_word_prompt(payload.word)))


@app.post("/ai/generate-example", response_model=AITextResponse)
async def ai_generate_example(
    payload: AIExamplePayload,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AITextResponse:
    record_ai_usage(session, current_user, "generate_example")
    return AITextResponse(content=await call_ai(generate_example_prompt(payload.word, payload.level)))


@app.post("/ai/analyze-mistakes", response_model=AITextResponse)
async def ai_analyze_mistakes(
    payload: AIMistakePayload,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AITextResponse:
    record_ai_usage(session, current_user, "analyze_mistakes")
    return AITextResponse(content=await call_ai(analyze_mistakes_prompt(payload.words)))


@app.get("/ai/mistake-analyses", response_model=list[AIMistakeAnalysisRead])
def ai_mistake_analyses(
    limit: int = Query(10, ge=1, le=50),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[AIMistakeAnalysisRead]:
    return [
        AIMistakeAnalysisRead(**serialize_mistake_analysis(item))
        for item in list_mistake_analyses(session, current_user, limit)
    ]


@app.post("/ai/mistake-analyses", response_model=AIMistakeAnalysisRead)
def create_ai_mistake_analysis(
    payload: AIMistakeAnalysisCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AIMistakeAnalysisRead:
    item = save_mistake_analysis(
        session,
        current_user,
        payload.word_ids,
        payload.content,
        payload.source,
    )
    return AIMistakeAnalysisRead(**serialize_mistake_analysis(item))


@app.post("/ai/generate-quiz", response_model=AITextResponse)
async def ai_generate_quiz(
    payload: AIQuizPayload,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AITextResponse:
    record_ai_usage(session, current_user, "generate_quiz")
    return AITextResponse(content=await call_ai(generate_quiz_prompt(payload.words, payload.quiz_type)))


@app.post("/ai/generate-quiz/structured", response_model=AIQuizStructuredResponse)
async def ai_generate_quiz_structured(
    payload: AIQuizPayload,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AIQuizStructuredResponse:
    record_ai_usage(session, current_user, "generate_quiz")
    content = await call_ai(generate_structured_quiz_prompt(payload.words, payload.quiz_type))
    try:
        questions = parse_structured_quiz(content)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="AI 题目格式异常，请重新生成。") from exc
    if not questions:
        raise HTTPException(status_code=502, detail="AI 未生成可练习的题目，请重新生成。")
    questions = save_ai_questions(session, current_user, questions)
    return AIQuizStructuredResponse(questions=questions)


@app.post("/ai/questions/{question_id}/attempt", response_model=AIQuestionAttemptRead)
def submit_ai_question_attempt(
    question_id: int,
    payload: AIQuestionAttemptCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AIQuestionAttemptRead:
    return record_ai_question_attempt(session, current_user, question_id, payload.answer)


@app.post("/ai/examples", response_model=AISavedExampleRead)
def save_generated_example(
    payload: AISavedExampleCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AISavedExampleRead:
    return save_ai_example(
        session,
        current_user,
        payload.word_id,
        payload.sentence,
        payload.translation,
        payload.raw_content,
        payload.source,
    )


@app.get("/words/{word_id}/ai-examples", response_model=list[AISavedExampleRead])
def word_ai_examples(
    word_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[AISavedExampleRead]:
    return list_ai_examples_for_word(session, current_user, word_id)


@app.delete("/ai/examples/{example_id}")
def delete_generated_example(
    example_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    delete_ai_example(session, current_user, example_id)
    return {"status": "deleted"}


@app.post("/ai/explain-word/stream")
async def ai_explain_word_stream(
    payload: AIWordPayload,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    ensure_ai_configured()
    record_ai_usage(session, current_user, "explain_word")
    return StreamingResponse(
        stream_ai(explain_word_prompt(payload.word)),
        media_type="text/plain; charset=utf-8",
    )


@app.post("/ai/generate-example/stream")
async def ai_generate_example_stream(
    payload: AIExamplePayload,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    ensure_ai_configured()
    record_ai_usage(session, current_user, "generate_example")
    return StreamingResponse(
        stream_ai(generate_example_prompt(payload.word, payload.level)),
        media_type="text/plain; charset=utf-8",
    )


@app.post("/ai/analyze-mistakes/stream")
async def ai_analyze_mistakes_stream(
    payload: AIMistakePayload,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    ensure_ai_configured()
    record_ai_usage(session, current_user, "analyze_mistakes")
    return StreamingResponse(
        stream_ai(analyze_mistakes_prompt(payload.words)),
        media_type="text/plain; charset=utf-8",
    )


@app.post("/ai/generate-quiz/stream")
async def ai_generate_quiz_stream(
    payload: AIQuizPayload,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    ensure_ai_configured()
    record_ai_usage(session, current_user, "generate_quiz")
    return StreamingResponse(
        stream_ai(generate_quiz_prompt(payload.words, payload.quiz_type)),
        media_type="text/plain; charset=utf-8",
    )


@app.get("/data/export")
def export_data(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    data = export_user_data(session, current_user)
    json_str = __import__("json").dumps(data, ensure_ascii=False, indent=2)
    return Response(
        content=json_str.encode("utf-8"),
        media_type="application/json",
        headers={
            "Content-Disposition": "attachment; filename=english-word-backup.json",
        },
    )


@app.get("/data/export/anki")
def export_anki_data(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    tsv_text = export_user_anki_tsv(session, current_user)
    return Response(
        content=tsv_text.encode("utf-8-sig"),
        media_type="text/tab-separated-values; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=english-word-anki.tsv",
        },
    )


@app.post("/data/import", response_model=DataImportResult)
async def import_data(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> DataImportResult:
    if not file.filename.lower().endswith(".json"):
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="Only JSON backup files are supported")

    content = await file.read()
    try:
        data = __import__("json").loads(content.decode("utf-8"))
    except (UnicodeDecodeError, __import__("json").JSONDecodeError):
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="Invalid JSON backup file")
    return DataImportResult(**import_user_data(session, current_user, data))
