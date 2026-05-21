import os
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, select

os.environ["DATABASE_URL"] = "sqlite:///./test_english_words.db"

from app.core.config import settings
from app.db.session import engine
from app.main import app
from app.models import AIQuestion, User, UserRole
from app.services import seed_demo_data


SQLModel.metadata.drop_all(engine)
SQLModel.metadata.create_all(engine)
with Session(engine) as session:
    seed_demo_data(session)

client = TestClient(app)


def create_user_headers(prefix: str = "test", role: UserRole | None = None) -> dict[str, str]:
    email = f"{prefix}-{uuid4().hex}@example.com"
    response = client.post(
        "/auth/register",
        json={"email": email, "password": "password123"},
    )
    assert response.status_code == 200
    if role:
        with Session(engine) as session:
            user = session.exec(select(User).where(User.email == email)).first()
            assert user
            user.role = role
            session.add(user)
            session.commit()
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
    token = response.json()["access_token"]

    response = client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "wrongpassword", "new_password": "changed123"},
    )
    assert response.status_code == 400

    response = client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "newpassword123", "new_password": "changed123"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "password_changed"

    response = client.post("/auth/login", json={"email": email, "password": "newpassword123"})
    assert response.status_code == 401

    response = client.post("/auth/login", json={"email": email, "password": "changed123"})
    assert response.status_code == 200


