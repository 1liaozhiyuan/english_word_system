from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Form, Query, Response, UploadFile
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
    stream_ai,
)
from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import engine, get_session
from app.dependencies import get_current_user
from app.models import User
from app.models import UserWordProgress
from app.schemas import (
    AnswerCreate,
    AnswerResult,
    AIExamplePayload,
    AIMistakePayload,
    AIQuizPayload,
    AITextResponse,
    AIWordPayload,
    BatchDeleteWordBooks,
    BatchDeleteWords,
    BatchMoveWords,
    PasswordReset,
    PasswordResetRequest,
    ReviewLogRead,
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
    WordBookImportResult,
    WordBookProgressRead,
    WordBookRead,
    WordBookUpdate,
    WordProgressRead,
    WordRead,
    WordUpdate,
)
from app.services import (
    add_word_to_book,
    answer_word,
    authenticate_user,
    batch_delete_word_books,
    batch_delete_words,
    batch_move_words,
    delete_word_book,
    export_user_data,
    export_word_book_csv,
    get_due_study_items,
    get_due_new_items,
    get_due_review_items,
    get_mistakes,
    get_mistakes_paginated,
    get_or_create_user_settings,
    get_review_history,
    get_review_history_paginated,
    get_stats,
    get_word_book_progress_summary,
    get_word_book_with_count,
    import_word_book_from_csv,
    list_word_book_progress,
    list_word_book_word_progress_paginated,
    list_word_book_word_progress,
    list_word_book_words,
    list_word_books,
    list_word_books_paginated,
    register_user,
    remove_word_from_book,
    request_password_reset,
    reset_password,
    schedule_mistake_practice,
    search_word_book_words,
    seed_demo_data,
    select_word_book,
    update_word_book,
    update_word,
    update_user_settings,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    with Session(engine) as session:
        seed_demo_data(session)
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
        is_leech=item.is_leech,
        word=item.word,
    )


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
    return {"reset_token": token}


@app.post("/auth/reset-password", response_model=TokenResponse)
def do_reset_password(
    payload: PasswordReset, session: Session = Depends(get_session)
) -> TokenResponse:
    user = reset_password(session, payload.token, payload.new_password)
    return TokenResponse(access_token=create_access_token(str(user.id)))


@app.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead(id=current_user.id, email=current_user.email)


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
    )


# ── Word Books ──

@app.get("/word-books", response_model=list[WordBookRead])
def word_books(session: Session = Depends(get_session)) -> list[WordBookRead]:
    return [
        WordBookRead(
            id=book.id,
            title=book.title,
            description=book.description,
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


@app.delete("/word-books/{word_book_id}/words/{word_id}")
def delete_word_from_book(
    word_book_id: int,
    word_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    remove_word_from_book(session, word_book_id, word_id)
    return {"status": "deleted"}


@app.post("/word-books/{word_book_id}/words/batch-delete")
def batch_delete_words_endpoint(
    word_book_id: int,
    payload: BatchDeleteWords,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, int]:
    return {"deleted": batch_delete_words(session, word_book_id, payload.word_ids)}


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
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> WordBookImportResult:
    if not file.filename.lower().endswith(".csv"):
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    book, imported_count = import_word_book_from_csv(session, title, description, content)
    return WordBookImportResult(id=book.id, title=book.title, imported_count=imported_count)


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
    )


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


# ── Data Export ──

# AI

@app.post("/ai/explain-word", response_model=AITextResponse)
async def ai_explain_word(
    payload: AIWordPayload,
    current_user: User = Depends(get_current_user),
) -> AITextResponse:
    return AITextResponse(content=await call_ai(explain_word_prompt(payload.word)))


@app.post("/ai/generate-example", response_model=AITextResponse)
async def ai_generate_example(
    payload: AIExamplePayload,
    current_user: User = Depends(get_current_user),
) -> AITextResponse:
    return AITextResponse(content=await call_ai(generate_example_prompt(payload.word, payload.level)))


@app.post("/ai/analyze-mistakes", response_model=AITextResponse)
async def ai_analyze_mistakes(
    payload: AIMistakePayload,
    current_user: User = Depends(get_current_user),
) -> AITextResponse:
    return AITextResponse(content=await call_ai(analyze_mistakes_prompt(payload.words)))


@app.post("/ai/generate-quiz", response_model=AITextResponse)
async def ai_generate_quiz(
    payload: AIQuizPayload,
    current_user: User = Depends(get_current_user),
) -> AITextResponse:
    return AITextResponse(content=await call_ai(generate_quiz_prompt(payload.words, payload.quiz_type)))


@app.post("/ai/explain-word/stream")
async def ai_explain_word_stream(
    payload: AIWordPayload,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    ensure_ai_configured()
    return StreamingResponse(
        stream_ai(explain_word_prompt(payload.word)),
        media_type="text/plain; charset=utf-8",
    )


@app.post("/ai/generate-example/stream")
async def ai_generate_example_stream(
    payload: AIExamplePayload,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    ensure_ai_configured()
    return StreamingResponse(
        stream_ai(generate_example_prompt(payload.word, payload.level)),
        media_type="text/plain; charset=utf-8",
    )


@app.post("/ai/analyze-mistakes/stream")
async def ai_analyze_mistakes_stream(
    payload: AIMistakePayload,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    ensure_ai_configured()
    return StreamingResponse(
        stream_ai(analyze_mistakes_prompt(payload.words)),
        media_type="text/plain; charset=utf-8",
    )


@app.post("/ai/generate-quiz/stream")
async def ai_generate_quiz_stream(
    payload: AIQuizPayload,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    ensure_ai_configured()
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
