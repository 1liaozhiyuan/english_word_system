import { api, getAuthHeaders } from './client';
import type { ListeningAnswerResult, ListeningQuestion } from '../types';

export async function getListeningSession(token: string, limit = 10) {
  const { data } = await api.get<ListeningQuestion[]>('/listening/session', {
    headers: getAuthHeaders(token),
    params: { limit },
  });
  return data;
}

export async function answerListeningQuestion(
  token: string,
  payload: { word_id: number; selected_meaning: string; word_book_id?: number | null },
) {
  const { data } = await api.post<ListeningAnswerResult>('/listening/answer', payload, {
    headers: getAuthHeaders(token),
  });
  return data;
}