def test_feedback_and_account_deletion_flow():
    email = f"delete-{uuid4().hex}@example.com"
    password = "password123"
    response = client.post("/auth/register", json={"email": email, "password": password})
    assert response.status_code == 200
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}

    response = client.post(
        "/feedback",
        headers=headers,
        json={
            "category": "AI 内容不准确",
            "contact": email,
            "content": "The explanation for a word is not clear enough.",
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "open"
    assert response.json()["category"] == "AI 内容不准确"
    feedback_id = response.json()["id"]

    response = client.post(
        "/content-reports",
        headers=headers,
        json={
            "source_type": "ai_explanation",
            "source_id": "test",
            "reason": "inaccurate",
            "content": "This AI explanation should be reviewed.",
        },
    )
    assert response.status_code == 200
    content_report_id = response.json()["id"]
    assert response.json()["status"] == "open"

    response = client.get("/admin/overview", headers=headers)
    assert response.status_code == 403

    admin_headers = create_user_headers("admin", UserRole.admin)

    response = client.get("/admin/overview", headers=admin_headers)
    assert response.status_code == 200
    overview = response.json()
    assert overview["feedback_open"] >= 1
    assert overview["total_users"] >= overview["users"]
    assert overview["demo_users"] >= 1

    response = client.get("/admin/users", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["total"] >= 1

    response = client.get("/admin/feedback", headers=admin_headers)
    assert response.status_code == 200
    assert any(item["id"] == feedback_id for item in response.json()["items"])

    response = client.get("/admin/content-reports", headers=admin_headers)
    assert response.status_code == 200
    assert any(item["id"] == content_report_id for item in response.json()["items"])

    response = client.patch(
        f"/admin/content-reports/{content_report_id}",
        headers=admin_headers,
        json={"status": "resolved", "review_note": "checked"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "resolved"

    response = client.patch(f"/admin/feedback/{feedback_id}", headers=admin_headers, params={"status": "closed"})
    assert response.status_code == 200
    assert response.json()["status"] == "closed"

    response = client.get("/admin/ai-usage", headers=admin_headers)
    assert response.status_code == 200
    assert "feature_summary" in response.json()

    response = client.patch("/admin/users/1/role", headers=admin_headers, json={"role": "reviewer"})
    assert response.status_code in {200, 404}

    response = client.get("/admin/operation-logs", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["total"] >= 1

    response = client.get("/admin/membership-plans", headers=admin_headers)
    assert response.status_code == 200
    assert len(response.json()) >= 3

    response = client.get("/admin/orders", headers=admin_headers)
    assert response.status_code == 200
    assert "items" in response.json()

    response = client.request("DELETE", "/auth/account", headers=headers, json={"password": "wrong"})
    assert response.status_code == 400

    response = client.request("DELETE", "/auth/account", headers=headers, json={"password": password})
    assert response.status_code == 200
    assert response.json()["status"] == "account_deleted"

    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 401


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
    settings_payload = response.json()
    assert settings_payload == {
        "daily_new_limit": 3,
        "daily_review_limit": 7,
        "default_study_mode": "en_to_cn",
        "auto_play_word": True,
        "auto_play_example": True,
        "auto_reveal_after_audio": False,
        "auto_advance": True,
        "speech_accent": "en-US",
        "answer_delay_ms": 800,
        "word_book_page_size": 30,
        "onboarding_completed": False,
        "learning_goal": None,
        "english_level": None,
        "exam_type": None,
        "target_date": None,
        "daily_minutes": 20,
        "wants_speaking": False,
        "wants_listening": False,
        "wants_ai_tutor": True,
        "reminder_enabled": False,
        "reminder_time": None,
        "membership_tier": "free",
        "membership_expires_at": None,
    }

    response = client.patch(
        "/settings",
        headers=headers,
        json={
            "onboarding_completed": True,
            "learning_goal": "大学英语四级",
            "english_level": "大学基础",
            "exam_type": "大学英语四级",
            "target_date": "2026-12-20",
            "daily_minutes": 35,
            "wants_speaking": True,
            "wants_listening": True,
            "wants_ai_tutor": True,
            "reminder_enabled": True,
            "reminder_time": "20:30",
        },
    )
    assert response.status_code == 200
    onboarding_settings = response.json()
    assert onboarding_settings["onboarding_completed"] is True
    assert onboarding_settings["learning_goal"] == "大学英语四级"
    assert onboarding_settings["daily_minutes"] == 35
    assert onboarding_settings["reminder_time"] == "20:30"

    response = client.get("/membership/status", headers=headers)
    assert response.status_code == 200
    membership = response.json()
    assert membership["tier"] == "free"
    assert membership["daily_ai_limit"] == 5
    assert membership["ai_remaining_today"] == 5

    response = client.get("/membership/plans", headers=headers)
    assert response.status_code == 200
    plans = response.json()
    assert len(plans) >= 3
    assert all(plan["price_cents"] >= 0 for plan in plans)

    response = client.post("/membership/orders/demo-pay", headers=headers, json={"plan_id": plans[0]["id"]})
    assert response.status_code == 200
    order = response.json()
    assert order["status"] == "paid"
    assert order["plan_id"] == plans[0]["id"]

    response = client.get("/membership/orders", headers=headers)
    assert response.status_code == 200
    assert any(item["id"] == order["id"] for item in response.json())

    response = client.post("/membership/demo-upgrade", headers=headers)
    assert response.status_code == 200
    membership = response.json()
    assert membership["tier"] == "pro"
    assert membership["is_member"] is True
    assert membership["daily_ai_limit"] == 100

    response = client.patch(
        "/settings",
        headers=headers,
        json={
            "auto_play_word": False,
            "auto_play_example": False,
            "auto_reveal_after_audio": True,
            "auto_advance": False,
            "speech_accent": "en-GB",
            "answer_delay_ms": 1300,
            "word_book_page_size": 50,
        },
    )
    assert response.status_code == 200
    assert response.json()["auto_play_word"] is False
    assert response.json()["auto_play_example"] is False
    assert response.json()["auto_reveal_after_audio"] is True
    assert response.json()["auto_advance"] is False
    assert response.json()["speech_accent"] == "en-GB"
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

    response = client.get("/listening/session", headers=headers, params={"limit": 3})
    assert response.status_code == 200
    listening_questions = response.json()
    assert listening_questions
    listening_question = listening_questions[0]
    assert listening_question["audio_text"]
    assert listening_question["options"]
    response = client.get(f"/words/{listening_question['word_id']}", headers=headers)
    assert response.status_code == 200
    listening_answer = response.json()["word"]["meaning"]

    response = client.post(
        "/listening/answer",
        headers=headers,
        json={
            "word_id": listening_question["word_id"],
            "word_book_id": listening_question["word_book_id"],
            "selected_meaning": listening_answer,
        },
    )
    assert response.status_code == 200
    assert "is_correct" in response.json()
    assert response.json()["progress"]["word_id"] == listening_question["word_id"]

    response = client.get("/speaking/session", headers=headers, params={"limit": 3})
    assert response.status_code == 200
    speaking_prompts = response.json()
    assert speaking_prompts
    speaking_prompt = speaking_prompts[0]
    assert speaking_prompt["prompt_text"]

    response = client.post(
        "/speaking/attempts",
        headers=headers,
        json={
            "word_id": speaking_prompt["word_id"],
            "prompt_text": speaking_prompt["prompt_text"],
            "transcript": speaking_prompt["prompt_text"],
        },
    )
    assert response.status_code == 200
    assert response.json()["accuracy_score"] >= 80

    response = client.get("/speaking/attempts", headers=headers)
    assert response.status_code == 200
    assert response.json()[0]["word_id"] == speaking_prompt["word_id"]

    response = client.get("/reading/articles", headers=headers)
    assert response.status_code == 200
    articles = response.json()
    assert articles
    article_id = articles[0]["id"]

    response = client.get(f"/reading/articles/{article_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["content"]

    response = client.post(
        f"/reading/articles/{article_id}/complete",
        headers=headers,
        json={"reading_seconds": 12},
    )
    assert response.status_code == 200
    assert response.json()["article_id"] == article_id

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
    assert stats["correct_reviews"] >= 1
    assert stats["correct_rate"] >= 0
    assert stats["weekly_reviews"] >= 1
    assert stats["weekly_correct_rate"] >= 0
    assert stats["active_days_30"] >= 1
    assert stats["streak_days"] == 1
    assert len(stats["activity"]) == 7
    assert len(stats["monthly_activity"]) == 30

    response = client.get("/learning-plan", headers=headers)
    assert response.status_code == 200
    learning_plan = response.json()
    assert learning_plan["daily_new_limit"] == 3
    assert learning_plan["daily_review_limit"] == 7
    assert learning_plan["total_words"] >= learning_plan["studied_words"]
    assert learning_plan["remaining_words"] >= 0
    assert learning_plan["risk_level"] in {"setup", "healthy", "medium", "high"}
    assert isinstance(learning_plan["current_books"], list)

    response = client.get("/check-in/status", headers=headers)
    assert response.status_code == 200
    check_in = response.json()
    assert check_in["checked_in_today"] is True
    assert check_in["completed_today"] >= 1
    assert check_in["streak_days"] == 1
    assert check_in["total_reviews"] >= 1
    assert isinstance(check_in["badges"], list)
    assert {badge["code"] for badge in check_in["badges"]} >= {"streak_3", "reviews_100"}

    response = client.get("/learning-report", headers=headers)
    assert response.status_code == 200
    report = response.json()
    assert report["total_reviews"] >= 1
    assert report["mistakes"] == 1
    assert report["today_completed"] >= 1
    assert report["today_remaining"] >= 0
    assert isinstance(report["strengths"], list)
    assert isinstance(report["weaknesses"], list)
    assert isinstance(report["recommendations"], list)
    assert len(report["activity"]) == 30

    response = client.post(
        "/ai/examples",
        headers=headers,
        json={
            "word_id": new_items[0]["word"]["id"],
            "sentence": "This is a saved AI example.",
            "translation": "这是一个保存的 AI 例句。",
            "raw_content": "This is a saved AI example.\n这是一个保存的 AI 例句。",
        },
    )
    assert response.status_code == 200
    saved_example = response.json()
    assert saved_example["word_id"] == new_items[0]["word"]["id"]
    assert saved_example["sentence"] == "This is a saved AI example."

    response = client.get(f"/words/{new_items[0]['word']['id']}/ai-examples", headers=headers)
    assert response.status_code == 200
    assert response.json()[0]["id"] == saved_example["id"]

    response = client.delete(f"/ai/examples/{saved_example['id']}", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "deleted"

    response = client.get(f"/words/{new_items[0]['word']['id']}/ai-examples", headers=headers)
    assert response.status_code == 200
    assert all(item["id"] != saved_example["id"] for item in response.json())

    response = client.get("/me", headers=headers)
    assert response.status_code == 200
    user_id = response.json()["id"]
    with Session(engine) as session:
        ai_question = AIQuestion(
            user_id=user_id,
            word_id=new_items[0]["word"]["id"],
            question_type="choice",
            prompt="Choose the meaning.",
            options_json='["A","B"]',
            answer="B",
            explanation="B is correct.",
            related_word=new_items[0]["word"]["text"],
        )
        session.add(ai_question)
        session.commit()
        session.refresh(ai_question)
        ai_question_id = ai_question.id

    response = client.post(f"/ai/questions/{ai_question_id}/attempt", headers=headers, json={"answer": "B"})
    assert response.status_code == 200
    assert response.json()["is_correct"] is True

    response = client.post(f"/ai/questions/{ai_question_id}/attempt", headers=headers, json={"answer": "A"})
    assert response.status_code == 200
    assert response.json()["is_correct"] is False

    response = client.get("/notifications", headers=headers)
    assert response.status_code == 200
    notifications = response.json()
    assert notifications["unread_count"] >= 1
    assert any(item["type"] in {"mistakes", "review_due"} for item in notifications["items"])
    notification_id = notifications["items"][0]["id"]

    response = client.post(f"/notifications/{notification_id}/read", headers=headers)
    assert response.status_code == 200
    assert response.json()["read_at"] is not None

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

    response = client.get("/data/export", headers=headers)
    assert response.status_code == 200
    backup = response.content

    response = client.get("/data/export/anki", headers=headers)
    assert response.status_code == 200
    assert "text/tab-separated-values" in response.headers["content-type"]
    assert "word\tphonetic\tmeaning" in response.text
    assert new_items[0]["word"]["text"] in response.text

    import_headers = create_user_headers("restore")
    response = client.post(
        "/data/import",
        headers=import_headers,
        files={"file": ("backup.json", backup, "application/json")},
    )
    assert response.status_code == 200
    import_result = response.json()
    assert import_result["settings_imported"] is True
    assert import_result["progress_imported"] >= 1
    assert import_result["logs_imported"] >= 1

    response = client.get("/stats/overview", headers=import_headers)
    assert response.status_code == 200
    assert response.json()["total_reviews"] >= 1

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
