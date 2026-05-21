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
  correct_count: number;
  wrong_count: number;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  is_leech: boolean;
  is_favorite: boolean;
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
  is_favorite: boolean;
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
  category: string;
  difficulty: string;
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
  category: string;
  difficulty: string;
};

export type WordBookDetail = WordBook & {
  words: Word[];
};

export type Stats = {
  total_learning: number;
  mastered: number;
  mastered_rate: number;
  mistakes: number;
  leeches: number;
  due_today: number;
  due_new: number;
  due_review: number;
  available_new: number;
  available_review: number;
  daily_new_limit: number;
  daily_review_limit: number;
  new_completed_today: number;
  review_completed_today: number;
  completed_today: number;
  total_reviews: number;
  correct_reviews: number;
  correct_rate: number;
  weekly_reviews: number;
  weekly_correct_rate: number;
  active_days_30: number;
  streak_days: number;
  activity: DailyActivity[];
  monthly_activity: DailyActivity[];
};

export type UserSettings = {
  daily_new_limit: number;
  daily_review_limit: number;
  default_study_mode: StudyMode;
  auto_play_word: boolean;
  auto_play_example: boolean;
  auto_reveal_after_audio: boolean;
  auto_advance: boolean;
  answer_delay_ms: number;
  word_book_page_size: number;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
};

export type WordBookImportResult = {
  id: number;
  title: string;
  imported_count: number;
  skipped_count: number;
};

export type CSVPreviewWord = {
  row_number: number;
  word: string;
  meaning: string;
  phonetic: string | null;
  part_of_speech: string | null;
  example_sentence: string | null;
  example_translation: string | null;
  note: string | null;
  duplicate_in_file: boolean;
  duplicate_in_database: boolean;
};

export type CSVPreviewError = {
  row_number: number;
  message: string;
};

export type WordBookImportPreview = {
  total_rows: number;
  valid_count: number;
  error_count: number;
  duplicate_in_file_count: number;
  duplicate_in_database_count: number;
  words: CSVPreviewWord[];
  errors: CSVPreviewError[];
};

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};
