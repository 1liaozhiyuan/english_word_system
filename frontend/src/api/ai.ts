import { api, getAuthHeaders } from './client';
import type { Word } from '../types';

type StreamHandler = (content: string) => void;
type StreamOptions = { signal?: AbortSignal };

const aiMemoryCache = new Map<string, string>();

export async function explainWord(token: string, word: Word, onUpdate?: StreamHandler, options?: StreamOptions) {
  return streamAI({
    token,
    path: '/ai/explain-word/stream',
    cacheKey: `explain:${wordCacheKey(word)}`,
    body: { word },
    onUpdate,
    signal: options?.signal,
  });
}

export async function generateExample(token: string, word: Word, level = '中等', onUpdate?: StreamHandler, options?: StreamOptions) {
  return streamAI({
    token,
    path: '/ai/generate-example/stream',
    cacheKey: `example:${level}:${wordCacheKey(word)}`,
    body: { word, level },
    onUpdate,
    signal: options?.signal,
  });
}

export async function analyzeMistakes(token: string, words: Word[], onUpdate?: StreamHandler, options?: StreamOptions) {
  return streamAI({
    token,
    path: '/ai/analyze-mistakes/stream',
    cacheKey: `mistakes:${words.map(wordCacheKey).join('|')}`,
    body: { words },
    onUpdate,
    signal: options?.signal,
  });
}

export async function generateQuiz(
  token: string,
  words: Word[],
  quizType = '混合测试',
  onUpdate?: StreamHandler,
  options?: StreamOptions,
) {
  return streamAI({
    token,
    path: '/ai/generate-quiz/stream',
    cacheKey: `quiz:${quizType}:${words.map(wordCacheKey).join('|')}`,
    body: { words, quiz_type: quizType },
    onUpdate,
    signal: options?.signal,
  });
}

async function streamAI({
  token,
  path,
  cacheKey,
  body,
  onUpdate,
  signal,
}: {
  token: string;
  path: string;
  cacheKey: string;
  body: unknown;
  onUpdate?: StreamHandler;
  signal?: AbortSignal;
}) {
  const scopedCacheKey = `${tokenCacheKey(token)}:${cacheKey}`;
  const cached = aiMemoryCache.get(scopedCacheKey);
  if (cached) {
    onUpdate?.(cached);
    return cached;
  }

  const response = await fetch(`${api.defaults.baseURL}${path}`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(await getStreamErrorMessage(response));
  }

  if (!response.body) {
    throw new Error('当前浏览器不支持 AI 流式输出。');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let content = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    content += decoder.decode(value, { stream: true });
    onUpdate?.(content);
  }
  content += decoder.decode();

  aiMemoryCache.set(scopedCacheKey, content);
  onUpdate?.(content);
  return content;
}

async function getStreamErrorMessage(response: Response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    if (typeof data.detail === 'string') return data.detail;
  } catch {
    // Fall through to plain text.
  }
  return text || 'AI 请求失败，请稍后重试。';
}

function wordCacheKey(word: Word) {
  return [
    word.id,
    word.text,
    word.meaning,
    word.part_of_speech ?? '',
    word.example_sentence ?? '',
  ].join(':');
}

function tokenCacheKey(token: string) {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
