import csv
import io
import json
import random
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException, status
from sqlmodel import Session, func, select

from app.core.security import generate_reset_token, hash_password, verify_password
from app.models import (
    AdminOperationLog,
    AIQuestion,
    AIQuestionAttempt,
    AIUsageLog,
    AISavedExample,
    ContentReport,
    FavoriteWord,
    Feedback,
    MembershipPlan,
    Notification,
    Order,
    ProgressStatus,
    ReadingArticle,
    ReadingProgress,
    ReviewLog,
    SpeakingAttempt,
    StudyMode,
    User,
    UserRole,
    UserSettings,
    UserWordProgress,
    Word,
    WordBook,
    WordBookItem,
    WritingSubmission,
)

LEECH_THRESHOLD = 5
FREE_DAILY_AI_LIMIT = 5
MEMBER_DAILY_AI_LIMIT = 100


def _clear_progress_for_book_words(
    session: Session, word_book_id: int, word_ids: list[int] | None = None
) -> None:
    progress_query = select(UserWordProgress).where(
        UserWordProgress.word_book_id == word_book_id
    )
    log_query = select(ReviewLog).where(ReviewLog.word_book_id == word_book_id)
    if word_ids is not None:
        progress_query = progress_query.where(UserWordProgress.word_id.in_(word_ids))
        log_query = log_query.where(ReviewLog.word_id.in_(word_ids))

    for progress in session.exec(progress_query).all():
        session.delete(progress)
    for log in session.exec(log_query).all():
        log.word_book_id = None
        session.add(log)


def _delete_word_book_if_empty(session: Session, book: WordBook) -> bool:
    remaining_count = session.exec(
        select(func.count()).select_from(WordBookItem).where(WordBookItem.word_book_id == book.id)
    ).one()
    if remaining_count > 0:
        return False
    _clear_progress_for_book_words(session, book.id)
    session.delete(book)
    return True


def _merge_progress_into_target_book(
    session: Session, source_progress: UserWordProgress, target_word_book_id: int
) -> None:
    target_progress = session.exec(
        select(UserWordProgress).where(
            UserWordProgress.user_id == source_progress.user_id,
            UserWordProgress.word_id == source_progress.word_id,
            UserWordProgress.word_book_id == target_word_book_id,
        )
    ).first()

    if not target_progress:
        source_progress.word_book_id = target_word_book_id
        session.add(source_progress)
        return

    target_progress.mastery_level = max(
        target_progress.mastery_level, source_progress.mastery_level
    )
    target_progress.easiness_factor = max(
        target_progress.easiness_factor, source_progress.easiness_factor
    )
    target_progress.interval_days = max(
        target_progress.interval_days, source_progress.interval_days
    )
    target_progress.correct_count += source_progress.correct_count
    target_progress.wrong_count += source_progress.wrong_count
    target_progress.consecutive_correct = max(
        target_progress.consecutive_correct, source_progress.consecutive_correct
    )
    target_progress.is_leech = target_progress.is_leech or source_progress.is_leech
    if source_progress.last_reviewed_at and (
        not target_progress.last_reviewed_at
        or source_progress.last_reviewed_at > target_progress.last_reviewed_at
    ):
        target_progress.last_reviewed_at = source_progress.last_reviewed_at
    if source_progress.next_review_at < target_progress.next_review_at:
        target_progress.next_review_at = source_progress.next_review_at
    session.add(target_progress)
    session.delete(source_progress)


