from collections.abc import AsyncIterator
import json

from fastapi import HTTPException
import httpx

from app.core.config import settings
from app.schemas import WordRead


SYSTEM_PROMPT = (
    "你是一个专业、简洁、适合中文用户的英语词汇学习助手。"
    "回答要结构清晰，直接服务于背单词、复习和测试。"
)


def ensure_ai_configured() -> None:
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="AI 功能尚未配置。请在后端 .env 中设置 OPENAI_API_KEY。",
        )


def build_chat_payload(prompt: str, stream: bool = False) -> dict:
    return {
        "model": settings.ai_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "stream": stream,
    }


def build_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }


async def call_ai(prompt: str) -> str:
    ensure_ai_configured()
    url = f"{settings.ai_base_url.rstrip('/')}/chat/completions"
    payload = build_chat_payload(prompt)
    headers = build_headers()

    try:
        async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI 服务请求失败：{exc.response.status_code}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="AI 服务暂时不可用，请稍后重试。") from exc

    data = response.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="AI 服务返回格式异常。") from exc


async def stream_ai(prompt: str) -> AsyncIterator[str]:
    ensure_ai_configured()
    url = f"{settings.ai_base_url.rstrip('/')}/chat/completions"
    payload = build_chat_payload(prompt, stream=True)
    headers = build_headers()

    try:
        async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line.removeprefix("data: ").strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        content = chunk["choices"][0].get("delta", {}).get("content", "")
                    except (json.JSONDecodeError, KeyError, IndexError, TypeError):
                        continue
                    if content:
                        yield content
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI 服务请求失败：{exc.response.status_code}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="AI 服务暂时不可用，请稍后重试。") from exc


def format_word(word: WordRead) -> str:
    return (
        f"单词：{word.text}\n"
        f"音标：{word.phonetic or '无'}\n"
        f"释义：{word.meaning}\n"
        f"词性：{word.part_of_speech or '无'}\n"
        f"例句：{word.example_sentence or '无'}\n"
        f"例句翻译：{word.example_translation or '无'}\n"
        f"备注：{word.note or '无'}"
    )


def explain_word_prompt(word: WordRead) -> str:
    return (
        "请讲解下面这个英语单词，要求使用中文，输出包含：\n"
        "1. 核心含义\n"
        "2. 常见搭配\n"
        "3. 记忆方法或词根联想\n"
        "4. 易混点\n"
        "5. 一个新例句和中文翻译\n"
        "6. 一个小测验问题\n\n"
        f"{format_word(word)}"
    )


def generate_example_prompt(word: WordRead, level: str) -> str:
    return (
        f"请为下面单词生成 3 个{level}难度英文例句，并给出中文翻译。"
        "例句要自然、适合背单词，不要过长。\n\n"
        f"{format_word(word)}"
    )


def analyze_mistakes_prompt(words: list[WordRead]) -> str:
    word_text = "\n\n".join(format_word(word) for word in words[:30])
    return (
        "请分析这些错词，使用中文输出：\n"
        "1. 错词可能的共同原因\n"
        "2. 最需要优先处理的词\n"
        "3. 建议使用的练习模式\n"
        "4. 下一轮复习计划\n\n"
        f"{word_text or '暂无错词'}"
    )


def generate_quiz_prompt(words: list[WordRead], quiz_type: str) -> str:
    word_text = "\n\n".join(format_word(word) for word in words[:30])
    return (
        f"请基于这些单词生成一份{quiz_type}。"
        "输出 6 道题，题型可以包含选择题、拼写题、例句填空题。"
        "每题给出答案和简短解析，使用中文说明。\n\n"
        f"{word_text or '暂无单词'}"
    )
