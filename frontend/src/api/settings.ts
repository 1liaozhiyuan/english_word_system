import { api, getAuthHeaders } from './client';
import type { SpeechAccent, StudyMode, UserSettings } from '../types';

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
    speech_accent?: SpeechAccent;
    answer_delay_ms?: number;
    word_book_page_size?: number;
    onboarding_completed?: boolean;
    learning_goal?: string | null;
    english_level?: string | null;
    exam_type?: string | null;
    target_date?: string | null;
    daily_minutes?: number;
    wants_speaking?: boolean;
    wants_listening?: boolean;
    wants_ai_tutor?: boolean;
    reminder_enabled?: boolean;
    reminder_time?: string | null;
    membership_tier?: string;
    membership_expires_at?: string | null;
  },
) {
  const { data } = await api.patch<UserSettings>('/settings', payload, {
    headers: getAuthHeaders(token),
  });
  return data;
}
