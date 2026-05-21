import { api, getAuthHeaders } from './client';
import type { StudyMode, UserSettings } from '../types';

export async function getSettings(token: string) {
  const { data } = await api.get<UserSettings>('/settings', {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function updateSettings(
  token: string,
  payload: {
    daily_new_limit?: number;
    daily_review_limit?: number;
    default_study_mode?: StudyMode;
    auto_play_word?: boolean;
    auto_play_example?: boolean;
    auto_reveal_after_audio?: boolean;
    auto_advance?: boolean;
    answer_delay_ms?: number;
    word_book_page_size?: number;
  },
) {
  const { data } = await api.patch<UserSettings>('/settings', payload, {
    headers: getAuthHeaders(token),
  });
  return data;
}