def register_user(session: Session, email: str, password: str) -> User:
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_count = session.exec(select(func.count(User.id))).one()
    user = User(
        email=email,
        hashed_password=hash_password(password),
        role=UserRole.admin if user_count == 0 else UserRole.user,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    session.add(UserSettings(user_id=user.id))
    session.commit()
    return user


def authenticate_user(session: Session, email: str, password: str) -> User:
    user = session.exec(select(User).where(User.email == email)).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return user


def request_password_reset(session: Session, email: str) -> str | None:
    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        return None
    token = generate_reset_token()
    user.reset_token = token
    user.reset_token_expires_at = datetime.utcnow() + timedelta(hours=1)
    session.add(user)
    session.commit()
    return token


def reset_password(session: Session, token: str, new_password: str) -> User:
    user = session.exec(
        select(User).where(
            User.reset_token == token,
            User.reset_token_expires_at > datetime.utcnow(),
        )
    ).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user.hashed_password = hash_password(new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def create_admin_operation_log(
    session: Session,
    actor: User,
    action: str,
    target_type: str | None = None,
    target_id: object | None = None,
    detail: str | None = None,
) -> AdminOperationLog:
    item = AdminOperationLog(
        actor_user_id=actor.id,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        detail=detail,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def change_password(session: Session, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.hashed_password = hash_password(new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    session.add(user)
    session.commit()


def delete_user_account(session: Session, user: User, password: str) -> None:
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    for model in (ReviewLog, UserWordProgress, FavoriteWord, UserSettings, Feedback, AIUsageLog, AISavedExample, AIQuestionAttempt, AIQuestion, Notification, Order, SpeakingAttempt, ContentReport, ReadingProgress, WritingSubmission):
        for item in session.exec(select(model).where(model.user_id == user.id)).all():
            session.delete(item)
    session.delete(user)
    session.commit()


def create_feedback(
    session: Session,
    user: User,
    category: str,
    content: str,
    contact: str | None = None,
) -> Feedback:
    feedback = Feedback(
        user_id=user.id,
        category=category.strip() or "general",
        content=content.strip(),
        contact=(contact or "").strip() or None,
    )
    session.add(feedback)
    session.commit()
    session.refresh(feedback)
    return feedback


def is_membership_active(settings: UserSettings) -> bool:
    if settings.membership_tier == "free":
        return False
    return not settings.membership_expires_at or settings.membership_expires_at > datetime.utcnow()


def get_daily_ai_limit(settings: UserSettings) -> int:
    return MEMBER_DAILY_AI_LIMIT if is_membership_active(settings) else FREE_DAILY_AI_LIMIT


def get_ai_used_today(session: Session, user: User) -> int:
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    return session.exec(
        select(func.count(AIUsageLog.id)).where(
            AIUsageLog.user_id == user.id,
            AIUsageLog.created_at >= today_start,
        )
    ).one()


def get_membership_status(session: Session, user: User) -> dict[str, object]:
    settings = get_or_create_user_settings(session, user)
    used = get_ai_used_today(session, user)
    daily_limit = get_daily_ai_limit(settings)
    active = is_membership_active(settings)
    return {
        "tier": settings.membership_tier if active else "free",
        "is_member": active,
        "expires_at": settings.membership_expires_at if active else None,
        "daily_ai_limit": daily_limit,
        "ai_used_today": used,
        "ai_remaining_today": max(0, daily_limit - used),
    }


def record_ai_usage(session: Session, user: User, feature: str) -> None:
    status_data = get_membership_status(session, user)
    if int(status_data["ai_remaining_today"]) <= 0:
        raise HTTPException(
            status_code=402,
            detail="Daily AI quota has been used up. Upgrade membership or try again tomorrow.",
        )
    session.add(AIUsageLog(user_id=user.id, feature=feature))
    session.commit()


def activate_demo_membership(session: Session, user: User, months: int = 12) -> UserSettings:
    settings = get_or_create_user_settings(session, user)
    settings.membership_tier = "pro"
    settings.membership_expires_at = datetime.utcnow() + timedelta(days=30 * months)
    settings.updated_at = datetime.utcnow()
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings


DEFAULT_MEMBERSHIP_PLANS = [
    {
        "code": "monthly",
        "name": "月度会员",
        "description": "适合短期试用，解锁更高 AI 额度和高级学习报告。",
        "price_cents": 2900,
        "duration_days": 30,
        "ai_daily_limit": 100,
        "is_recommended": False,
    },
    {
        "code": "yearly",
        "name": "年度会员",
        "description": "适合长期学习，覆盖词汇、复习、AI 解析和报告能力。",
        "price_cents": 19900,
        "duration_days": 365,
        "ai_daily_limit": 100,
        "is_recommended": True,
    },
    {
        "code": "exam_pack",
        "name": "考试专项包",
        "description": "适合四六级、考研、雅思托福等备考冲刺场景。",
        "price_cents": 9900,
        "duration_days": 120,
        "ai_daily_limit": 100,
        "is_recommended": False,
    },
]

DEFAULT_READING_ARTICLES = [
    {
        "title": "A Steady Study Day",
        "category": "daily",
        "level": "A2",
        "content": "A steady study day does not need to be long. You can review a few words, read one short story, and write one simple sentence. Small actions become significant when you repeat them every day.",
        "translation": "稳定的一天学习不一定很长。你可以复习几个单词，读一篇短文，再写一个简单句。每天重复的小行动会变得很有意义。",
    },
    {
        "title": "Why Review Matters",
        "category": "exam",
        "level": "B1",
        "content": "Many learners remember new words quickly but forget them after a few days. Review helps the brain meet the same word in different contexts. This makes the meaning clearer and the memory stronger.",
        "translation": "很多学习者能很快记住新词，但几天后又会忘记。复习能帮助大脑在不同语境中遇到同一个词，让意思更清楚，记忆更牢固。",
    },
    {
        "title": "Speaking With Confidence",
        "category": "speaking",
        "level": "B1",
        "content": "Confidence grows through practice. Start with short sentences, listen to a clear model, and repeat slowly. When you make a mistake, treat it as useful feedback instead of failure.",
        "translation": "信心来自练习。从短句开始，听清晰的示范，然后慢慢跟读。犯错时，把它当成有用反馈，而不是失败。",
    },
]


def ensure_default_membership_plans(session: Session) -> None:
    for item in DEFAULT_MEMBERSHIP_PLANS:
        plan = session.exec(select(MembershipPlan).where(MembershipPlan.code == item["code"])).first()
        if plan:
            continue
        session.add(MembershipPlan(**item))
    session.commit()


def ensure_default_reading_articles(session: Session) -> None:
    if session.exec(select(func.count(ReadingArticle.id))).one() > 0:
        return
    for item in DEFAULT_READING_ARTICLES:
        session.add(ReadingArticle(audio_text=item["content"], **item))
    session.commit()


def list_membership_plans(session: Session, active_only: bool = True) -> list[MembershipPlan]:
    ensure_default_membership_plans(session)
    statement = select(MembershipPlan)
    if active_only:
        statement = statement.where(MembershipPlan.is_active == True)  # noqa: E712
    return list(session.exec(statement.order_by(MembershipPlan.price_cents)).all())


def _extend_membership(settings: UserSettings, plan: MembershipPlan) -> None:
    now = datetime.utcnow()
    start = settings.membership_expires_at if settings.membership_expires_at and settings.membership_expires_at > now else now
    settings.membership_tier = "pro"
    settings.membership_expires_at = start + timedelta(days=plan.duration_days)
    settings.updated_at = now


def create_demo_membership_order(session: Session, user: User, plan_id: int) -> Order:
    ensure_default_membership_plans(session)
    plan = session.get(MembershipPlan, plan_id)
    if not plan or not plan.is_active:
        raise HTTPException(status_code=404, detail="Membership plan not found")
    now = datetime.utcnow()
    order = Order(
        user_id=user.id,
        plan_id=plan.id,
        order_no=f"DEMO{now.strftime('%Y%m%d%H%M%S')}{uuid4().hex[:8].upper()}",
        amount_cents=plan.price_cents,
        status="paid",
        paid_at=now,
    )
    settings = get_or_create_user_settings(session, user)
    _extend_membership(settings, plan)
    session.add(order)
    session.add(settings)
    session.commit()
    session.refresh(order)
    return order


def list_user_orders(session: Session, user: User) -> list[dict[str, object]]:
    rows = list(
        session.exec(
            select(Order, MembershipPlan)
            .join(MembershipPlan, MembershipPlan.id == Order.plan_id)
            .where(Order.user_id == user.id)
            .order_by(Order.created_at.desc())
        ).all()
    )
    return [_order_payload(order, plan, user) for order, plan in rows]


def list_admin_orders(session: Session, page: int = 1, page_size: int = 20) -> dict:
    total = session.exec(select(func.count()).select_from(Order)).one()
    rows = list(
        session.exec(
            select(Order, MembershipPlan, User)
            .join(MembershipPlan, MembershipPlan.id == Order.plan_id)
            .join(User, User.id == Order.user_id)
            .order_by(Order.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return {
        "items": [_order_payload(order, plan, user) for order, plan, user in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def _order_payload(order: Order, plan: MembershipPlan, user: User | None = None) -> dict[str, object]:
    return {
        "id": order.id,
        "order_no": order.order_no,
        "user_id": order.user_id,
        "user_email": user.email if user else None,
        "plan_id": order.plan_id,
        "plan_name": plan.name,
        "amount_cents": order.amount_cents,
        "status": order.status,
        "paid_at": order.paid_at,
        "created_at": order.created_at,
    }


def get_admin_overview(session: Session) -> dict[str, int]:
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    demo_pattern = "%@example.com"
    total_users = session.exec(select(func.count(User.id))).one()
    demo_users = session.exec(select(func.count(User.id)).where(User.email.ilike(demo_pattern))).one()
    paid_orders = session.exec(select(func.count(Order.id)).where(Order.status == "paid")).one()
    paid_revenue = session.exec(select(func.coalesce(func.sum(Order.amount_cents), 0)).where(Order.status == "paid")).one()
    return {
        "users": max(0, total_users - demo_users),
        "total_users": total_users,
        "demo_users": demo_users,
        "word_books": session.exec(select(func.count(WordBook.id))).one(),
        "words": session.exec(select(func.count(Word.id))).one(),
        "reviews": session.exec(select(func.count(ReviewLog.id))).one(),
        "feedback_open": session.exec(
            select(func.count(Feedback.id)).where(Feedback.status == "open")
        ).one(),
        "content_reports_open": session.exec(
            select(func.count(ContentReport.id)).where(ContentReport.status == "open")
        ).one(),
        "ai_today": session.exec(
            select(func.count(AIUsageLog.id)).where(AIUsageLog.created_at >= today_start)
        ).one(),
        "members": session.exec(
            select(func.count(UserSettings.id)).where(UserSettings.membership_tier != "free")
        ).one(),
        "paid_orders": paid_orders,
        "paid_revenue_cents": paid_revenue,
    }


def save_ai_example(
    session: Session,
    user: User,
    word_id: int,
    sentence: str,
    translation: str | None,
    raw_content: str | None,
    source: str = "ai",
) -> AISavedExample:
    word = session.get(Word, word_id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    item = AISavedExample(
        user_id=user.id,
        word_id=word_id,
        sentence=sentence.strip(),
        translation=(translation or "").strip() or None,
        raw_content=(raw_content or "").strip() or None,
        source=(source or "ai").strip() or "ai",
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def list_ai_examples_for_word(session: Session, user: User, word_id: int) -> list[AISavedExample]:
    return list(
        session.exec(
            select(AISavedExample)
            .where(AISavedExample.user_id == user.id, AISavedExample.word_id == word_id)
            .order_by(AISavedExample.created_at.desc())
        ).all()
    )


def delete_ai_example(session: Session, user: User, example_id: int) -> None:
    item = session.get(AISavedExample, example_id)
    if not item or item.user_id != user.id:
        raise HTTPException(status_code=404, detail="Saved example not found")
    session.delete(item)
    session.commit()


def save_ai_questions(session: Session, user: User, questions: list[dict[str, object]]) -> list[dict[str, object]]:
    saved: list[dict[str, object]] = []
    for item in questions:
        related_word = str(item.get("related_word") or "").strip() or None
        word_id = None
        if related_word:
            word = session.exec(select(Word).where(Word.text == related_word)).first()
            word_id = word.id if word else None
        question = AIQuestion(
            user_id=user.id,
            word_id=word_id,
            question_type=str(item.get("type") or "choice"),
            prompt=str(item.get("prompt") or ""),
            options_json=json.dumps(item.get("options") or [], ensure_ascii=False),
            answer=str(item.get("answer") or ""),
            explanation=str(item.get("explanation") or ""),
            related_word=related_word,
        )
        session.add(question)
        session.commit()
        session.refresh(question)
        saved.append(
            {
                "id": str(question.id),
                "type": question.question_type,
                "prompt": question.prompt,
                "options": json.loads(question.options_json),
                "answer": question.answer,
                "explanation": question.explanation,
                "related_word": question.related_word,
            }
        )
    return saved


def normalize_answer(value: str) -> str:
    value = value.strip().lower()
    for prefix in ("a.", "b.", "c.", "d.", "a、", "b、", "c、", "d、"):
        if value.startswith(prefix):
            return value[len(prefix):].strip()
    return value


def record_ai_question_attempt(session: Session, user: User, question_id: int, answer: str) -> AIQuestionAttempt:
    question = session.get(AIQuestion, question_id)
    if not question or question.user_id != user.id:
        raise HTTPException(status_code=404, detail="AI question not found")
    is_correct = normalize_answer(answer) == normalize_answer(question.answer)
    attempt = AIQuestionAttempt(
        user_id=user.id,
        question_id=question.id,
        answer=answer.strip(),
        is_correct=is_correct,
    )
    session.add(attempt)
    session.commit()
    session.refresh(attempt)
    if question.word_id:
        progress = session.exec(
            select(UserWordProgress).where(
                UserWordProgress.user_id == user.id,
                UserWordProgress.word_id == question.word_id,
            )
        ).first()
        if not progress:
            progress = UserWordProgress(user_id=user.id, word_id=question.word_id)
            session.add(progress)
            session.commit()
        answer_word(
            session,
            user,
            question.word_id,
            3 if is_correct else 0,
            StudyMode.en_to_cn,
            progress.word_book_id,
        )
    return attempt


def _ensure_notification(
    session: Session,
    user: User,
    notification_type: str,
    title: str,
    content: str,
    action_url: str | None = None,
) -> Notification:
    existing = session.exec(
        select(Notification).where(
            Notification.user_id == user.id,
            Notification.type == notification_type,
            Notification.read_at == None,  # noqa: E711
        )
    ).first()
    if existing:
        existing.title = title
        existing.content = content
        existing.action_url = action_url
        existing.created_at = datetime.utcnow()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    item = Notification(
        user_id=user.id,
        type=notification_type,
        title=title,
        content=content,
        action_url=action_url,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def sync_user_notifications(session: Session, user: User) -> None:
    stats = get_stats(session, user)
    settings = get_or_create_user_settings(session, user)
    if int(stats["due_review"]) > 0:
        _ensure_notification(
            session,
            user,
            "review_due",
            "复习任务到期",
            f"今天还有 {stats['due_review']} 个到期复习单词。",
            "/review",
        )
    if int(stats["mistakes"]) > 0:
        _ensure_notification(
            session,
            user,
            "mistakes",
            "错题需要复盘",
            f"错题本中还有 {stats['mistakes']} 个单词需要处理。",
            "/mistakes",
        )
    if settings.reminder_enabled:
        _ensure_notification(
            session,
            user,
            "daily_reminder",
            "每日学习提醒已开启",
            f"系统会按你的偏好时间 {settings.reminder_time or '未设置'} 提醒学习。",
            "/learning-settings",
        )
    membership = get_membership_status(session, user)
    if int(membership["ai_remaining_today"]) <= 1:
        _ensure_notification(
            session,
            user,
            "ai_quota",
            "AI 次数即将用完",
            f"今日 AI 剩余额度为 {membership['ai_remaining_today']} 次。",
            "/membership",
        )


def list_notifications(session: Session, user: User) -> dict[str, object]:
    sync_user_notifications(session, user)
    items = list(
        session.exec(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(50)
        ).all()
    )
    unread = session.exec(
        select(func.count(Notification.id)).where(
            Notification.user_id == user.id,
            Notification.read_at == None,  # noqa: E711
        )
    ).one()
    return {"unread_count": unread, "items": items}


def mark_notification_read(session: Session, user: User, notification_id: int) -> Notification:
    item = session.get(Notification, notification_id)
    if not item or item.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    item.read_at = datetime.utcnow()
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def get_listening_questions(session: Session, user: User, limit: int = 10) -> list[dict[str, object]]:
    items = get_due_study_items(session, user)
    if len(items) < limit:
        seen = {item.word_id for item in items}
        statement = select(UserWordProgress).where(UserWordProgress.user_id == user.id)
        if seen:
            statement = statement.where(UserWordProgress.word_id.notin_(seen))
        extra = list(
            session.exec(
                statement.order_by(UserWordProgress.last_reviewed_at.is_(None).desc(), UserWordProgress.next_review_at)
                .limit(limit - len(items))
            ).all()
        )
        items.extend(extra)

    if not items:
        return []

    all_meanings = [
        meaning
        for meaning in session.exec(select(Word.meaning).where(Word.meaning != "")).all()
        if meaning
    ]
    questions = []
    for item in items[:limit]:
        distractors = [meaning for meaning in all_meanings if meaning != item.word.meaning]
        options = random.sample(distractors, min(3, len(distractors)))
        options.append(item.word.meaning)
        random.shuffle(options)
        questions.append(
            {
                "id": f"listen-{item.word_id}-{item.word_book_id or 0}",
                "word_id": item.word_id,
                "word_book_id": item.word_book_id,
                "audio_text": item.word.text,
                "phonetic": item.word.phonetic,
                "options": options,
            }
        )
    return questions


def answer_listening_question(
    session: Session,
    user: User,
    word_id: int,
    selected_meaning: str,
    word_book_id: int | None = None,
) -> dict[str, object]:
    word = session.get(Word, word_id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    is_correct = selected_meaning.strip() == word.meaning
    progress = answer_word(
        session,
        user,
        word_id,
        2 if is_correct else 0,
        StudyMode.listening,
        word_book_id,
    )
    return {
        "word_id": word_id,
        "is_correct": is_correct,
        "correct_answer": word.meaning,
        "explanation": "听音辨义正确。" if is_correct else f"正确释义是：{word.meaning}",
        "progress": {
            "word_id": progress.word_id,
            "status": progress.status,
            "mastery_level": progress.mastery_level,
            "easiness_factor": progress.easiness_factor,
            "interval_days": progress.interval_days,
            "next_review_at": progress.next_review_at,
            "is_leech": progress.is_leech,
        },
    }


def get_speaking_prompts(session: Session, user: User, limit: int = 8) -> list[dict[str, object]]:
    progress_items = list(
        session.exec(
            select(UserWordProgress)
            .where(UserWordProgress.user_id == user.id)
            .order_by(UserWordProgress.last_reviewed_at.is_(None).desc(), UserWordProgress.next_review_at)
            .limit(limit)
        ).all()
    )
    if not progress_items:
        return []
    return [_speaking_prompt_payload(item.word) for item in progress_items if item.word]


def _speaking_prompt_payload(word: Word) -> dict[str, object]:
    prompt_text = word.example_sentence or word.text
    return {
        "word_id": word.id,
        "word_text": word.text,
        "phonetic": word.phonetic,
        "meaning": word.meaning,
        "prompt_text": prompt_text,
        "translation": word.example_translation,
    }


def submit_speaking_attempt(
    session: Session,
    user: User,
    word_id: int,
    prompt_text: str,
    transcript: str,
) -> SpeakingAttempt:
    word = session.get(Word, word_id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    score = _speaking_accuracy(prompt_text, transcript)
    feedback = _speaking_feedback(score, word.text)
    attempt = SpeakingAttempt(
        user_id=user.id,
        word_id=word_id,
        prompt_text=prompt_text.strip(),
        transcript=transcript.strip(),
        accuracy_score=score,
        feedback=feedback,
    )
    session.add(attempt)
    if score >= 80:
        answer_word(session, user, word_id, 2, StudyMode.spelling, None)
    session.commit()
    session.refresh(attempt)
    return attempt


def list_speaking_attempts(session: Session, user: User, limit: int = 20) -> list[SpeakingAttempt]:
    return list(
        session.exec(
            select(SpeakingAttempt)
            .where(SpeakingAttempt.user_id == user.id)
            .order_by(SpeakingAttempt.created_at.desc())
            .limit(limit)
        ).all()
    )


def _speaking_accuracy(prompt_text: str, transcript: str) -> int:
    expected = _normalize_spoken_text(prompt_text)
    actual = _normalize_spoken_text(transcript)
    if not expected or not actual:
        return 0
    expected_words = expected.split()
    actual_words = actual.split()
    matched = sum(1 for word in expected_words if word in actual_words)
    length_penalty = max(0, 100 - abs(len(expected_words) - len(actual_words)) * 8)
    coverage = int(matched / len(expected_words) * 100)
    return max(0, min(100, round(coverage * 0.75 + length_penalty * 0.25)))


def _normalize_spoken_text(value: str) -> str:
    return " ".join(
        "".join(char.lower() if char.isalnum() or char.isspace() else " " for char in value).split()
    )


def _speaking_feedback(score: int, word_text: str) -> str:
    if score >= 90:
        return f"跟读很稳定，{word_text} 的发音和句子完整度都不错。"
    if score >= 70:
        return f"整体接近原句，建议再放慢语速复练 {word_text}。"
    if score >= 40:
        return f"已经完成尝试，但原句覆盖不够，建议先逐词跟读 {word_text}。"
    return "识别到的内容较少，请先播放示范，再重新跟读。"


def list_admin_users(session: Session, page: int = 1, page_size: int = 20, query: str = "") -> dict:
    statement = select(User, UserSettings).join(
        UserSettings, UserSettings.user_id == User.id, isouter=True
    )
    count_statement = select(func.count()).select_from(User)
    keyword = query.strip()
    if keyword:
        pattern = f"%{keyword}%"
        statement = statement.where(User.email.ilike(pattern))
        count_statement = count_statement.where(User.email.ilike(pattern))

    total = session.exec(count_statement).one()
    rows = list(
        session.exec(
            statement.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        ).all()
    )
    items = []
    for user, settings in rows:
        progress_count = session.exec(
            select(func.count(UserWordProgress.id)).where(UserWordProgress.user_id == user.id)
        ).one()
        review_count = session.exec(
            select(func.count(ReviewLog.id)).where(ReviewLog.user_id == user.id)
        ).one()
        feedback_count = session.exec(
            select(func.count(Feedback.id)).where(Feedback.user_id == user.id)
        ).one()
        items.append({
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at,
            "membership_tier": settings.membership_tier if settings else "free",
            "learning_goal": settings.learning_goal if settings else None,
            "progress_count": progress_count,
            "review_count": review_count,
            "feedback_count": feedback_count,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def update_admin_user_role(session: Session, actor: User, user_id: int, role: UserRole) -> User:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    old_role = user.role
    user.role = role
    session.add(user)
    session.commit()
    session.refresh(user)
    create_admin_operation_log(
        session,
        actor,
        "update_user_role",
        "user",
        user.id,
        f"{user.email}: {old_role.value} -> {role.value}",
    )
    return user


def list_admin_operation_logs(session: Session, page: int = 1, page_size: int = 20) -> dict:
    total = session.exec(select(func.count()).select_from(AdminOperationLog)).one()
    rows = list(
        session.exec(
            select(AdminOperationLog, User)
            .join(User, User.id == AdminOperationLog.actor_user_id, isouter=True)
            .order_by(AdminOperationLog.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return {
        "items": [
            {
                "id": log.id,
                "actor_user_id": log.actor_user_id,
                "actor_email": user.email if user else None,
                "action": log.action,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "detail": log.detail,
                "created_at": log.created_at,
            }
            for log, user in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def list_admin_feedback(session: Session, page: int = 1, page_size: int = 20, status_filter: str = "all") -> dict:
    statement = select(Feedback, User).join(User, User.id == Feedback.user_id)
    count_statement = select(func.count()).select_from(Feedback)
    if status_filter != "all":
        statement = statement.where(Feedback.status == status_filter)
        count_statement = count_statement.where(Feedback.status == status_filter)

    total = session.exec(count_statement).one()
    rows = list(
        session.exec(
            statement.order_by(Feedback.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        ).all()
    )
    return {
        "items": [
            {
                "id": feedback.id,
                "user_id": feedback.user_id,
                "user_email": user.email,
                "category": feedback.category,
                "contact": feedback.contact,
                "content": feedback.content,
                "status": feedback.status,
                "created_at": feedback.created_at,
            }
            for feedback, user in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def update_feedback_status(session: Session, feedback_id: int, status_value: str) -> Feedback:
    feedback = session.get(Feedback, feedback_id)
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    if status_value not in {"open", "processing", "closed"}:
        raise HTTPException(status_code=400, detail="Invalid feedback status")
    feedback.status = status_value
    session.add(feedback)
    session.commit()
    session.refresh(feedback)
    return feedback


def list_admin_ai_usage(session: Session, page: int = 1, page_size: int = 20) -> dict:
    statement = select(AIUsageLog, User).join(User, User.id == AIUsageLog.user_id)
    total = session.exec(select(func.count()).select_from(AIUsageLog)).one()
    rows = list(
        session.exec(
            statement.order_by(AIUsageLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        ).all()
    )
    feature_rows = list(
        session.exec(
            select(AIUsageLog.feature, func.count(AIUsageLog.id))
            .group_by(AIUsageLog.feature)
            .order_by(func.count(AIUsageLog.id).desc())
        ).all()
    )
    return {
        "items": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "user_email": user.email,
                "feature": log.feature,
                "created_at": log.created_at,
            }
            for log, user in rows
        ],
        "feature_summary": [
            {"feature": feature, "count": count}
            for feature, count in feature_rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def create_content_report(
    session: Session,
    user: User,
    source_type: str,
    content: str,
    reason: str = "inaccurate",
    source_id: str | None = None,
) -> ContentReport:
    report = ContentReport(
        user_id=user.id,
        source_type=(source_type or "ai").strip()[:40],
        source_id=(source_id or "").strip() or None,
        reason=(reason or "inaccurate").strip()[:80],
        content=content.strip(),
    )
    session.add(report)
    session.commit()
    session.refresh(report)
    return report


def list_admin_content_reports(
    session: Session,
    page: int = 1,
    page_size: int = 20,
    status_filter: str = "all",
) -> dict:
    statement = select(ContentReport, User).join(User, User.id == ContentReport.user_id)
    count_statement = select(func.count()).select_from(ContentReport)
    if status_filter != "all":
        statement = statement.where(ContentReport.status == status_filter)
        count_statement = count_statement.where(ContentReport.status == status_filter)
    total = session.exec(count_statement).one()
    rows = list(
        session.exec(
            statement.order_by(ContentReport.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return {
        "items": [
            {
                "id": report.id,
                "user_id": report.user_id,
                "user_email": user.email,
                "source_type": report.source_type,
                "source_id": report.source_id,
                "reason": report.reason,
                "content": report.content,
                "status": report.status,
                "reviewer_user_id": report.reviewer_user_id,
                "review_note": report.review_note,
                "created_at": report.created_at,
                "updated_at": report.updated_at,
            }
            for report, user in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def update_content_report_status(
    session: Session,
    actor: User,
    report_id: int,
    status_value: str,
    review_note: str | None = None,
) -> ContentReport:
    report = session.get(ContentReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Content report not found")
    if status_value not in {"open", "reviewing", "resolved", "rejected"}:
        raise HTTPException(status_code=400, detail="Invalid content report status")
    report.status = status_value
    report.reviewer_user_id = actor.id
    report.review_note = (review_note or "").strip() or report.review_note
    report.updated_at = datetime.utcnow()
    session.add(report)
    session.commit()
    session.refresh(report)
    create_admin_operation_log(
        session,
        actor,
        "update_content_report_status",
        "content_report",
        report.id,
        f"{status_value}: {report.review_note or ''}",
    )
    return report


def list_reading_articles(session: Session, user: User) -> list[dict[str, object]]:
    ensure_default_reading_articles(session)
    completed_ids = {
        item.article_id
        for item in session.exec(
            select(ReadingProgress).where(ReadingProgress.user_id == user.id)
        ).all()
    }
    articles = list(session.exec(select(ReadingArticle).order_by(ReadingArticle.created_at.desc())).all())
    return [
        {
            "id": article.id,
            "title": article.title,
            "category": article.category,
            "level": article.level,
            "content": article.content,
            "translation": article.translation,
            "audio_text": article.audio_text,
            "created_at": article.created_at,
            "completed": article.id in completed_ids,
            "known_words": _known_words_in_text(session, user, article.content),
        }
        for article in articles
    ]


def get_reading_article(session: Session, user: User, article_id: int) -> dict[str, object]:
    ensure_default_reading_articles(session)
    article = session.get(ReadingArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Reading article not found")
    completed = session.exec(
        select(ReadingProgress).where(
            ReadingProgress.user_id == user.id,
            ReadingProgress.article_id == article_id,
        )
    ).first()
    return {
        "id": article.id,
        "title": article.title,
        "category": article.category,
        "level": article.level,
        "content": article.content,
        "translation": article.translation,
        "audio_text": article.audio_text,
        "created_at": article.created_at,
        "completed": completed is not None,
        "known_words": _known_words_in_text(session, user, article.content),
    }


def complete_reading_article(
    session: Session,
    user: User,
    article_id: int,
    reading_seconds: int = 0,
) -> ReadingProgress:
    article = session.get(ReadingArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Reading article not found")
    progress = session.exec(
        select(ReadingProgress).where(
            ReadingProgress.user_id == user.id,
            ReadingProgress.article_id == article_id,
        )
    ).first()
    if progress:
        progress.completed_at = datetime.utcnow()
        progress.reading_seconds = max(progress.reading_seconds, reading_seconds)
    else:
        progress = ReadingProgress(user_id=user.id, article_id=article_id, reading_seconds=max(0, reading_seconds))
    session.add(progress)
    session.commit()
    session.refresh(progress)
    return progress


def _known_words_in_text(session: Session, user: User, content: str) -> list[dict[str, object]]:
    tokens = {
        token.strip(".,!?;:\"'()[]").lower()
        for token in content.split()
        if token.strip(".,!?;:\"'()[]")
    }
    if not tokens:
        return []
    rows = list(
        session.exec(
            select(Word, UserWordProgress)
            .join(UserWordProgress, UserWordProgress.word_id == Word.id)
            .where(UserWordProgress.user_id == user.id, Word.text.in_(tokens))
        ).all()
    )
    return [
        {
            "word_id": word.id,
            "text": word.text,
            "meaning": word.meaning,
            "mastery_level": progress.mastery_level,
        }
        for word, progress in rows
    ]


def get_writing_prompts(session: Session, user: User, limit: int = 8) -> list[dict[str, object]]:
    words = list(
        session.exec(
            select(Word, UserWordProgress)
            .join(UserWordProgress, UserWordProgress.word_id == Word.id)
            .where(UserWordProgress.user_id == user.id)
            .order_by(UserWordProgress.mastery_level, UserWordProgress.next_review_at)
            .limit(limit)
        ).all()
    )
    prompts = [
        {
            "prompt": f"Use the word '{word.text}' to write one clear English sentence.",
            "keyword": word.text,
            "meaning": word.meaning,
        }
        for word, _ in words
    ]
    prompts.append({
        "prompt": "Write a short paragraph about your study plan today.",
        "keyword": None,
        "meaning": "学习计划短文",
    })
    return prompts[:limit]


def submit_writing(session: Session, user: User, prompt: str, content: str) -> WritingSubmission:
    score, feedback = _score_writing(prompt, content)
    submission = WritingSubmission(
        user_id=user.id,
        prompt=prompt.strip(),
        content=content.strip(),
        score=score,
        feedback=feedback,
    )
    session.add(submission)
    session.commit()
    session.refresh(submission)
    return submission


def list_writing_submissions(session: Session, user: User, limit: int = 20) -> list[WritingSubmission]:
    return list(
        session.exec(
            select(WritingSubmission)
            .where(WritingSubmission.user_id == user.id)
            .order_by(WritingSubmission.created_at.desc())
            .limit(limit)
        ).all()
    )


def _score_writing(prompt: str, content: str) -> tuple[int, str]:
    words = [word for word in content.replace("\n", " ").split(" ") if word.strip()]
    score = 50
    if len(words) >= 8:
        score += 15
    if len(words) >= 20:
        score += 10
    if content.strip().endswith((".", "!", "?")):
        score += 10
    keyword = None
    if "'" in prompt:
        parts = prompt.split("'")
        if len(parts) >= 2:
            keyword = parts[1].lower()
    if keyword and keyword in content.lower():
        score += 15
    score = max(0, min(100, score))
    feedback_parts = []
    if keyword and keyword not in content.lower():
        feedback_parts.append(f"建议把关键词 {keyword} 放进句子中。")
    if len(words) < 8:
        feedback_parts.append("内容偏短，可以补充时间、原因或结果。")
    if not content.strip().endswith((".", "!", "?")):
        feedback_parts.append("注意英文句末标点。")
    if not feedback_parts:
        feedback_parts.append("表达完整，结构清楚，可以继续尝试更复杂的句式。")
    return score, " ".join(feedback_parts)


def list_word_books(session: Session) -> list[tuple[WordBook, int]]:
    statement = (
        select(WordBook, func.count(WordBookItem.id))
        .join(WordBookItem, isouter=True)
        .group_by(WordBook.id)
        .order_by(WordBook.id.desc())
    )
    return list(session.exec(statement).all())


def list_word_books_paginated(
    session: Session,
    page: int = 1,
    page_size: int = 20,
    query: str = "",
) -> dict[str, object]:
    statement = (
        select(WordBook, func.count(WordBookItem.id))
        .join(WordBookItem, isouter=True)
        .group_by(WordBook.id)
    )
    count_statement = select(func.count()).select_from(WordBook)
    keyword = query.strip()
    if keyword:
        pattern = f"%{keyword}%"
        condition = (
            (WordBook.title.ilike(pattern))
            | (WordBook.description.ilike(pattern))
            | (WordBook.category.ilike(pattern))
            | (WordBook.difficulty.ilike(pattern))
        )
        statement = statement.where(condition)
        count_statement = count_statement.where(condition)

    total = session.exec(count_statement).one()
    books = list(
        session.exec(
            statement
            .order_by(WordBook.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return {
        "items": [
            {
                "id": book.id,
                "title": book.title,
                "description": book.description,
                "category": book.category,
                "difficulty": book.difficulty,
                "word_count": word_count,
            }
            for book, word_count in books
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def list_word_book_progress(
    session: Session,
    user: User,
    page: int | None = None,
    page_size: int = 20,
    query: str = "",
) -> list[dict[str, int | str]] | dict[str, object]:
    if page is None:
        books = list_word_books(session)
        total = len(books)
    else:
        page_data = list_word_books_paginated(session, page, page_size, query)
        books = [
            (
                WordBook(
                    id=item["id"],
                    title=item["title"],
                    description=item["description"],
                    category=item["category"],
                    difficulty=item["difficulty"],
                ),
                item["word_count"],
            )
            for item in page_data["items"]
        ]
        total = page_data["total"]
    results: list[dict[str, int | str]] = []

    for book, word_count in books:
        word_ids = list(
            session.exec(
                select(WordBookItem.word_id).where(WordBookItem.word_book_id == book.id)
            ).all()
        )
        progress_items: list[UserWordProgress] = []
        if word_ids:
            progress_items = list(
                session.exec(
                    select(UserWordProgress).where(
                        UserWordProgress.user_id == user.id,
                        UserWordProgress.word_id.in_(word_ids),
                        UserWordProgress.word_book_id == book.id,
                    )
                ).all()
            )

        added_count = len(progress_items)
        studied_count = sum(1 for item in progress_items if item.last_reviewed_at is not None)
        mastered_count = sum(1 for item in progress_items if item.status == ProgressStatus.mastered)
        mistake_count = sum(1 for item in progress_items if item.wrong_count > 0)
        learning_count = max(0, added_count - mastered_count)
        completion_rate = round((studied_count / word_count) * 100) if word_count else 0

        results.append(
            {
                "id": book.id,
                "title": book.title,
                "description": book.description,
                "category": book.category,
                "difficulty": book.difficulty,
                "word_count": word_count,
                "added_count": added_count,
                "studied_count": studied_count,
                "learning_count": learning_count,
                "mastered_count": mastered_count,
                "mistake_count": mistake_count,
                "completion_rate": completion_rate,
            }
        )

    if page is None:
        return results
    return {
        "items": results,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def get_word_book_with_count(session: Session, word_book_id: int) -> tuple[WordBook, int]:
    statement = (
        select(WordBook, func.count(WordBookItem.id))
        .join(WordBookItem, isouter=True)
        .where(WordBook.id == word_book_id)
        .group_by(WordBook.id)
    )
    result = session.exec(statement).first()
    if not result:
        raise HTTPException(status_code=404, detail="Word book not found")
    return result


def update_word_book(session: Session, word_book_id: int, data: dict[str, str | None]) -> WordBook:
    book = session.get(WordBook, word_book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Word book not found")

    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="Word book title is required")
        book.title = title
    if "description" in data:
        book.description = (data.get("description") or "").strip()
    if "category" in data:
        book.category = (data.get("category") or "").strip() or "通用"
    if "difficulty" in data:
        book.difficulty = (data.get("difficulty") or "").strip() or "标准"

    session.add(book)
    session.commit()
    session.refresh(book)
    return book


def delete_word_book(session: Session, word_book_id: int) -> None:
    book = session.get(WordBook, word_book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Word book not found")

    items = session.exec(
        select(WordBookItem).where(WordBookItem.word_book_id == word_book_id)
    ).all()
    _clear_progress_for_book_words(session, word_book_id)
    for item in items:
        session.delete(item)
    session.delete(book)
    session.commit()


def list_word_book_words(
    session: Session, word_book_id: int, page: int = 1, page_size: int = 50
) -> dict[str, object]:
    if not session.get(WordBook, word_book_id):
        raise HTTPException(status_code=404, detail="Word book not found")

    base = (
        select(Word)
        .join(WordBookItem, WordBookItem.word_id == Word.id)
        .where(WordBookItem.word_book_id == word_book_id)
    )
    total = session.exec(select(func.count()).select_from(base.subquery())).one()
    words = list(
        session.exec(base.order_by(Word.id).offset((page - 1) * page_size).limit(page_size)).all()
    )
    return {
        "items": words,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def search_word_book_words(
    session: Session,
    word_book_id: int,
    query: str,
    page: int = 1,
    page_size: int = 50,
) -> dict[str, object]:
    if not session.get(WordBook, word_book_id):
        raise HTTPException(status_code=404, detail="Word book not found")

    base = (
        select(Word)
        .join(WordBookItem, WordBookItem.word_id == Word.id)
        .where(WordBookItem.word_book_id == word_book_id)
    )
    if query:
        q = f"%{query}%"
        base = base.where(
            (Word.text.ilike(q)) | (Word.meaning.ilike(q))
        )
    total = session.exec(select(func.count()).select_from(base.subquery())).one()
    words = list(
        session.exec(base.order_by(Word.id).offset((page - 1) * page_size).limit(page_size)).all()
    )
    return {
        "items": words,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def list_word_book_word_progress(
    session: Session, user: User, word_book_id: int
) -> list[dict[str, object]]:
    words = list(
        session.exec(
            select(Word)
            .join(WordBookItem, WordBookItem.word_id == Word.id)
            .where(WordBookItem.word_book_id == word_book_id)
            .order_by(Word.id)
        ).all()
    )
    word_ids = [word.id for word in words]
    progress_by_word_id: dict[int, UserWordProgress] = {}

    if word_ids:
        progress_items = session.exec(
            select(UserWordProgress).where(
                UserWordProgress.user_id == user.id,
                UserWordProgress.word_id.in_(word_ids),
                UserWordProgress.word_book_id == word_book_id,
            )
        ).all()
        progress_by_word_id = {item.word_id: item for item in progress_items}

    results: list[dict[str, object]] = []
    for word in words:
        progress = progress_by_word_id.get(word.id)
        results.append(
            {
                "word": word,
                "status": progress.status if progress else None,
                "mastery_level": progress.mastery_level if progress else 0,
                "easiness_factor": progress.easiness_factor if progress else 2.5,
                "interval_days": progress.interval_days if progress else 0,
                "correct_count": progress.correct_count if progress else 0,
                "wrong_count": progress.wrong_count if progress else 0,
                "last_reviewed_at": progress.last_reviewed_at if progress else None,
                "next_review_at": progress.next_review_at if progress else None,
                "is_leech": progress.is_leech if progress else False,
                "is_favorite": is_favorite_word(session, user, word.id),
            }
        )
    return results


def get_word_book_progress_summary(session: Session, user: User, word_book_id: int) -> dict[str, int]:
    if not session.get(WordBook, word_book_id):
        raise HTTPException(status_code=404, detail="Word book not found")

    word_ids = list(
        session.exec(
            select(WordBookItem.word_id).where(WordBookItem.word_book_id == word_book_id)
        ).all()
    )
    progress_items: list[UserWordProgress] = []
    if word_ids:
        progress_items = list(
            session.exec(
                select(UserWordProgress).where(
                    UserWordProgress.user_id == user.id,
                    UserWordProgress.word_book_id == word_book_id,
                    UserWordProgress.word_id.in_(word_ids),
                )
            ).all()
        )

    mastered = sum(1 for item in progress_items if item.status == ProgressStatus.mastered)
    return {
        "total": len(word_ids),
        "added": len(progress_items),
        "studied": sum(1 for item in progress_items if item.last_reviewed_at is not None),
        "mastered": mastered,
        "mistakes": sum(1 for item in progress_items if item.wrong_count > 0),
        "reviewing": sum(1 for item in progress_items if item.status == ProgressStatus.reviewing),
        "completionRate": round((mastered / len(word_ids)) * 100) if word_ids else 0,
    }


def list_word_book_word_progress_paginated(
    session: Session,
    user: User,
    word_book_id: int,
    page: int = 1,
    page_size: int = 30,
    query: str = "",
    status_filter: str = "all",
) -> dict[str, object]:
    if not session.get(WordBook, word_book_id):
        raise HTTPException(status_code=404, detail="Word book not found")

    join_condition = (
        (UserWordProgress.word_id == Word.id)
        & (UserWordProgress.user_id == user.id)
        & (UserWordProgress.word_book_id == word_book_id)
    )
    statement = (
        select(Word, UserWordProgress)
        .join(WordBookItem, WordBookItem.word_id == Word.id)
        .join(UserWordProgress, join_condition, isouter=True)
        .where(WordBookItem.word_book_id == word_book_id)
    )
    count_statement = (
        select(func.count())
        .select_from(Word)
        .join(WordBookItem, WordBookItem.word_id == Word.id)
        .join(UserWordProgress, join_condition, isouter=True)
        .where(WordBookItem.word_book_id == word_book_id)
    )

    keyword = query.strip()
    if keyword:
        pattern = f"%{keyword}%"
        search_condition = (
            (Word.text.ilike(pattern))
            | (Word.meaning.ilike(pattern))
            | (Word.part_of_speech.ilike(pattern))
            | (Word.example_sentence.ilike(pattern))
        )
        statement = statement.where(search_condition)
        count_statement = count_statement.where(search_condition)

    if status_filter == "none":
        statement = statement.where(UserWordProgress.id == None)  # noqa: E711
        count_statement = count_statement.where(UserWordProgress.id == None)  # noqa: E711
    elif status_filter == "mistake":
        statement = statement.where(UserWordProgress.wrong_count > 0)
        count_statement = count_statement.where(UserWordProgress.wrong_count > 0)
    elif status_filter != "all":
        try:
            status_value = ProgressStatus(status_filter)
            statement = statement.where(UserWordProgress.status == status_value)
            count_statement = count_statement.where(UserWordProgress.status == status_value)
        except ValueError:
            pass

    total = session.exec(count_statement).one()
    rows = list(
        session.exec(
            statement
            .order_by(Word.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    items = [
        {
            "word": word,
            "status": progress.status if progress else None,
            "mastery_level": progress.mastery_level if progress else 0,
            "easiness_factor": progress.easiness_factor if progress else 2.5,
            "interval_days": progress.interval_days if progress else 0,
            "correct_count": progress.correct_count if progress else 0,
            "wrong_count": progress.wrong_count if progress else 0,
            "last_reviewed_at": progress.last_reviewed_at if progress else None,
            "next_review_at": progress.next_review_at if progress else None,
            "is_leech": progress.is_leech if progress else False,
            "is_favorite": is_favorite_word(session, user, word.id),
        }
        for word, progress in rows
    ]
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
        "summary": get_word_book_progress_summary(session, user, word_book_id),
    }


def export_word_book_csv(session: Session, word_book_id: int) -> str:
    if not session.get(WordBook, word_book_id):
        raise HTTPException(status_code=404, detail="Word book not found")

    words = list(
        session.exec(
            select(Word)
            .join(WordBookItem, WordBookItem.word_id == Word.id)
            .where(WordBookItem.word_book_id == word_book_id)
            .order_by(Word.id)
        ).all()
    )
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "word",
            "phonetic",
            "meaning",
            "part_of_speech",
            "example_sentence",
            "example_translation",
            "note",
        ],
        lineterminator="\n",
    )
    writer.writeheader()
    for word in words:
        writer.writerow(
            {
                "word": word.text,
                "phonetic": word.phonetic or "",
                "meaning": word.meaning,
                "part_of_speech": word.part_of_speech or "",
                "example_sentence": word.example_sentence or "",
                "example_translation": word.example_translation or "",
                "note": word.note or "",
            }
        )
    return output.getvalue()


def add_word_to_book(
    session: Session,
    word_book_id: int,
    data: dict[str, str | None],
    user: User | None = None,
) -> Word:
    if not session.get(WordBook, word_book_id):
        raise HTTPException(status_code=404, detail="Word book not found")

    word = Word(
        text=(data.get("text") or "").strip(),
        meaning=(data.get("meaning") or "").strip(),
        phonetic=(data.get("phonetic") or None),
        part_of_speech=(data.get("part_of_speech") or None),
        example_sentence=(data.get("example_sentence") or None),
        example_translation=(data.get("example_translation") or None),
        note=(data.get("note") or None),
    )
    if not word.text or not word.meaning:
        raise HTTPException(status_code=400, detail="Word and meaning are required")

    session.add(word)
    session.commit()
    session.refresh(word)
    session.add(WordBookItem(word_book_id=word_book_id, word_id=word.id))
    if user:
        session.add(
            UserWordProgress(user_id=user.id, word_id=word.id, word_book_id=word_book_id)
        )
    session.commit()
    session.refresh(word)
    return word


def update_word(session: Session, word_id: int, data: dict[str, str | None]) -> Word:
    word = session.get(Word, word_id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    for field in [
        "text",
        "meaning",
        "phonetic",
        "part_of_speech",
        "example_sentence",
        "example_translation",
        "note",
    ]:
        if field not in data:
            continue
        value = data[field]
        if isinstance(value, str):
            value = value.strip() or None
        setattr(word, field, value)

    if not word.text or not word.meaning:
        raise HTTPException(status_code=400, detail="Word and meaning are required")

    session.add(word)
    session.commit()
    session.refresh(word)
    return word


def get_word_detail_for_user(session: Session, user: User, word_id: int) -> dict[str, object]:
    word = session.get(Word, word_id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    progress_items = list(
        session.exec(
            select(UserWordProgress)
            .where(
                UserWordProgress.user_id == user.id,
                UserWordProgress.word_id == word_id,
            )
            .order_by(UserWordProgress.last_reviewed_at.desc())
        ).all()
    )
    progress = progress_items[0] if progress_items else None

    return {
        "word": word,
        "word_book_id": progress.word_book_id if progress else None,
        "status": progress.status if progress else None,
        "mastery_level": progress.mastery_level if progress else 0,
        "easiness_factor": progress.easiness_factor if progress else 2.5,
        "interval_days": progress.interval_days if progress else 0,
        "correct_count": progress.correct_count if progress else 0,
        "wrong_count": progress.wrong_count if progress else 0,
        "last_reviewed_at": progress.last_reviewed_at if progress else None,
        "next_review_at": progress.next_review_at if progress else None,
        "is_leech": progress.is_leech if progress else False,
        "is_favorite": is_favorite_word(session, user, word_id),
    }


def remove_word_from_book(session: Session, word_book_id: int, word_id: int) -> bool:
    book = session.get(WordBook, word_book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Word book not found")

    item = session.exec(
        select(WordBookItem).where(
            WordBookItem.word_book_id == word_book_id,
            WordBookItem.word_id == word_id,
        )
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Word is not in this word book")

    _clear_progress_for_book_words(session, word_book_id, [word_id])
    session.delete(item)
    session.flush()
    word_book_deleted = _delete_word_book_if_empty(session, book)
    session.commit()
    return word_book_deleted


def batch_delete_word_books(session: Session, word_book_ids: list[int]) -> int:
    deleted = 0
    for word_book_id in word_book_ids:
        book = session.get(WordBook, word_book_id)
        if not book:
            continue
        items = session.exec(
            select(WordBookItem).where(WordBookItem.word_book_id == word_book_id)
        ).all()
        _clear_progress_for_book_words(session, word_book_id)
        for item in items:
            session.delete(item)
        session.delete(book)
        deleted += 1
    session.commit()
    return deleted


def batch_delete_words(session: Session, word_book_id: int, word_ids: list[int]) -> tuple[int, bool]:
    book = session.get(WordBook, word_book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Word book not found")

    items = session.exec(
        select(WordBookItem).where(
            WordBookItem.word_book_id == word_book_id,
            WordBookItem.word_id.in_(word_ids),
        )
    ).all()
    count = 0
    for item in items:
        session.delete(item)
        count += 1
    if count:
        _clear_progress_for_book_words(session, word_book_id, [item.word_id for item in items])
        session.flush()
    word_book_deleted = _delete_word_book_if_empty(session, book) if count else False
    session.commit()
    return count, word_book_deleted


def batch_move_words(
    session: Session, word_book_id: int, word_ids: list[int], target_word_book_id: int
) -> int:
    if not session.get(WordBook, word_book_id):
        raise HTTPException(status_code=404, detail="Source word book not found")
    if not session.get(WordBook, target_word_book_id):
        raise HTTPException(status_code=404, detail="Target word book not found")

    source_items = session.exec(
        select(WordBookItem).where(
            WordBookItem.word_book_id == word_book_id,
            WordBookItem.word_id.in_(word_ids),
        )
    ).all()
    source_word_ids = [item.word_id for item in source_items]
    if not source_word_ids:
        return 0

    existing = set(
        session.exec(
            select(WordBookItem.word_id).where(
                WordBookItem.word_book_id == target_word_book_id,
                WordBookItem.word_id.in_(source_word_ids),
            )
        ).all()
    )

    for word_id in source_word_ids:
        if word_id not in existing:
            session.add(WordBookItem(word_book_id=target_word_book_id, word_id=word_id))

    for progress in session.exec(
        select(UserWordProgress).where(
            UserWordProgress.word_book_id == word_book_id,
            UserWordProgress.word_id.in_(source_word_ids),
        )
    ).all():
        _merge_progress_into_target_book(session, progress, target_word_book_id)

    for log in session.exec(
        select(ReviewLog).where(
            ReviewLog.word_book_id == word_book_id,
            ReviewLog.word_id.in_(source_word_ids),
        )
    ).all():
        log.word_book_id = target_word_book_id
        session.add(log)

    for item in source_items:
        session.delete(item)
    session.commit()
    return len(source_items)


def parse_word_book_csv(session: Session, content: bytes) -> dict[str, object]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="CSV file must be UTF-8 encoded") from exc

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    normalized_headers = {name.strip().lower(): name for name in reader.fieldnames if name}
    required_headers = {"word", "meaning"}
    missing_headers = required_headers - set(normalized_headers)
    if missing_headers:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required CSV columns: {', '.join(sorted(missing_headers))}",
        )

    def get_value(row: dict[str, str], key: str) -> str | None:
        header = normalized_headers.get(key)
        if not header:
            return None
        value = row.get(header)
        return value.strip() if value else None

    rows = []
    errors = []
    seen_words: set[str] = set()
    total_rows = 0
    for line_number, row in enumerate(reader, start=2):
        total_rows += 1
        word_text = get_value(row, "word")
        meaning = get_value(row, "meaning")
        if not word_text and not meaning:
            continue
        if not word_text or not meaning:
            errors.append(
                {
                    "row_number": line_number,
                    "message": "word and meaning are both required",
                }
            )
            continue
        normalized_word = word_text.strip().lower()
        duplicate_in_file = normalized_word in seen_words
        seen_words.add(normalized_word)
        rows.append(
            {
                "row_number": line_number,
                "word": word_text,
                "meaning": meaning,
                "phonetic": get_value(row, "phonetic"),
                "part_of_speech": get_value(row, "part_of_speech"),
                "example_sentence": get_value(row, "example_sentence"),
                "example_translation": get_value(row, "example_translation"),
                "note": get_value(row, "note"),
                "duplicate_in_file": duplicate_in_file,
            }
        )

    existing_words: set[str] = set()
    if rows:
        word_texts = [row["word"] for row in rows]
        existing_words = {
            item.lower()
            for item in session.exec(select(Word.text).where(Word.text.in_(word_texts))).all()
        }
        lower_word_texts = [word.lower() for word in word_texts]
        existing_words.update(
            item.lower()
            for item in session.exec(select(Word.text).where(func.lower(Word.text).in_(lower_word_texts))).all()
        )

    for row in rows:
        row["duplicate_in_database"] = row["word"].lower() in existing_words

    return {
        "total_rows": total_rows,
        "valid_count": len(rows),
        "error_count": len(errors),
        "duplicate_in_file_count": sum(1 for row in rows if row["duplicate_in_file"]),
        "duplicate_in_database_count": sum(1 for row in rows if row["duplicate_in_database"]),
        "words": rows,
        "errors": errors,
    }


def import_word_book_from_csv(
    session: Session,
    title: str,
    description: str,
    content: bytes,
    category: str = "通用",
    difficulty: str = "标准",
) -> tuple[WordBook, int, int]:
    if not title.strip():
        raise HTTPException(status_code=400, detail="Word book title is required")

    preview = parse_word_book_csv(session, content)
    rows = preview["words"]
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file has no valid words")
    if preview["error_count"]:
        raise HTTPException(status_code=400, detail="CSV file contains invalid rows")

    book = WordBook(
        title=title.strip(),
        description=description.strip(),
        category=category.strip() or "通用",
        difficulty=difficulty.strip() or "标准",
    )
    session.add(book)
    session.commit()
    session.refresh(book)

    lower_words = [row["word"].lower() for row in rows]
    existing_by_text = {
        word.text.lower(): word
        for word in session.exec(select(Word).where(func.lower(Word.text).in_(lower_words))).all()
    }

    imported_count = 0
    skipped_count = 0
    for row in rows:
        if row["duplicate_in_file"]:
            skipped_count += 1
            continue

        word = existing_by_text.get(row["word"].lower())
        if word is None:
            word = Word(
                text=row["word"],
                meaning=row["meaning"],
                phonetic=row["phonetic"],
                part_of_speech=row["part_of_speech"],
                example_sentence=row["example_sentence"],
                example_translation=row["example_translation"],
                note=row["note"],
            )
            session.add(word)
            session.commit()
            session.refresh(word)
            existing_by_text[word.text.lower()] = word
        session.add(WordBookItem(word_book_id=book.id, word_id=word.id))
        imported_count += 1

    session.commit()
    return book, imported_count, skipped_count


def select_word_book(session: Session, user: User, word_book_id: int) -> int:
    word_book = session.get(WordBook, word_book_id)
    if not word_book:
        raise HTTPException(status_code=404, detail="Word book not found")

    word_ids = session.exec(
        select(WordBookItem.word_id).where(WordBookItem.word_book_id == word_book_id)
    ).all()
    existing_word_ids = set(
        session.exec(
            select(UserWordProgress.word_id).where(
                UserWordProgress.user_id == user.id,
                UserWordProgress.word_id.in_(word_ids),
                UserWordProgress.word_book_id == word_book_id,
            )
        ).all()
    )

    created = 0
    for word_id in word_ids:
        if word_id in existing_word_ids:
            continue
        session.add(
            UserWordProgress(user_id=user.id, word_id=word_id, word_book_id=word_book_id)
        )
        created += 1
    session.commit()
    return created


def get_or_create_user_settings(session: Session, user: User) -> UserSettings:
    settings = session.exec(
        select(UserSettings).where(UserSettings.user_id == user.id)
    ).first()
    if settings:
        return settings

    settings = UserSettings(user_id=user.id)
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings


def update_user_settings(
    session: Session,
    user: User,
    daily_new_limit: int | None,
    daily_review_limit: int | None,
    default_study_mode: StudyMode | None = None,
    auto_play_word: bool | None = None,
    auto_play_example: bool | None = None,
    auto_reveal_after_audio: bool | None = None,
    auto_advance: bool | None = None,
    speech_accent: str | None = None,
    answer_delay_ms: int | None = None,
    word_book_page_size: int | None = None,
    onboarding_completed: bool | None = None,
    learning_goal: str | None = None,
    english_level: str | None = None,
    exam_type: str | None = None,
    target_date: str | None = None,
    daily_minutes: int | None = None,
    wants_speaking: bool | None = None,
    wants_listening: bool | None = None,
    wants_ai_tutor: bool | None = None,
    reminder_enabled: bool | None = None,
    reminder_time: str | None = None,
    membership_tier: str | None = None,
    membership_expires_at: datetime | None = None,
) -> UserSettings:
    settings = get_or_create_user_settings(session, user)
    if daily_new_limit is not None:
        settings.daily_new_limit = daily_new_limit
    if daily_review_limit is not None:
        settings.daily_review_limit = daily_review_limit
    if default_study_mode is not None:
        settings.default_study_mode = default_study_mode
    if auto_play_word is not None:
        settings.auto_play_word = auto_play_word
    if auto_play_example is not None:
        settings.auto_play_example = auto_play_example
    if auto_reveal_after_audio is not None:
        settings.auto_reveal_after_audio = auto_reveal_after_audio
    if auto_advance is not None:
        settings.auto_advance = auto_advance
    if speech_accent is not None:
        settings.speech_accent = speech_accent
    if answer_delay_ms is not None:
        settings.answer_delay_ms = max(300, min(3000, answer_delay_ms))
    if word_book_page_size is not None:
        settings.word_book_page_size = max(10, min(100, word_book_page_size))
    if onboarding_completed is not None:
        settings.onboarding_completed = onboarding_completed
    if learning_goal is not None:
        settings.learning_goal = learning_goal.strip() or None
    if english_level is not None:
        settings.english_level = english_level.strip() or None
    if exam_type is not None:
        settings.exam_type = exam_type.strip() or None
    if target_date is not None:
        settings.target_date = target_date.strip() or None
    if daily_minutes is not None:
        settings.daily_minutes = max(5, min(240, daily_minutes))
    if wants_speaking is not None:
        settings.wants_speaking = wants_speaking
    if wants_listening is not None:
        settings.wants_listening = wants_listening
    if wants_ai_tutor is not None:
        settings.wants_ai_tutor = wants_ai_tutor
    if reminder_enabled is not None:
        settings.reminder_enabled = reminder_enabled
    if reminder_time is not None:
        settings.reminder_time = reminder_time.strip() or None
    if membership_tier is not None:
        settings.membership_tier = membership_tier.strip() or "free"
    if membership_expires_at is not None:
        settings.membership_expires_at = membership_expires_at
    settings.updated_at = datetime.utcnow()
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings


def get_due_new_items(
    session: Session, user: User, limit: int | None = None
) -> list[UserWordProgress]:
    now = datetime.utcnow()
    settings = get_or_create_user_settings(session, user)
    item_limit = limit or settings.daily_new_limit
    return list(
        session.exec(
            select(UserWordProgress)
            .where(
                UserWordProgress.user_id == user.id,
                UserWordProgress.status == ProgressStatus.new,
                UserWordProgress.next_review_at <= now,
            )
            .order_by(UserWordProgress.next_review_at)
            .limit(item_limit)
        ).all()
    )


def get_due_review_items(
    session: Session, user: User, limit: int | None = None
) -> list[UserWordProgress]:
    now = datetime.utcnow()
    settings = get_or_create_user_settings(session, user)
    item_limit = limit or settings.daily_review_limit
    return list(
        session.exec(
            select(UserWordProgress)
            .where(
                UserWordProgress.user_id == user.id,
                UserWordProgress.status != ProgressStatus.new,
                UserWordProgress.next_review_at <= now,
            )
            .order_by(UserWordProgress.next_review_at)
            .limit(item_limit)
        ).all()
    )


def get_due_study_items(
    session: Session, user: User, limit: int = 10
) -> list[UserWordProgress]:
    return get_due_new_items(session, user, limit)


def is_favorite_word(session: Session, user: User, word_id: int) -> bool:
    return session.exec(
        select(FavoriteWord.id).where(
            FavoriteWord.user_id == user.id,
            FavoriteWord.word_id == word_id,
        )
    ).first() is not None


def _get_default_word_book_id(session: Session, word_id: int) -> int | None:
    return session.exec(
        select(WordBookItem.word_book_id)
        .where(WordBookItem.word_id == word_id)
        .order_by(WordBookItem.word_book_id)
    ).first()


def ensure_user_word_progress(
    session: Session,
    user: User,
    word_id: int,
    word_book_id: int | None = None,
) -> UserWordProgress:
    word = session.get(Word, word_id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    progress = session.exec(
        select(UserWordProgress).where(
            UserWordProgress.user_id == user.id,
            UserWordProgress.word_id == word_id,
        )
    ).first()
    if progress:
        return progress

    progress = UserWordProgress(
        user_id=user.id,
        word_id=word_id,
        word_book_id=word_book_id or _get_default_word_book_id(session, word_id),
    )
    session.add(progress)
    session.commit()
    session.refresh(progress)
    return progress


def favorite_word(session: Session, user: User, word_id: int) -> bool:
    ensure_user_word_progress(session, user, word_id)
    existing = session.exec(
        select(FavoriteWord).where(
            FavoriteWord.user_id == user.id,
            FavoriteWord.word_id == word_id,
        )
    ).first()
    if existing:
        return True

    session.add(FavoriteWord(user_id=user.id, word_id=word_id))
    session.commit()
    return True


def unfavorite_word(session: Session, user: User, word_id: int) -> bool:
    favorite = session.exec(
        select(FavoriteWord).where(
            FavoriteWord.user_id == user.id,
            FavoriteWord.word_id == word_id,
        )
    ).first()
    if favorite:
        session.delete(favorite)
        session.commit()
    return False


def get_favorite_words_paginated(
    session: Session,
    user: User,
    page: int = 1,
    page_size: int = 20,
    query: str = "",
) -> dict[str, object]:
    statement = (
        select(FavoriteWord)
        .join(Word, Word.id == FavoriteWord.word_id)
        .where(FavoriteWord.user_id == user.id)
    )
    count_statement = (
        select(func.count())
        .select_from(FavoriteWord)
        .join(Word, Word.id == FavoriteWord.word_id)
        .where(FavoriteWord.user_id == user.id)
    )

    keyword = query.strip()
    if keyword:
        pattern = f"%{keyword}%"
        condition = (
            (Word.text.ilike(pattern))
            | (Word.meaning.ilike(pattern))
            | (Word.part_of_speech.ilike(pattern))
            | (Word.example_sentence.ilike(pattern))
        )
        statement = statement.where(condition)
        count_statement = count_statement.where(condition)

    total = session.exec(count_statement).one()
    items = list(
        session.exec(
            statement
            .order_by(FavoriteWord.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    progress_items = [
        ensure_user_word_progress(session, user, item.word_id)
        for item in items
    ]
    return {
        "items": progress_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def answer_word(
    session: Session,
    user: User,
    word_id: int,
    quality: int,
    study_mode: StudyMode = StudyMode.en_to_cn,
    word_book_id: int | None = None,
) -> UserWordProgress:
    query = select(UserWordProgress).where(
        UserWordProgress.user_id == user.id,
        UserWordProgress.word_id == word_id,
    )
    if word_book_id is not None:
        query = query.where(UserWordProgress.word_book_id == word_book_id)

    progress = session.exec(
        query
    ).first()
    if not progress:
        raise HTTPException(status_code=404, detail="Word progress not found")

    now = datetime.utcnow()
    is_correct = quality > 0
    progress.last_reviewed_at = now

    ef = max(1.3, progress.easiness_factor)
    prev_interval = max(1.0, progress.interval_days or 1.0)

    if quality == 0:
        progress.wrong_count += 1
        progress.consecutive_correct = 0
        progress.easiness_factor = max(1.3, ef - 0.2)
        progress.mastery_level = max(0, progress.mastery_level - 1)
        if progress.status == ProgressStatus.new:
            progress.status = ProgressStatus.learning
            interval = 10 / 1440
            progress.interval_days = interval
            progress.next_review_at = now + timedelta(days=interval)
        else:
            progress.status = ProgressStatus.learning
            interval = 10 / 1440
            progress.interval_days = interval
            progress.next_review_at = now + timedelta(days=interval)
    elif quality == 1:
        progress.correct_count += 1
        progress.consecutive_correct += 1
        progress.easiness_factor = max(1.3, ef - 0.15)
        if progress.status == ProgressStatus.new:
            progress.status = ProgressStatus.learning
            progress.interval_days = 1
            progress.next_review_at = now + timedelta(days=progress.interval_days)
        else:
            progress.mastery_level = max(1, progress.mastery_level)
            progress.status = ProgressStatus.learning
            progress.interval_days = 1
            progress.next_review_at = now + timedelta(days=progress.interval_days)
    elif quality == 2:
        progress.correct_count += 1
        progress.consecutive_correct += 1
        progress.easiness_factor = ef
        if progress.status == ProgressStatus.new:
            progress.status = ProgressStatus.learning
            progress.interval_days = 2
            progress.next_review_at = now + timedelta(days=progress.interval_days)
        elif progress.status == ProgressStatus.learning:
            progress.mastery_level += 1
            progress.status = ProgressStatus.reviewing
            interval = max(3, prev_interval * ef)
            progress.interval_days = interval
            progress.next_review_at = now + timedelta(days=interval)
        else:
            progress.mastery_level += 1
            interval = max(3, prev_interval * ef)
            progress.interval_days = interval
            progress.next_review_at = now + timedelta(days=interval)
    else:  # quality == 3
        progress.correct_count += 1
        progress.consecutive_correct += 1
        progress.easiness_factor = min(3.5, ef + 0.1)
        if progress.status == ProgressStatus.new:
            progress.status = ProgressStatus.learning
            progress.interval_days = 3
            progress.next_review_at = now + timedelta(days=progress.interval_days)
        elif progress.status == ProgressStatus.learning:
            progress.mastery_level += 2
            if progress.mastery_level >= 5:
                progress.status = ProgressStatus.mastered
                progress.interval_days = 30
                progress.next_review_at = now + timedelta(days=progress.interval_days)
            else:
                progress.status = ProgressStatus.reviewing
                interval = max(4, prev_interval * ef * 1.3)
                progress.interval_days = interval
                progress.next_review_at = now + timedelta(days=interval)
        else:
            progress.mastery_level += 2
            if progress.mastery_level >= 7:
                progress.status = ProgressStatus.mastered
                progress.interval_days = 60
                progress.next_review_at = now + timedelta(days=progress.interval_days)
            else:
                progress.status = ProgressStatus.reviewing
                interval = max(4, prev_interval * ef * 1.3)
                progress.interval_days = interval
                progress.next_review_at = now + timedelta(days=interval)

    if progress.wrong_count >= LEECH_THRESHOLD and progress.mastery_level < 3:
        progress.is_leech = True
    if progress.mastery_level >= 3 and progress.is_leech:
        progress.is_leech = False

    session.add(
        ReviewLog(
            user_id=user.id,
            word_id=word_id,
            word_book_id=word_book_id or progress.word_book_id,
            study_mode=study_mode,
            quality=quality,
            is_correct=is_correct,
        )
    )
    session.add(progress)
    session.commit()
    session.refresh(progress)
    return progress


def schedule_mistake_practice(
    session: Session, user: User, word_id: int
) -> UserWordProgress:
    progress = session.exec(
        select(UserWordProgress).where(
            UserWordProgress.user_id == user.id,
            UserWordProgress.word_id == word_id,
            UserWordProgress.wrong_count > 0,
        )
    ).first()
    if not progress:
        raise HTTPException(status_code=404, detail="Mistake word not found")

    progress.status = ProgressStatus.learning
    progress.next_review_at = datetime.utcnow()
    session.add(progress)
    session.commit()
    session.refresh(progress)
    return progress


def schedule_mistake_practice_batch(
    session: Session, user: User, word_ids: list[int]
) -> int:
    progresses = session.exec(
        select(UserWordProgress).where(
            UserWordProgress.user_id == user.id,
            UserWordProgress.word_id.in_(word_ids),
            UserWordProgress.wrong_count > 0,
        )
    ).all()
    now = datetime.utcnow()
    for progress in progresses:
        progress.status = ProgressStatus.learning
        progress.next_review_at = now
        session.add(progress)
    session.commit()
    return len(progresses)


def resolve_mistake(session: Session, user: User, word_id: int) -> UserWordProgress:
    progress = session.exec(
        select(UserWordProgress).where(
            UserWordProgress.user_id == user.id,
            UserWordProgress.word_id == word_id,
            UserWordProgress.wrong_count > 0,
        )
    ).first()
    if not progress:
        raise HTTPException(status_code=404, detail="Mistake word not found")

    progress.wrong_count = 0
    progress.is_leech = False
    progress.mastery_level = max(progress.mastery_level, 2)
    if progress.status == ProgressStatus.learning:
        progress.status = ProgressStatus.reviewing
    session.add(progress)
    session.commit()
    session.refresh(progress)
    return progress


def get_mistakes(session: Session, user: User) -> list[UserWordProgress]:
    return list(
        session.exec(
            select(UserWordProgress)
            .where(
                UserWordProgress.user_id == user.id,
                UserWordProgress.wrong_count > 0,
            )
            .order_by(UserWordProgress.wrong_count.desc())
        ).all()
    )


def get_mistakes_paginated(
    session: Session,
    user: User,
    page: int = 1,
    page_size: int = 20,
    query: str = "",
) -> dict[str, object]:
    statement = (
        select(UserWordProgress)
        .join(Word, Word.id == UserWordProgress.word_id)
        .where(
            UserWordProgress.user_id == user.id,
            UserWordProgress.wrong_count > 0,
        )
    )
    count_statement = (
        select(func.count())
        .select_from(UserWordProgress)
        .join(Word, Word.id == UserWordProgress.word_id)
        .where(
            UserWordProgress.user_id == user.id,
            UserWordProgress.wrong_count > 0,
        )
    )
    keyword = query.strip()
    if keyword:
        pattern = f"%{keyword}%"
        condition = (Word.text.ilike(pattern)) | (Word.meaning.ilike(pattern))
        statement = statement.where(condition)
        count_statement = count_statement.where(condition)

    total = session.exec(count_statement).one()
    items = list(
        session.exec(
            statement
            .order_by(UserWordProgress.wrong_count.desc(), UserWordProgress.last_reviewed_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def get_review_history(
    session: Session, user: User, limit: int = 30
) -> list[ReviewLog]:
    return list(
        session.exec(
            select(ReviewLog)
            .where(ReviewLog.user_id == user.id)
            .order_by(ReviewLog.created_at.desc())
            .limit(limit)
        ).all()
    )


def get_review_history_paginated(
    session: Session,
    user: User,
    page: int = 1,
    page_size: int = 20,
    query: str = "",
) -> dict[str, object]:
    statement = (
        select(ReviewLog)
        .join(Word, Word.id == ReviewLog.word_id, isouter=True)
        .where(ReviewLog.user_id == user.id)
    )
    count_statement = (
        select(func.count())
        .select_from(ReviewLog)
        .join(Word, Word.id == ReviewLog.word_id, isouter=True)
        .where(ReviewLog.user_id == user.id)
    )
    keyword = query.strip()
    if keyword:
        pattern = f"%{keyword}%"
        condition = (Word.text.ilike(pattern)) | (Word.meaning.ilike(pattern))
        statement = statement.where(condition)
        count_statement = count_statement.where(condition)

    total = session.exec(count_statement).one()
    items = list(
        session.exec(
            statement
            .order_by(ReviewLog.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def get_activity_summary(
    session: Session, user: User, days: int = 7
) -> list[dict[str, int | str]]:
    now = datetime.utcnow()
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    logs = list(
        session.exec(
            select(ReviewLog).where(
                ReviewLog.user_id == user.id,
                ReviewLog.created_at >= start,
            )
        ).all()
    )
    activity = {
        (start + timedelta(days=index)).date().isoformat(): {"reviews": 0, "correct": 0}
        for index in range(days)
    }
    for log in logs:
        key = log.created_at.date().isoformat()
        if key not in activity:
            continue
        activity[key]["reviews"] += 1
        if log.is_correct:
            activity[key]["correct"] += 1

    return [
        {"date": date, "reviews": values["reviews"], "correct": values["correct"]}
        for date, values in activity.items()
    ]


def get_streak_days(session: Session, user: User) -> int:
    logs = list(
        session.exec(
            select(ReviewLog.created_at)
            .where(ReviewLog.user_id == user.id)
            .order_by(ReviewLog.created_at.desc())
        ).all()
    )
    review_dates = {created_at.date() for created_at in logs}
    today = datetime.utcnow().date()
    streak = 0
    while today - timedelta(days=streak) in review_dates:
        streak += 1
    return streak


def get_stats(session: Session, user: User) -> dict[str, int | list[dict[str, int | str]]]:
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=6)
    settings = get_or_create_user_settings(session, user)
    progress = list(
        session.exec(select(UserWordProgress).where(UserWordProgress.user_id == user.id)).all()
    )
    completed_today = session.exec(
        select(func.count(ReviewLog.id)).where(
            ReviewLog.user_id == user.id,
            ReviewLog.created_at >= today_start,
        )
    ).one()
    total_reviews = session.exec(
        select(func.count(ReviewLog.id)).where(ReviewLog.user_id == user.id)
    ).one()
    correct_reviews = session.exec(
        select(func.count(ReviewLog.id)).where(
            ReviewLog.user_id == user.id,
            ReviewLog.is_correct == True,  # noqa: E712
        )
    ).one()
    weekly_reviews = session.exec(
        select(func.count(ReviewLog.id)).where(
            ReviewLog.user_id == user.id,
            ReviewLog.created_at >= week_start,
        )
    ).one()
    weekly_correct = session.exec(
        select(func.count(ReviewLog.id)).where(
            ReviewLog.user_id == user.id,
            ReviewLog.created_at >= week_start,
            ReviewLog.is_correct == True,  # noqa: E712
        )
    ).one()
    available_new = sum(
        1
        for item in progress
        if item.status == ProgressStatus.new and item.next_review_at <= now
    )
    available_review = sum(
        1
        for item in progress
        if item.status != ProgressStatus.new and item.next_review_at <= now
    )
    reviewed_word_ids_today = set(
        session.exec(
            select(ReviewLog.word_id).where(
                ReviewLog.user_id == user.id,
                ReviewLog.created_at >= today_start,
            )
        ).all()
    )
    previously_reviewed_word_ids: set[int] = set()
    if reviewed_word_ids_today:
        previously_reviewed_word_ids = set(
            session.exec(
                select(ReviewLog.word_id).where(
                    ReviewLog.user_id == user.id,
                    ReviewLog.word_id.in_(reviewed_word_ids_today),
                    ReviewLog.created_at < today_start,
                )
            ).all()
        )
    new_completed_today = len(reviewed_word_ids_today - previously_reviewed_word_ids)
    review_completed_today = len(reviewed_word_ids_today & previously_reviewed_word_ids)
    due_new = min(available_new, max(0, settings.daily_new_limit - new_completed_today))
    due_review = min(available_review, max(0, settings.daily_review_limit - review_completed_today))
    mastered = sum(1 for item in progress if item.status == ProgressStatus.mastered)
    monthly_activity = get_activity_summary(session, user, 30)
    return {
        "total_learning": len(progress),
        "mastered": mastered,
        "mastered_rate": round((mastered / len(progress)) * 100) if progress else 0,
        "mistakes": sum(1 for item in progress if item.wrong_count > 0),
        "leeches": sum(1 for item in progress if item.is_leech),
        "due_today": due_new + due_review,
        "due_new": due_new,
        "due_review": due_review,
        "available_new": available_new,
        "available_review": available_review,
        "daily_new_limit": settings.daily_new_limit,
        "daily_review_limit": settings.daily_review_limit,
        "new_completed_today": new_completed_today,
        "review_completed_today": review_completed_today,
        "completed_today": completed_today,
        "total_reviews": total_reviews,
        "correct_reviews": correct_reviews,
        "correct_rate": round((correct_reviews / total_reviews) * 100) if total_reviews else 0,
        "weekly_reviews": weekly_reviews,
        "weekly_correct_rate": round((weekly_correct / weekly_reviews) * 100) if weekly_reviews else 0,
        "active_days_30": sum(1 for item in monthly_activity if item["reviews"] > 0),
        "streak_days": get_streak_days(session, user),
        "activity": get_activity_summary(session, user),
        "monthly_activity": monthly_activity,
    }


def get_learning_plan(session: Session, user: User) -> dict[str, object]:
    settings = get_or_create_user_settings(session, user)
    stats = get_stats(session, user)
    books = list_word_book_progress(session, user)
    active_books = [book for book in books if int(book["added_count"]) > 0]

    total_words = sum(int(book["word_count"]) for book in active_books)
    studied_words = sum(int(book["studied_count"]) for book in active_books)
    mastered_words = sum(int(book["mastered_count"]) for book in active_books)
    remaining_words = max(0, total_words - studied_words)
    overall_completion_rate = round((studied_words / total_words) * 100) if total_words else 0

    days_left: int | None = None
    if settings.target_date:
        try:
            target_date = datetime.fromisoformat(settings.target_date).date()
            days_left = max(0, (target_date - datetime.utcnow().date()).days)
        except ValueError:
            days_left = None

    estimated_finish_days = None
    if settings.daily_new_limit > 0 and remaining_words > 0:
        estimated_finish_days = max(1, (remaining_words + settings.daily_new_limit - 1) // settings.daily_new_limit)

    recommended_daily_new_limit = settings.daily_new_limit
    if days_left and remaining_words:
        recommended_daily_new_limit = max(1, min(100, (remaining_words + days_left - 1) // days_left))

    today_planned = settings.daily_new_limit + settings.daily_review_limit
    today_completion_rate = (
        round((int(stats["completed_today"]) / today_planned) * 100)
        if today_planned
        else 0
    )
    today_completion_rate = max(0, min(100, today_completion_rate))

    risk_level = "healthy"
    risk_message = "当前学习节奏稳定，按今日任务推进即可。"
    if not active_books:
        risk_level = "setup"
        risk_message = "还没有加入学习词库，请先选择一本词库生成计划。"
    elif days_left is not None and days_left == 0 and remaining_words > 0:
        risk_level = "high"
        risk_message = "目标日期已经到达，但仍有未学单词，需要重新设置目标日期或提高每日任务量。"
    elif days_left and estimated_finish_days and estimated_finish_days > days_left:
        risk_level = "high"
        risk_message = f"按当前每日新词量预计还需 {estimated_finish_days} 天，可能赶不上目标日期。建议每日新词调整到 {recommended_daily_new_limit} 个左右。"
    elif int(stats["available_review"]) > settings.daily_review_limit * 2:
        risk_level = "medium"
        risk_message = "到期复习积压较多，建议先降低新词量，优先清理复习。"
    elif int(stats["weekly_reviews"]) > 0 and int(stats["weekly_correct_rate"]) < 65:
        risk_level = "medium"
        risk_message = "本周正确率偏低，建议放慢新词节奏并增加错题复盘。"

    return {
        "learning_goal": settings.learning_goal,
        "english_level": settings.english_level,
        "target_date": settings.target_date,
        "daily_minutes": settings.daily_minutes,
        "daily_new_limit": settings.daily_new_limit,
        "daily_review_limit": settings.daily_review_limit,
        "total_words": total_words,
        "studied_words": studied_words,
        "mastered_words": mastered_words,
        "remaining_words": remaining_words,
        "overall_completion_rate": overall_completion_rate,
        "today_completion_rate": today_completion_rate,
        "days_left": days_left,
        "estimated_finish_days": estimated_finish_days,
        "recommended_daily_new_limit": recommended_daily_new_limit,
        "risk_level": risk_level,
        "risk_message": risk_message,
        "current_books": active_books,
    }


def _build_badge(code: str, title: str, description: str, progress: int, target: int) -> dict[str, object]:
    return {
        "code": code,
        "title": title,
        "description": description,
        "earned": progress >= target,
        "progress": min(progress, target),
        "target": target,
    }


def get_check_in_status(session: Session, user: User) -> dict[str, object]:
    stats = get_stats(session, user)
    logs = list(
        session.exec(
            select(ReviewLog.created_at).where(ReviewLog.user_id == user.id)
        ).all()
    )
    total_learning_days = len({created_at.date() for created_at in logs})
    remaining_tasks = int(stats["due_new"]) + int(stats["due_review"])
    completed_today = int(stats["completed_today"])
    today_total = completed_today + remaining_tasks
    today_progress_rate = round((completed_today / today_total) * 100) if today_total else 0
    checked_in_today = completed_today > 0

    streak_days = int(stats["streak_days"])
    active_days_30 = int(stats["active_days_30"])
    total_reviews = int(stats["total_reviews"])
    correct_rate = int(stats["correct_rate"])
    mastered_words = int(stats["mastered"])

    badges = [
        _build_badge("streak_3", "连续 3 天", "连续学习 3 天后获得", streak_days, 3),
        _build_badge("streak_7", "连续 7 天", "连续学习 7 天后获得", streak_days, 7),
        _build_badge("active_20", "月度活跃", "最近 30 天学习满 20 天", active_days_30, 20),
        _build_badge("mastered_50", "掌握 50 词", "累计掌握 50 个单词", mastered_words, 50),
        _build_badge("reviews_100", "百次练习", "累计完成 100 次答题练习", total_reviews, 100),
        _build_badge("accuracy_80", "稳定正确率", "累计练习达到 20 次且正确率不低于 80%", correct_rate if total_reviews >= 20 else 0, 80),
    ]

    return {
        "checked_in_today": checked_in_today,
        "can_check_in": checked_in_today and remaining_tasks == 0,
        "remaining_tasks": remaining_tasks,
        "completed_today": completed_today,
        "today_progress_rate": max(0, min(100, today_progress_rate)),
        "streak_days": streak_days,
        "active_days_30": active_days_30,
        "total_learning_days": total_learning_days,
        "total_reviews": total_reviews,
        "correct_rate": correct_rate,
        "mastered_words": mastered_words,
        "badges": badges,
    }


def get_learning_report(session: Session, user: User) -> dict[str, object]:
    stats = get_stats(session, user)
    progress_items = list(
        session.exec(
            select(UserWordProgress).where(UserWordProgress.user_id == user.id)
        ).all()
    )
    focus_items = sorted(
        [item for item in progress_items if item.wrong_count > 0],
        key=lambda item: (item.is_leech, item.wrong_count, -item.mastery_level),
        reverse=True,
    )[:6]

    strengths: list[str] = []
    weaknesses: list[str] = []
    recommendations: list[str] = []

    if int(stats["streak_days"]) >= 3:
        strengths.append(f"已经连续学习 {stats['streak_days']} 天，学习节奏开始稳定。")
    if int(stats["weekly_reviews"]) > 0 and int(stats["weekly_correct_rate"]) >= 80:
        strengths.append(f"本周正确率达到 {stats['weekly_correct_rate']}%，复习质量较好。")
    if int(stats["mastered"]) > 0:
        strengths.append(f"当前已有 {stats['mastered']} 个单词进入熟练掌握状态。")
    if int(stats["active_days_30"]) >= 10:
        strengths.append(f"最近 30 天有 {stats['active_days_30']} 天产生学习记录。")

    if int(stats["mistakes"]) > 0:
        weaknesses.append(f"错题本中还有 {stats['mistakes']} 个单词需要复盘。")
    if int(stats["leeches"]) > 0:
        weaknesses.append(f"其中 {stats['leeches']} 个属于高频错误难词。")
    if int(stats["available_review"]) > int(stats["daily_review_limit"]):
        weaknesses.append("到期复习数量超过每日复习上限，存在复习积压。")
    if int(stats["weekly_reviews"]) > 0 and int(stats["weekly_correct_rate"]) < 65:
        weaknesses.append(f"本周正确率为 {stats['weekly_correct_rate']}%，建议放慢新词节奏。")
    if int(stats["total_learning"]) == 0:
        weaknesses.append("还没有加入学习词库，暂时无法形成有效报告。")

    if int(stats["due_review"]) > 0:
        recommendations.append(f"优先完成 {stats['due_review']} 个到期复习，再学习新词。")
    if int(stats["due_new"]) > 0:
        recommendations.append(f"今天还可以学习 {stats['due_new']} 个新词，保持计划推进。")
    if focus_items:
        recommendations.append("先处理报告下方的重点错词，连续答对后再扩大新词量。")
    if int(stats["weekly_reviews"]) > 0 and int(stats["weekly_correct_rate"]) < 70:
        recommendations.append("建议使用拼写或听音模式交叉练习，减少只认不熟的问题。")
    if not recommendations:
        recommendations.append("当前没有明显积压，可以保持现有学习设置。")

    if not strengths:
        strengths.append("开始产生更多学习记录后，系统会自动总结你的优势。")
    if not weaknesses:
        weaknesses.append("当前没有明显薄弱项，继续按计划学习即可。")

    if int(stats["total_reviews"]) == 0:
        summary = "还没有完成练习记录，先完成一次新词或复习后会生成更完整的报告。"
    elif int(stats["weekly_correct_rate"]) >= 80 and int(stats["mistakes"]) <= 3:
        summary = "整体表现稳定，正确率和错题压力都处在较健康状态。"
    elif int(stats["mistakes"]) > 0 or int(stats["weekly_correct_rate"]) < 70:
        summary = "当前需要把重点放在错题复盘和复习质量上。"
    else:
        summary = "学习记录正在积累，建议保持每日短时高频练习。"

    return {
        "summary": summary,
        "total_learning": stats["total_learning"],
        "mastered": stats["mastered"],
        "mastered_rate": stats["mastered_rate"],
        "mistakes": stats["mistakes"],
        "leeches": stats["leeches"],
        "total_reviews": stats["total_reviews"],
        "correct_rate": stats["correct_rate"],
        "weekly_reviews": stats["weekly_reviews"],
        "weekly_correct_rate": stats["weekly_correct_rate"],
        "streak_days": stats["streak_days"],
        "active_days_30": stats["active_days_30"],
        "today_completed": stats["completed_today"],
        "today_remaining": stats["due_today"],
        "strengths": strengths[:4],
        "weaknesses": weaknesses[:4],
        "recommendations": recommendations[:4],
        "focus_words": [
            {
                "word_id": item.word_id,
                "text": item.word.text if item.word else "",
                "meaning": item.word.meaning if item.word else "",
                "wrong_count": item.wrong_count,
                "correct_count": item.correct_count,
                "mastery_level": item.mastery_level,
            }
            for item in focus_items
        ],
        "activity": stats["monthly_activity"],
    }


def export_user_data(session: Session, user: User) -> dict:
    settings = get_or_create_user_settings(session, user)
    progress_items = list(
        session.exec(
            select(UserWordProgress).where(UserWordProgress.user_id == user.id)
        ).all()
    )
    review_logs = list(
        session.exec(
            select(ReviewLog).where(ReviewLog.user_id == user.id)
        ).all()
    )
    favorite_words = list(
        session.exec(
            select(FavoriteWord).where(FavoriteWord.user_id == user.id)
        ).all()
    )
    progress_data = []
    for p in progress_items:
        word = session.get(Word, p.word_id)
        progress_data.append(
            {
                "word_id": p.word_id,
                "word_text": word.text if word else "",
                "status": p.status.value,
                "mastery_level": p.mastery_level,
                "easiness_factor": p.easiness_factor,
                "interval_days": p.interval_days,
                "correct_count": p.correct_count,
                "wrong_count": p.wrong_count,
                "is_leech": p.is_leech,
                "last_reviewed_at": p.last_reviewed_at.isoformat() if p.last_reviewed_at else None,
                "next_review_at": p.next_review_at.isoformat() if p.next_review_at else None,
            }
        )

    logs_data = [
        {
            "word_id": log.word_id,
            "quality": log.quality,
            "is_correct": log.is_correct,
            "study_mode": log.study_mode.value,
            "created_at": log.created_at.isoformat(),
        }
        for log in review_logs
    ]

    return {
        "exported_at": datetime.utcnow().isoformat(),
        "user_email": user.email,
        "settings": {
            "daily_new_limit": settings.daily_new_limit,
            "daily_review_limit": settings.daily_review_limit,
            "default_study_mode": settings.default_study_mode.value,
            "auto_play_word": settings.auto_play_word,
            "auto_play_example": settings.auto_play_example,
            "auto_reveal_after_audio": settings.auto_reveal_after_audio,
            "auto_advance": settings.auto_advance,
            "speech_accent": getattr(settings.speech_accent, "value", settings.speech_accent),
            "answer_delay_ms": settings.answer_delay_ms,
            "word_book_page_size": settings.word_book_page_size,
            "onboarding_completed": settings.onboarding_completed,
            "learning_goal": settings.learning_goal,
            "english_level": settings.english_level,
            "exam_type": settings.exam_type,
            "target_date": settings.target_date,
            "daily_minutes": settings.daily_minutes,
            "wants_speaking": settings.wants_speaking,
            "wants_listening": settings.wants_listening,
            "wants_ai_tutor": settings.wants_ai_tutor,
            "reminder_enabled": settings.reminder_enabled,
            "reminder_time": settings.reminder_time,
            "membership_tier": settings.membership_tier,
            "membership_expires_at": settings.membership_expires_at.isoformat() if settings.membership_expires_at else None,
        },
        "favorites": [
            {
                "word_id": favorite.word_id,
                "word_text": favorite.word.text if favorite.word else "",
                "created_at": favorite.created_at.isoformat(),
            }
            for favorite in favorite_words
        ],
        "progress": progress_data,
        "review_logs": logs_data,
    }


def export_user_anki_tsv(session: Session, user: User) -> str:
    progress_items = list(
        session.exec(
            select(UserWordProgress)
            .where(UserWordProgress.user_id == user.id)
            .order_by(UserWordProgress.word_id)
        ).all()
    )
    rows = [["word", "phonetic", "meaning", "part_of_speech", "example", "example_translation", "note"]]
    seen: set[int] = set()
    for progress in progress_items:
        if progress.word_id in seen:
            continue
        seen.add(progress.word_id)
        word = progress.word
        if not word:
            continue
        rows.append(
            [
                word.text,
                word.phonetic or "",
                word.meaning,
                word.part_of_speech or "",
                word.example_sentence or "",
                word.example_translation or "",
                word.note or "",
            ]
        )
    output = io.StringIO()
    writer = csv.writer(output, delimiter="\t", lineterminator="\n")
    writer.writerows(rows)
    return output.getvalue()


def import_user_data(session: Session, user: User, data: dict) -> dict[str, int | bool]:
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Invalid backup file")

    result: dict[str, int | bool] = {
        "progress_imported": 0,
        "logs_imported": 0,
        "favorites_imported": 0,
        "settings_imported": False,
    }

    settings_data = data.get("settings")
    if isinstance(settings_data, dict):
        update_user_settings(
            session,
            user,
            settings_data.get("daily_new_limit"),
            settings_data.get("daily_review_limit"),
            _safe_study_mode(settings_data.get("default_study_mode")),
            settings_data.get("auto_play_word"),
            settings_data.get("auto_play_example"),
            settings_data.get("auto_reveal_after_audio"),
            settings_data.get("auto_advance"),
            settings_data.get("speech_accent") if settings_data.get("speech_accent") in {"en-US", "en-GB"} else None,
            settings_data.get("answer_delay_ms"),
            settings_data.get("word_book_page_size"),
            settings_data.get("onboarding_completed"),
            settings_data.get("learning_goal"),
            settings_data.get("english_level"),
            settings_data.get("exam_type"),
            settings_data.get("target_date"),
            settings_data.get("daily_minutes"),
            settings_data.get("wants_speaking"),
            settings_data.get("wants_listening"),
            settings_data.get("wants_ai_tutor"),
            settings_data.get("reminder_enabled"),
            settings_data.get("reminder_time"),
            settings_data.get("membership_tier"),
            _parse_datetime(settings_data.get("membership_expires_at")),
        )
        result["settings_imported"] = True

    for item in data.get("progress", []):
        if not isinstance(item, dict):
            continue
        word = _find_backup_word(session, item)
        if not word:
            continue
        progress = session.exec(
            select(UserWordProgress).where(
                UserWordProgress.user_id == user.id,
                UserWordProgress.word_id == word.id,
            )
        ).first()
        if not progress:
            progress = UserWordProgress(user_id=user.id, word_id=word.id)

        progress.status = _safe_progress_status(item.get("status"))
        progress.mastery_level = _safe_int(item.get("mastery_level"), 0)
        progress.easiness_factor = _safe_float(item.get("easiness_factor"), 2.5)
        progress.interval_days = _safe_float(item.get("interval_days"), 0)
        progress.correct_count = _safe_int(item.get("correct_count"), 0)
        progress.wrong_count = _safe_int(item.get("wrong_count"), 0)
        progress.is_leech = bool(item.get("is_leech", False))
        progress.last_reviewed_at = _parse_datetime(item.get("last_reviewed_at"))
        progress.next_review_at = _parse_datetime(item.get("next_review_at")) or datetime.utcnow()
        session.add(progress)
        result["progress_imported"] = int(result["progress_imported"]) + 1

    session.commit()

    for item in data.get("favorites", []):
        if not isinstance(item, dict):
            continue
        word = _find_backup_word(session, item)
        if not word or is_favorite_word(session, user, word.id):
            continue
        session.add(FavoriteWord(user_id=user.id, word_id=word.id))
        result["favorites_imported"] = int(result["favorites_imported"]) + 1

    for item in data.get("review_logs", []):
        if not isinstance(item, dict):
            continue
        word = _find_backup_word(session, item)
        created_at = _parse_datetime(item.get("created_at"))
        if not word or not created_at:
            continue
        existing = session.exec(
            select(ReviewLog).where(
                ReviewLog.user_id == user.id,
                ReviewLog.word_id == word.id,
                ReviewLog.created_at == created_at,
            )
        ).first()
        if existing:
            continue
        session.add(
            ReviewLog(
                user_id=user.id,
                word_id=word.id,
                study_mode=_safe_study_mode(item.get("study_mode")) or StudyMode.en_to_cn,
                quality=max(0, min(3, _safe_int(item.get("quality"), 0))),
                is_correct=bool(item.get("is_correct", False)),
                created_at=created_at,
            )
        )
        result["logs_imported"] = int(result["logs_imported"]) + 1

    session.commit()
    return result


def _find_backup_word(session: Session, item: dict) -> Word | None:
    word_id = item.get("word_id")
    if isinstance(word_id, int):
        word = session.get(Word, word_id)
        if word:
            return word
    word_text = (item.get("word_text") or "").strip()
    if not word_text:
        return None
    return session.exec(select(Word).where(Word.text == word_text)).first()


def _parse_datetime(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _safe_int(value: object, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: object, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_study_mode(value: object) -> StudyMode | None:
    try:
        return StudyMode(value)
    except (TypeError, ValueError):
        return None


def _safe_progress_status(value: object) -> ProgressStatus:
    try:
        return ProgressStatus(value)
    except (TypeError, ValueError):
        return ProgressStatus.new


def seed_demo_data(session: Session) -> None:
    if session.exec(select(WordBook)).first():
        return

    words = [
        ("abandon", "/əˈbændən/", "放弃", "v.", "He abandoned the plan.", "他放弃了这个计划。"),
        ("ability", "/əˈbɪləti/", "能力", "n.", "She has the ability to lead.", "她有领导能力。"),
        ("absorb", "/əbˈzɔːrb/", "吸收；理解", "v.", "Plants absorb water.", "植物吸收水分。"),
        ("accurate", "/ˈækjərət/", "准确的", "adj.", "The report is accurate.", "这份报告是准确的。"),
        ("achieve", "/əˈtʃiːv/", "实现；达到", "v.", "You can achieve your goal.", "你可以实现目标。"),
        ("benefit", "/ˈbenɪfɪt/", "益处；受益", "n./v.", "Exercise benefits health.", "运动有益健康。"),
        ("challenge", "/ˈtʃælɪndʒ/", "挑战", "n./v.", "This task is a challenge.", "这项任务是一个挑战。"),
        ("confident", "/ˈkɑːnfɪdənt/", "自信的", "adj.", "He feels confident.", "他感到自信。"),
        ("develop", "/dɪˈveləp/", "发展；开发", "v.", "We develop a new system.", "我们开发一个新系统。"),
        ("efficient", "/ɪˈfɪʃnt/", "高效的", "adj.", "This method is efficient.", "这个方法很高效。"),
    ]

    book = WordBook(
        title="Starter Vocabulary",
        description="A small starter word book.",
        category="通用",
        difficulty="入门",
    )
    session.add(book)
    session.commit()
    session.refresh(book)

    for row in words:
        word = Word(
            text=row[0],
            phonetic=row[1],
            meaning=row[2],
            part_of_speech=row[3],
            example_sentence=row[4],
            example_translation=row[5],
        )
        session.add(word)
        session.commit()
        session.refresh(word)
        session.add(WordBookItem(word_book_id=book.id, word_id=word.id))
    session.commit()
