export type StudyMode = 'en_to_cn' | 'cn_to_en' | 'listening' | 'spelling';
export type SpeechAccent = 'en-US' | 'en-GB';

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

export type WordDetail = WordProgress & {
  word_book_id: number | null;
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
  speech_accent: SpeechAccent;
  answer_delay_ms: number;
  word_book_page_size: number;
  onboarding_completed: boolean;
  learning_goal: string | null;
  english_level: string | null;
  exam_type: string | null;
  target_date: string | null;
  daily_minutes: number;
  wants_speaking: boolean;
  wants_listening: boolean;
  wants_ai_tutor: boolean;
  reminder_enabled: boolean;
  reminder_time: string | null;
  membership_tier: string;
  membership_expires_at: string | null;
};

export type MembershipStatus = {
  tier: string;
  is_member: boolean;
  expires_at: string | null;
  daily_ai_limit: number;
  ai_used_today: number;
  ai_remaining_today: number;
};

export type MembershipPlan = {
  id: number;
  code: string;
  name: string;
  description: string;
  price_cents: number;
  duration_days: number;
  ai_daily_limit: number;
  is_active: boolean;
  is_recommended: boolean;
  created_at: string;
};

export type MembershipOrder = {
  id: number;
  order_no: string;
  user_id: number;
  user_email: string | null;
  plan_id: number;
  plan_name: string;
  amount_cents: number;
  status: string;
  paid_at: string | null;
  created_at: string;
};

export type FeedbackPayload = {
  category: string;
  content: string;
  contact?: string | null;
};

export type FeedbackItem = FeedbackPayload & {
  id: number;
  status: string;
  created_at: string;
};

export type ContentReport = {
  id: number;
  user_id: number;
  user_email: string | null;
  source_type: string;
  source_id: string | null;
  reason: string;
  content: string;
  status: string;
  reviewer_user_id: number | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
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

export type DataImportResult = {
  progress_imported: number;
  logs_imported: number;
  favorites_imported: number;
  settings_imported: boolean;
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

export type LearningPlan = {
  learning_goal: string | null;
  english_level: string | null;
  target_date: string | null;
  daily_minutes: number;
  daily_new_limit: number;
  daily_review_limit: number;
  total_words: number;
  studied_words: number;
  mastered_words: number;
  remaining_words: number;
  overall_completion_rate: number;
  today_completion_rate: number;
  days_left: number | null;
  estimated_finish_days: number | null;
  recommended_daily_new_limit: number;
  risk_level: 'setup' | 'healthy' | 'medium' | 'high';
  risk_message: string;
  current_books: WordBookProgress[];
};

export type CheckInBadge = {
  code: string;
  title: string;
  description: string;
  earned: boolean;
  progress: number;
  target: number;
};

export type CheckInStatus = {
  checked_in_today: boolean;
  can_check_in: boolean;
  remaining_tasks: number;
  completed_today: number;
  today_progress_rate: number;
  streak_days: number;
  active_days_30: number;
  total_learning_days: number;
  total_reviews: number;
  correct_rate: number;
  mastered_words: number;
  badges: CheckInBadge[];
};

export type LearningReportFocusWord = {
  word_id: number;
  text: string;
  meaning: string;
  wrong_count: number;
  correct_count: number;
  mastery_level: number;
};

export type LearningReport = {
  summary: string;
  total_learning: number;
  mastered: number;
  mastered_rate: number;
  mistakes: number;
  leeches: number;
  total_reviews: number;
  correct_rate: number;
  weekly_reviews: number;
  weekly_correct_rate: number;
  streak_days: number;
  active_days_30: number;
  today_completed: number;
  today_remaining: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  focus_words: LearningReportFocusWord[];
  activity: DailyActivity[];
};

export type AISavedExample = {
  id: number;
  word_id: number;
  sentence: string;
  translation: string | null;
  raw_content: string | null;
  source: string;
  created_at: string;
};

export type AIQuizQuestion = {
  id: string;
  type: 'choice' | 'spelling' | 'blank';
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
  related_word: string | null;
};

export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  content: string;
  action_url: string | null;
  scheduled_at: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationSummary = {
  unread_count: number;
  items: NotificationItem[];
};

export type ListeningQuestion = {
  id: string;
  word_id: number;
  word_book_id: number | null;
  audio_text: string;
  phonetic: string | null;
  options: string[];
};

export type ListeningAnswerResult = {
  word_id: number;
  is_correct: boolean;
  correct_answer: string;
  explanation: string;
  progress: AnswerResult;
};

export type SpeakingPrompt = {
  word_id: number;
  word_text: string;
  phonetic: string | null;
  meaning: string;
  prompt_text: string;
  translation: string | null;
};

export type SpeakingAttempt = {
  id: number;
  word_id: number;
  prompt_text: string;
  transcript: string;
  accuracy_score: number;
  feedback: string;
  created_at: string;
};

export type ReadingKnownWord = {
  word_id: number;
  text: string;
  meaning: string;
  mastery_level: number;
};

export type ReadingArticle = {
  id: number;
  title: string;
  category: string;
  level: string;
  content: string;
  translation: string | null;
  audio_text: string | null;
  created_at: string;
  completed: boolean;
  known_words: ReadingKnownWord[];
};

export type ReadingProgressResult = {
  id: number;
  article_id: number;
  completed_at: string;
  reading_seconds: number;
};
