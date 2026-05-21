import os
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

os.environ["DATABASE_URL"] = "sqlite:///./test_english_words.db"

from app.core.config import settings
from app.db.session import engine
from app.main import app
from app.services import seed_demo_data


SQLModel.metadata.drop_all(engine)
SQLModel.metadata.create_all(engine)
with Session(engine) as session:
    seed_demo_data(session)

client = TestClient(app)


def create_user_headers(prefix: str = "test") -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={"email": f"{prefix}-{uuid4().hex}@example.com", "password": "password123"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_auth_login_and_password_reset_flow():
    email = f"auth-{uuid4().hex}@example.com"
    password = "password123"

    response = client.post("/auth/register", json={"email": email, "password": password})
    assert response.status_code == 200
    assert response.json()["access_token"]

    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    token = response.json()["access_token"]
    assert token

    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == email

    response = client.post("/auth/forgot-password", json={"email": email})
    assert response.status_code == 200
    reset_token = response.json()["reset_token"]
    assert reset_token

    response = client.post(
        "/auth/reset-password",
        json={"token": reset_token, "new_password": "newpassword123"},
    )
    assert response.status_code == 200
    new_token = response.json()["access_token"]
    assert new_token

    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 401

    response = client.post("/auth/login", json={"email": email, "password": "newpassword123"})
    assert response.status_code == 200


def test_core_learning_flow():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    headers = create_user_headers()

    response = client.get("/settings", headers=headers)
    assert response.status_code == 200
    assert response.json()["daily_new_limit"] == 10

    response = client.patch(
        "/settings",
        headers=headers,
        json={"daily_new_limit": 3, "daily_review_limit": 7},
    )
    assert response.status_code == 200
    assert response.json() == {
        "daily_new_limit": 3,
        "daily_review_limit": 7,
        "default_study_mode": "en_to_cn",
        "auto_play_word": True,
        "auto_play_example": True,
        "auto_reveal_after_audio": False,
        "auto_advance": True,
        "answer_delay_ms": 800,
        "word_book_page_size": 30,
    }

    response = client.patch(
        "/settings",
        headers=headers,
        json={
            "auto_play_word": False,
            "auto_play_example": False,
            "auto_reveal_after_audio": True,
            "auto_advance": False,
            "answer_delay_ms": 1300,
            "word_book_page_size": 50,
        },
    )
    assert response.status_code == 200
    assert response.json()["auto_play_word"] is False
    assert response.json()["auto_play_example"] is False
    assert response.json()["auto_reveal_after_audio"] is True
    assert response.json()["auto_advance"] is False
    assert response.json()["answer_delay_ms"] == 1300
    assert response.json()["word_book_page_size"] == 50

    response = client.get("/word-books")
    assert response.status_code == 200
    books = response.json()
    assert books

    response = client.post(f"/word-books/{books[0]['id']}/select", headers=headers)
    assert response.status_code == 200
    assert response.json()["created"] > 0

    response = client.get("/word-books/progress", headers=headers)
    assert response.status_code == 200
    progress_books = response.json()
    selected_book = next(item for item in progress_books if item["id"] == books[0]["id"])
    assert selected_book["added_count"] > 0
    assert selected_book["learning_count"] > 0
    assert selected_book["completion_rate"] >= 0

    response = client.get("/study/new", headers=headers)
    assert response.status_code == 200
    new_items = response.json()
    assert 0 < len(new_items) <= 3
    assert new_items[0]["word_book_id"] == books[0]["id"]

    response = client.get("/study/new?limit=1", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1

    response = client.get(f"/word-books/{books[0]['id']}/word-progress", headers=headers)
    assert response.status_code == 200
    word_progress = response.json()
    assert word_progress
    assert word_progress[0]["status"] == "new"
    assert word_progress[0]["mastery_level"] == 0

    response = client.get("/study/today", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) <= 10

    response = client.post(
        "/study/answer",
        headers=headers,
        json={
            "word_id": new_items[0]["word"]["id"],
            "word_book_id": new_items[0]["word_book_id"],
            "quality": 0,
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "learning"

    response = client.get(f"/word-books/{books[0]['id']}/word-progress", headers=headers)
    assert response.status_code == 200
    answered_progress = next(
        item for item in response.json() if item["word"]["id"] == new_items[0]["word"]["id"]
    )
    assert answered_progress["status"] == "learning"
    assert answered_progress["wrong_count"] == 1

    response = client.get("/review/today", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) <= 7

    response = client.get("/review/today?limit=1", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) <= 1

    response = client.get("/mistakes", headers=headers)
    assert response.status_code == 200
    assert response.json()

    response = client.get(f"/words/{new_items[0]['word']['id']}/favorite", headers=headers)
    assert response.status_code == 200
    assert response.json()["is_favorite"] is False

    response = client.post(f"/words/{new_items[0]['word']['id']}/favorite", headers=headers)
    assert response.status_code == 200
    assert response.json()["is_favorite"] is True

    response = client.get(
        "/favorites-paginated",
        headers=headers,
        params={"page": 1, "page_size": 5, "q": new_items[0]["word"]["text"]},
    )
    assert response.status_code == 200
    favorites_page = response.json()
    assert favorites_page["total"] == 1
    assert favorites_page["items"][0]["word"]["id"] == new_items[0]["word"]["id"]
    assert favorites_page["items"][0]["is_favorite"] is True

    response = client.delete(f"/words/{new_items[0]['word']['id']}/favorite", headers=headers)
    assert response.status_code == 200
    assert response.json()["is_favorite"] is False

    response = client.get(
        "/mistakes-paginated",
        headers=headers,
        params={"page": 1, "page_size": 5, "q": new_items[0]["word"]["text"]},
    )
    assert response.status_code == 200
    mistake_page = response.json()
    assert mistake_page["total"] >= 1
    assert mistake_page["items"][0]["word"]["id"] == new_items[0]["word"]["id"]
    assert mistake_page["items"][0]["wrong_count"] == 1
    assert mistake_page["items"][0]["correct_count"] == 0
    assert mistake_page["items"][0]["next_review_at"]

    response = client.get("/stats/overview", headers=headers)
    assert response.status_code == 200
    stats = response.json()
    assert stats["mistakes"] == 1
    assert stats["due_new"] >= 0
    assert stats["due_review"] >= 0
    assert stats["due_new"] <= stats["daily_new_limit"]
    assert stats["due_review"] <= stats["daily_review_limit"]
    assert stats["available_new"] >= stats["due_new"]
    assert stats["available_review"] >= stats["due_review"]
    assert stats["new_completed_today"] >= 1
    assert stats["completed_today"] >= 1
    assert stats["total_reviews"] >= 1
    assert stats["correct_reviews"] == 0
    assert stats["correct_rate"] == 0
    assert stats["weekly_reviews"] >= 1
    assert stats["weekly_correct_rate"] == 0
    assert stats["active_days_30"] >= 1
    assert stats["streak_days"] == 1
    assert len(stats["activity"]) == 7
    assert len(stats["monthly_activity"]) == 30

    response = client.get("/study/history", headers=headers)
    assert response.status_code == 200
    history = response.json()
    assert history[0]["word_id"] == new_items[0]["word"]["id"]
    assert history[0]["word_text"] == new_items[0]["word"]["text"]
    assert history[0]["word"]["meaning"] == new_items[0]["word"]["meaning"]

    response = client.get(
        "/study/history-paginated",
        headers=headers,
        params={"page": 1, "page_size": 5, "q": new_items[0]["word"]["text"]},
    )
    assert response.status_code == 200
    history_page = response.json()
    assert history_page["total"] >= 1
    assert history_page["items"][0]["word_id"] == new_items[0]["word"]["id"]

    response = client.post(
        f"/mistakes/{new_items[0]['word']['id']}/practice",
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "learning"

    response = client.post(
        "/mistakes/practice-batch",
        headers=headers,
        json={"word_ids": [new_items[0]["word"]["id"]]},
    )
    assert response.status_code == 200
    assert response.json()["scheduled"] == 1

    response = client.post(
        f"/mistakes/{new_items[0]['word']['id']}/resolve",
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["wrong_count"] == 0

    response = client.get("/mistakes", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


def test_import_word_book_from_csv():
    headers = create_user_headers("import")

    csv_content = (
        "word,phonetic,meaning,part_of_speech,example_sentence,example_translation\n"
        "curious,/curious/,curious,adj.,She is curious about science.,She likes science.\n"
        "steady,/steady/,steady,adj.,Keep a steady pace.,Keep the pace.\n"
        "steady,/steady/,steady duplicate,adj.,Keep a steady pace again.,Keep the pace again.\n"
    )

    response = client.post(
        "/word-books/import",
        headers=headers,
        data={
            "title": "Imported Test Book",
            "description": "Uploaded from CSV",
            "category": "CET-4",
            "difficulty": "入门",
        },
        files={"file": ("words.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["title"] == "Imported Test Book"
    assert result["imported_count"] == 2
    assert result["skipped_count"] == 1

    response = client.post(f"/word-books/{result['id']}/select", headers=headers)
    assert response.status_code == 200
    assert response.json()["created"] == 2

    response = client.get(f"/word-books/{result['id']}", headers=headers)
    assert response.status_code == 200
    detail = response.json()
    assert detail["word_count"] == 2
    assert detail["category"] == "CET-4"
    assert detail["difficulty"] == "入门"
    assert len(detail["words"]) == 2
    assert detail["words"][0]["text"] == "curious"

    response = client.get(f"/word-books/{result['id']}/words", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 2

    response = client.patch(
        f"/word-books/{result['id']}",
        headers=headers,
        json={
            "title": "Edited Imported Book",
            "description": "Edited description",
            "category": "考研",
            "difficulty": "进阶",
        },
    )
    assert response.status_code == 200
    edited_book = response.json()
    assert edited_book["title"] == "Edited Imported Book"
    assert edited_book["category"] == "考研"
    assert edited_book["difficulty"] == "进阶"

    response = client.get(f"/word-books/{result['id']}/export", headers=headers)
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "word,phonetic,meaning,part_of_speech" in response.text
    assert "curious,/curious/,curious,adj." in response.text

    response = client.delete(f"/word-books/{result['id']}", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "deleted"

    response = client.get(f"/word-books/{result['id']}", headers=headers)
    assert response.status_code == 404


def test_preview_word_book_import_csv():
    headers = create_user_headers("preview")

    csv_content = (
        "word,phonetic,meaning,part_of_speech,example_sentence,example_translation,note\n"
        "alpha,/alpha/,first,adj.,Alpha comes first.,Alpha is first.,note one\n"
        "alpha,/alpha/,first again,adj.,Alpha again.,Alpha again.,duplicate\n"
        "missingmeaning,/missing/,,n.,Bad row.,Bad row.,\n"
        ",missing word,n.,Bad row.,Bad row.,\n"
    )

    response = client.post(
        "/word-books/import/preview",
        headers=headers,
        files={"file": ("words.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    preview = response.json()
    assert preview["total_rows"] == 4
    assert preview["valid_count"] == 2
    assert preview["error_count"] == 2
    assert preview["duplicate_in_file_count"] == 1
    assert preview["words"][1]["duplicate_in_file"] is True
    assert preview["errors"][0]["row_number"] == 4

    response = client.post(
        "/word-books/import",
        headers=headers,
        data={"title": "Bad Import", "description": ""},
        files={"file": ("words.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "CSV file contains invalid rows"


def test_word_book_pagination_and_batch_delete():
    headers = create_user_headers("books")
    created_ids = []
    for index in range(3):
        csv_content = f"word,meaning\nbatchword{index},meaning {index}\n"
        response = client.post(
            "/word-books/import",
            headers=headers,
            data={
                "title": f"Batch Delete Book {index}",
                "description": "batch",
                "category": "Batch Category",
                "difficulty": "标准",
            },
            files={"file": ("words.csv", csv_content.encode("utf-8"), "text/csv")},
        )
        assert response.status_code == 200
        created_ids.append(response.json()["id"])

    response = client.get(
        "/word-books/progress-paginated",
        headers=headers,
        params={"page": 1, "page_size": 2, "q": "Batch Delete Book"},
    )
    assert response.status_code == 200
    page = response.json()
    assert page["total"] >= 3
    assert len(page["items"]) == 2
    assert all(item["category"] == "Batch Category" for item in page["items"])

    response = client.get(
        "/word-books/progress-paginated",
        headers=headers,
        params={"page": 1, "page_size": 5, "q": "Batch Category"},
    )
    assert response.status_code == 200
    assert response.json()["total"] >= 3

    response = client.post(
        "/word-books/batch-delete",
        headers=headers,
        json={"word_book_ids": created_ids[:2]},
    )
    assert response.status_code == 200
    assert response.json()["deleted"] == 2

    response = client.get(f"/word-books/{created_ids[0]}", headers=headers)
    assert response.status_code == 404


def test_manage_words_in_word_book():
    headers = create_user_headers("manage")

    csv_content = "word,meaning\nseed,seed\n"
    response = client.post(
        "/word-books/import",
        headers=headers,
        data={"title": "Manage Test Book", "description": ""},
        files={"file": ("words.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    book_id = response.json()["id"]

    response = client.post(
        f"/word-books/{book_id}/words",
        headers=headers,
        json={
            "text": "polish",
            "phonetic": "/polish/",
            "meaning": "polish",
            "part_of_speech": "v.",
            "example_sentence": "Polish the sentence before publishing.",
            "example_translation": "Improve the sentence.",
        },
    )
    assert response.status_code == 200
    word = response.json()
    assert word["text"] == "polish"

    extra_word_ids = []
    for text in ["trim", "focus"]:
        response = client.post(
            f"/word-books/{book_id}/words",
            headers=headers,
            json={"text": text, "meaning": f"{text} meaning"},
        )
        assert response.status_code == 200
        extra_word_ids.append(response.json()["id"])

    response = client.patch(
        f"/words/{word['id']}",
        headers=headers,
        json={"meaning": "improve", "part_of_speech": "v./n."},
    )
    assert response.status_code == 200
    assert response.json()["meaning"] == "improve"

    response = client.get(f"/word-books/{book_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["word_count"] == 4

    response = client.get(f"/word-books/{book_id}/word-progress", headers=headers)
    assert response.status_code == 200
    added_word_progress = next(
        item for item in response.json() if item["word"]["id"] == word["id"]
    )
    assert added_word_progress["status"] == "new"

    response = client.get(
        f"/word-books/{book_id}/word-progress-paginated",
        headers=headers,
        params={"page": 1, "page_size": 1, "q": "polish", "status_filter": "new"},
    )
    assert response.status_code == 200
    page = response.json()
    assert page["total"] == 1
    assert len(page["items"]) == 1
    assert page["items"][0]["word"]["text"] == "polish"
    assert page["summary"]["total"] == 4

    response = client.post(
        f"/word-books/{book_id}/words/batch-delete",
        headers=headers,
        json={"word_ids": extra_word_ids},
    )
    assert response.status_code == 200
    assert response.json()["deleted"] == 2

    response = client.get(
        f"/word-books/{book_id}/word-progress-paginated",
        headers=headers,
        params={"page": 1, "page_size": 10},
    )
    assert response.status_code == 200
    page = response.json()
    assert page["summary"]["total"] == 2
    assert page["total"] == 2
    assert {item["word"]["text"] for item in page["items"]} == {"seed", "polish"}

    response = client.post(
        "/word-books/import",
        headers=headers,
        data={"title": "Manage Target Book", "description": ""},
        files={"file": ("words.csv", "word,meaning\ntarget,target\n".encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    target_book_id = response.json()["id"]

    response = client.post(
        f"/word-books/{book_id}/words/batch-move",
        headers=headers,
        json={"word_ids": [word["id"]], "target_word_book_id": target_book_id},
    )
    assert response.status_code == 200
    assert response.json()["moved"] == 1

    response = client.get(f"/word-books/{book_id}", headers=headers)
    assert response.status_code == 200
    source_detail = response.json()
    assert source_detail["word_count"] == 1
    assert all(item["id"] != word["id"] for item in source_detail["words"])

    response = client.get(f"/word-books/{target_book_id}", headers=headers)
    assert response.status_code == 200
    target_detail = response.json()
    assert target_detail["word_count"] == 2
    assert any(item["id"] == word["id"] for item in target_detail["words"])

    response = client.delete(f"/word-books/{target_book_id}/words/{word['id']}", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "deleted"
    assert response.json()["word_book_deleted"] is False

    response = client.get(f"/word-books/{target_book_id}", headers=headers)
    assert response.status_code == 200
    detail = response.json()
    assert detail["word_count"] == 1
    assert all(item["id"] != word["id"] for item in detail["words"])

    only_word_id = detail["words"][0]["id"]
    response = client.delete(f"/word-books/{target_book_id}/words/{only_word_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["word_book_deleted"] is True

    response = client.get(f"/word-books/{target_book_id}", headers=headers)
    assert response.status_code == 404

    response = client.post(
        "/word-books/import",
        headers=headers,
        data={"title": "Single Batch Delete Book", "description": ""},
        files={"file": ("words.csv", "word,meaning\nsolo,solo\n".encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    single_book_id = response.json()["id"]

    response = client.get(f"/word-books/{single_book_id}", headers=headers)
    assert response.status_code == 200
    solo_word_id = response.json()["words"][0]["id"]

    response = client.post(
        f"/word-books/{single_book_id}/words/batch-delete",
        headers=headers,
        json={"word_ids": [solo_word_id]},
    )
    assert response.status_code == 200
    assert response.json()["deleted"] == 1
    assert response.json()["word_book_deleted"] is True

    response = client.get(f"/word-books/{single_book_id}", headers=headers)
    assert response.status_code == 404


def test_ai_endpoint_requires_configuration(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "")
    headers = create_user_headers("ai")
    payload = {
        "word": {
            "id": 1,
            "text": "abandon",
            "phonetic": "/əˈbændən/",
            "meaning": "放弃",
            "part_of_speech": "v.",
            "example_sentence": "He abandoned the plan.",
            "example_translation": "他放弃了这个计划。",
            "note": None,
        }
    }
    response = client.post("/ai/explain-word", headers=headers, json=payload)
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]

    response = client.post("/ai/explain-word/stream", headers=headers, json=payload)
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]
