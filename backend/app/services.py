import csv
import io
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlmodel import Session, func, select

from app.core.security import generate_reset_token, hash_password, verify_password
from app.models import (
    FavoriteWord,
    ProgressStatus,
    ReviewLog,
    StudyMode,
    User,
    UserSettings,
    UserWordProgress,
    Word,
    WordBook,
    WordBookItem,
)

LEECH_THRESHOLD = 5


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
    user = User(email=email, hashed_password=hash_password(password))
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


def request_password_reset(session: Session, email: str) -> str:
    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
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
    answer_delay_ms: int | None = None,
    word_book_page_size: int | None = None,
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
    if answer_delay_ms is not None:
        settings.answer_delay_ms = max(300, min(3000, answer_delay_ms))
    if word_book_page_size is not None:
        settings.word_book_page_size = max(10, min(100, word_book_page_size))
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


def export_user_data(session: Session, user: User) -> dict:
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
        "progress": progress_data,
        "review_logs": logs_data,
    }


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
