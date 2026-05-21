import { api, getAuthHeaders } from './client';
import type { SpeakingAttempt, SpeakingPrompt } from '../types';

export async function getSpeakingSession(token: string, limit = 8) {
  const { data } = await api.get<SpeakingPrompt[]>('/speaking/session', {
    headers: getAuthHeaders(token),
    params: { limit },
  });
  return data;
}

export async function submitSpeakingAttempt(
  token: string,
  payload: { word_id: number; prompt_text: string; transcript: string },
) {
  const { data } = await api.post<SpeakingAttempt>('/speaking/attempts', payload, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function getSpeakingAttempts(token: string) {
  const { data } = await api.get<SpeakingAttempt[]>('/speaking/attempts', {
    headers: getAuthHeaders(token),
  });
  return data;
}
