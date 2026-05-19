export type StudyMode = 'en_to_cn' | 'cn_to_en' | 'listening' | 'spelling';

export type User = {
  id: number;
  email: string;
};

export type Word = {
  id: number;
  text: string;
  phonetic: string | null;
  meaning: string;
  part_of_speech: string | null;
  example_sentence: string | null;
  example_translation: string | null;
  note: string | null;
};

export type WordPayload = {
  text: string;
  meaning: string;
  phonetic?: string | null;
  part_of_speech?: string | null;
  example_sentence?: string | null;
  example_translation?: string | null;
  note?: string | null;
};

export type StudyItem = {
  progress_id: number;
  word_book_id: number | null;
  status: string;
  mastery_level: number;
  easiness_factor: number;
  interval_days: number;
  is_leech: boolean;
  word: Word;
};

export type WordProgress = {
  word: Word;
  status: string | null;
  mastery_level: number;
  easiness_factor: number;
  interval_days: number;
  correct_count: number;
  wrong_count: number;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  is_leech: boolean;
};

export type ReviewLogItem = {
  id: number;
  word_id: number;
  word_text: string;
  word: Word | null;
  quality: number;
  is_correct: boolean;
  study_mode: StudyMode;
  created_at: string;
};

export type AnswerResult = {
  word_id: number;
  status: string;
  mastery_level: number;
  easiness_factor: number;
  interval_days: number;
  next_review_at: string;
  is_leech: boolean;
};

export type DailyActivity = {
  date: string;
  reviews: number;
  correct: number;
};

export type WordBook = {
  id: number;
  title: string;
  description: string;
  word_count: number;
};

export type WordBookProgress = WordBook & {
  added_count: number;
  studied_count: number;
  learning_count: number;
  mastered_count: number;
  mistake_count: number;
  completion_rate: number;
};

export type WordBookPayload = {
  title: string;
  description: string;
};

export type WordBookDetail = WordBook & {
  words: Word[];
};

export type Stats = {
  total_learning: number;
  mastered: number;
  mistakes: number;
  leeches: number;
  due_today: number;
  due_new: number;
  due_review: number;
  completed_today: number;
  correct_rate: number;
  streak_days: number;
  activity: DailyActivity[];
};

export type UserSettings = {
  daily_new_limit: number;
  daily_review_limit: number;
  default_study_mode: StudyMode;
  auto_play_word: boolean;
  auto_play_example: boolean;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
};

export type WordBookImportResult = {
  id: number;
  title: string;
  imported_count: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};
