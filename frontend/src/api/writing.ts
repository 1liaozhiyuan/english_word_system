import { api, getAuthHeaders } from './client';
import type { WritingPrompt, WritingSubmission } from '../types';

export async function getWritingPrompts(token: string, limit = 8) {
  const { data } = await api.get<WritingPrompt[]>('/writing/prompts', {
    headers: getAuthHeaders(token),
    params: { limit },
  });
  return data;
}

export async function submitWriting(
  token: string,
  payload: { prompt: string; content: string },
) {
  const { data } = await api.post<WritingSubmission>('/writing/submissions', payload, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function getWritingSubmissions(token: string, limit = 20) {
  const { data } = await api.get<WritingSubmission[]>('/writing/submissions', {
    headers: getAuthHeaders(token),
    params: { limit },
  });
  return data;
}
