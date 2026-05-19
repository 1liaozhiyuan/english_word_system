from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


client = TestClient(app)


def create_user_headers(prefix: str = "test") -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={"email": f"{prefix}-{uuid4().hex}@example.com", "password": "password123"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


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
    }

    response = client.patch(
        "/settings",
        headers=headers,
        json={"auto_play_word": False, "auto_play_example": False},
    )
    assert response.status_code == 200
    assert response.json()["auto_play_word"] is False
    assert response.json()["auto_play_example"] is False

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

    response = client.get(
        "/mistakes-paginated",
        headers=headers,
        params={"page": 1, "page_size": 5, "q": new_items[0]["word"]["text"]},
    )
    assert response.status_code == 200
    mistake_page = response.json()
    assert mistake_page["total"] >= 1
    assert mistake_page["items"][0]["word"]["id"] == new_items[0]["word"]["id"]

    response = client.get("/stats/overview", headers=headers)
    assert response.status_code == 200
    stats = response.json()
    assert stats["mistakes"] == 1
    assert stats["due_new"] >= 0
    assert stats["due_review"] >= 0
    assert stats["completed_today"] >= 1
    assert stats["correct_rate"] == 0
    assert stats["streak_days"] == 1
    assert len(stats["activity"]) == 7

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


def test_import_word_book_from_csv():
    headers = create_user_headers("import")

    csv_content = (
        "word,phonetic,meaning,part_of_speech,example_sentence,example_translation\n"
        "curious,/curious/,curious,adj.,She is curious about science.,She likes science.\n"
        "steady,/steady/,steady,adj.,Keep a steady pace.,Keep the pace.\n"
    )

    response = client.post(
        "/word-books/import",
        headers=headers,
        data={"title": "Imported Test Book", "description": "Uploaded from CSV"},
        files={"file": ("words.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["title"] == "Imported Test Book"
    assert result["imported_count"] == 2

    response = client.post(f"/word-books/{result['id']}/select", headers=headers)
    assert response.status_code == 200
    assert response.json()["created"] == 2

    response = client.get(f"/word-books/{result['id']}", headers=headers)
    assert response.status_code == 200
    detail = response.json()
    assert detail["word_count"] == 2
    assert len(detail["words"]) == 2
    assert detail["words"][0]["text"] == "curious"

    response = client.get(f"/word-books/{result['id']}/words", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 2

    response = client.patch(
        f"/word-books/{result['id']}",
        headers=headers,
        json={"title": "Edited Imported Book", "description": "Edited description"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Edited Imported Book"

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


def test_word_book_pagination_and_batch_delete():
    headers = create_user_headers("books")
    created_ids = []
    for index in range(3):
        csv_content = f"word,meaning\nbatchword{index},meaning {index}\n"
        response = client.post(
            "/word-books/import",
            headers=headers,
            data={"title": f"Batch Delete Book {index}", "description": "batch"},
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

    response = client.patch(
        f"/words/{word['id']}",
        headers=headers,
        json={"meaning": "improve", "part_of_speech": "v./n."},
    )
    assert response.status_code == 200
    assert response.json()["meaning"] == "improve"

    response = client.get(f"/word-books/{book_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["word_count"] == 2

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
    assert page["summary"]["total"] == 2

    response = client.delete(f"/word-books/{book_id}/words/{word['id']}", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "deleted"

    response = client.get(f"/word-books/{book_id}", headers=headers)
    assert response.status_code == 200
    detail = response.json()
    assert detail["word_count"] == 1
    assert all(item["id"] != word["id"] for item in detail["words"])


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
