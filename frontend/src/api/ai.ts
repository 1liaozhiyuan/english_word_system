import { api, getAuthHeaders } from './client';
import type { AIMistakeAnalysis, AIQuizQuestion, AISavedExample, Word } from '../types';

type StreamHandler = (content: string) => void;
type StreamOptions = { signal?: AbortSignal };

const aiMemoryCache = new Map<string, string>();
const AI_RESPONSE_TIMEOUT_MS = 45000;

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

export async function getMistakeAnalyses(token: string, limit = 10) {
  const { data } = await api.get<AIMistakeAnalysis[]>('/ai/mistake-analyses', {
    headers: getAuthHeaders(token),
    params: { limit },
  });
  return data;
}

export async function saveMistakeAnalysis(
  token: string,
  payload: { word_ids: number[]; content: string; source?: string },
) {
  const { data } = await api.post<AIMistakeAnalysis>('/ai/mistake-analyses', payload, {
    headers: getAuthHeaders(token),
  });
  return data;
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

export async function generateStructuredQuiz(token: string, words: Word[], quizType = '混合测试') {
  const { data } = await api.post<{ questions: AIQuizQuestion[] }>(
    '/ai/generate-quiz/structured',
    { words, quiz_type: quizType },
    { headers: getAuthHeaders(token), timeout: AI_RESPONSE_TIMEOUT_MS },
  );
  return data.questions;
}

export async function saveAIExample(
  token: string,
  payload: {
    word_id: number;
    sentence: string;
    translation?: string | null;
    raw_content?: string | null;
    source?: string;
  },
) {
  const { data } = await api.post<AISavedExample>('/ai/examples', payload, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function getAIExamples(token: string, wordId: number) {
  const { data } = await api.get<AISavedExample[]>(`/words/${wordId}/ai-examples`, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function deleteAIExample(token: string, exampleId: number) {
  const { data } = await api.delete<{ status: string }>(`/ai/examples/${exampleId}`, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function recordAIQuestionAttempt(token: string, questionId: string, answer: string) {
  const { data } = await api.post<{ id: number; question_id: number; answer: string; is_correct: boolean; created_at: string }>(
    `/ai/questions/${questionId}/attempt`,
    { answer },
    { headers: getAuthHeaders(token) },
  );
  return data;
}

async function streamAI({
  token,
  path,
  cacheKey,
  body,
  onUpdate,
  signal: externalSignal,
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
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), AI_RESPONSE_TIMEOUT_MS);
  const signal = combineSignals([externalSignal, timeoutController.signal]);

  let response: Response;
  try {
    response = await fetch(`${api.defaults.baseURL}${path}`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(externalSignal?.aborted ? 'AI 生成已停止。' : 'AI 生成超时，请稍后重试。');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

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

function combineSignals(signals: (AbortSignal | undefined)[]) {
  const activeSignals = signals.filter(Boolean) as AbortSignal[];
  if (activeSignals.length === 1) return activeSignals[0];
  const controller = new AbortController();
  activeSignals.forEach((signal) => {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  });
  return controller.signal;
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
