import { api, getAuthHeaders } from './client';
import type { FeedbackItem, FeedbackPayload } from '../types';

export async function submitFeedback(token: string, payload: FeedbackPayload) {
  const { data } = await api.post<FeedbackItem>('/feedback', payload, {
    headers: getAuthHeaders(token),
  });
  return data;
}
