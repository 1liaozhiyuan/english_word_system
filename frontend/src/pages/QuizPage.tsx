import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Keyboard,
  ListChecks,
  RefreshCcw,
  SearchCheck,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { generateQuiz } from '../api/ai';
import { getErrorMessage } from '../api/client';
import { getMistakes, getNewStudy, getTodayReview, submitAnswer } from '../api/study';
import { useAuth } from '../auth/AuthContext';
import { AIResultPanel } from '../components/AIResultPanel';
import { LoadingState } from '../components/LoadingState';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { StudyItem, StudyMode, Word } from '../types';

type QuizType = 'choice' | 'spelling';
type QuizTypeFilter = 'mixed' | QuizType;
type QuizMode = 'practice' | 'formal';

type QuizQuestion = {
  id: string;
  type: QuizType;
  item: StudyItem;
  options: string[];
};

type QuizRecord = {
  question: QuizQuestion;
  answer: string;
  isCorrect: boolean;
  quality: number;
  similarity?: number;
};

const quizTypeLabel: Record<QuizType, string> = {
  choice: '选择题',
  spelling: '拼写题',
};

const quizTypeOptions: { value: QuizTypeFilter; label: string; description: string }[] = [
  { value: 'mixed', label: '混合', description: '选择题和拼写题交替出现' },
  { value: 'choice', label: '选择题', description: '看英文选择中文释义' },
  { value: 'spelling', label: '拼写题', description: '看释义拼写英文' },
];

const questionCountOptions = [8, 12, 16, 20];

export function QuizPage() {
  const { token } = useAuth();
  const [questions, setQuestions] = React.useState<QuizQuestion[]>([]);
  const [records, setRecords] = React.useState<QuizRecord[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [spellingInput, setSpellingInput] = React.useState('');
  const [message, setMessage] = React.useState<{ text: string; tone: 'success' | 'error' | 'info' }>({ text: '', tone: 'success' });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [aiQuiz, setAiQuiz] = React.useState('');
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [quizMode, setQuizMode] = React.useState<QuizMode>('practice');
  const [quizType, setQuizType] = React.useState<QuizTypeFilter>('mixed');
  const [questionCount, setQuestionCount] = React.useState(12);
  const aiAbortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    loadQuiz();
  }, [token, quizType, questionCount]);

  async function loadQuiz() {
    setIsLoading(true);
    setMessage({ text: '', tone: 'success' });
    try {
      const [reviews, news, mistakes] = await Promise.all([
        getTodayReview(token, Math.max(questionCount, 12)),
        getNewStudy(token, Math.max(questionCount, 12)),
        getMistakes(token),
      ]);
      const pool = uniqueStudyItems([...reviews, ...mistakes.slice(0, 10), ...news]);
      const nextQuestions = buildQuestions(pool.slice(0, questionCount), pool.map((item) => item.word), quizType);
      setQuestions(nextQuestions);
      setRecords([]);
      setCurrentIndex(0);
      setSpellingInput('');
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  async function submitCurrent(answer: string) {
    if (isSubmitting) return;
    const question = questions[currentIndex];
    if (!question || records[currentIndex]) return;

    const spellingScore = question.type === 'spelling'
      ? getSimilarityScore(answer, question.item.word.text)
      : undefined;
    const quality = question.type === 'choice'
      ? (answer === question.item.word.meaning ? 3 : 0)
      : (spellingScore ?? 0) >= 85
        ? 3
        : (spellingScore ?? 0) >= 60
          ? 1
          : 0;
    const isCorrect = question.type === 'choice' ? quality === 3 : quality >= 2;
    const studyMode: StudyMode = question.type === 'choice' ? 'en_to_cn' : 'spelling';

    setIsSubmitting(true);
    try {
      if (quizMode === 'formal') {
        await submitAnswer(token, question.item.word.id, quality, studyMode, question.item.word_book_id ?? undefined);
      }
      setRecords((value) => [...value, { question, answer, isCorrect, quality, similarity: spellingScore }]);
      setSpellingInput('');
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGenerateAIQuiz() {
    if (questions.length === 0) return;
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setIsAiLoading(true);
    setAiQuiz('');
    try {
      const words = questions.map((question) => question.item.word);
      setAiQuiz(await generateQuiz(token, words, '专项薄弱点测试', setAiQuiz, { signal: controller.signal }));
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setAiQuiz(getErrorMessage(error));
      }
    } finally {
      setIsAiLoading(false);
      if (aiAbortRef.current === controller) aiAbortRef.current = null;
    }
  }

  function stopAI() {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setIsAiLoading(false);
  }

  function goNextQuestion() {
    if (currentIndex + 1 >= questions.length) {
      setCurrentIndex(questions.length);
      return;
    }
    setCurrentIndex((value) => value + 1);
  }

  function retryWrongQuestions() {
    const wrongItems = records.filter((record) => !record.isCorrect).map((record) => record.question.item);
    const nextQuestions = buildQuestions(wrongItems, wrongItems.map((item) => item.word), quizType);
    setQuestions(nextQuestions);
    setRecords([]);
    setCurrentIndex(0);
    setSpellingInput('');
    setMessage({ text: '已根据本轮错题重新组卷。', tone: 'info' });
  }

  const current = questions[currentIndex];
  const currentRecord = current ? records[currentIndex] : undefined;
  const isComplete = questions.length > 0 && currentIndex >= questions.length;
  const correctCount = records.filter((record) => record.isCorrect).length;
  const accuracy = records.length ? Math.round((correctCount / records.length) * 100) : 0;
  const wrongRecords = records.filter((record) => !record.isCorrect);
  const choiceStats = getTypeStats(records, 'choice');
  const spellingStats = getTypeStats(records, 'spelling');

  return (
    <>
      <PageHeader
        title="专项测试"
        description="用选择题和拼写题检查真实掌握情况。正式模式下，测试结果会写入错词和复习系统。"
        action={(
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <button className="button-secondary" disabled={questions.length === 0 || isAiLoading} onClick={handleGenerateAIQuiz} type="button">
              <Sparkles size={16} />
              AI 生成测试
            </button>
            <button className="button-secondary" onClick={loadQuiz} type="button">
              <RefreshCcw size={16} />
              重新组卷
            </button>
          </div>
        )}
      />
      <Message tone={message.tone}>{message.text}</Message>
      <AIResultPanel title="AI 专项测试" content={aiQuiz} isLoading={isAiLoading} onStop={stopAI} />

      <section className="surface mb-5 rounded-lg p-4 sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <div className="text-sm font-bold text-[#355e3b]">测试设置</div>
            <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>
              练习模式只给反馈，不影响记忆进度；正式模式会写入错词和复习计划。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button className={quizMode === 'practice' ? 'button-primary' : 'button-secondary'} onClick={() => setQuizMode('practice')} type="button">
              练习
            </button>
            <button className={quizMode === 'formal' ? 'button-primary' : 'button-secondary'} onClick={() => setQuizMode('formal')} type="button">
              正式
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-3 md:grid-cols-3">
            {quizTypeOptions.map((option) => (
              <button
                className={quizType === option.value ? 'rounded-lg border p-4 text-left' : 'rounded-lg border p-4 text-left transition hover:-translate-y-0.5'}
                key={option.value}
                onClick={() => setQuizType(option.value)}
                style={{
                  borderColor: quizType === option.value ? 'var(--green)' : 'var(--line)',
                  background: quizType === option.value ? 'var(--green-soft)' : 'var(--paper)',
                }}
                type="button"
              >
                <div className="font-semibold">{option.label}</div>
                <div className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>{option.description}</div>
              </button>
            ))}
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
            <div className="text-sm font-bold" style={{ color: 'var(--muted)' }}>题目数量</div>
            <div className="mt-3 grid grid-cols-4 gap-2 lg:flex lg:flex-wrap">
              {questionCountOptions.map((value) => (
                <button
                  className={questionCount === value ? 'button-primary h-9 px-3' : 'button-secondary h-9 px-3'}
                  key={value}
                  onClick={() => setQuestionCount(value)}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isLoading && <LoadingState text="正在生成测试题..." />}

      {!isLoading && questions.length === 0 && (
        <section className="surface flex min-h-[340px] flex-col items-center justify-center rounded-lg p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#e6efdf] text-[#355e3b] dark:bg-[#1e2f1c] dark:text-[#7fb87a]">
            <ListChecks size={28} />
          </div>
          <h2 className="mt-5 text-2xl font-semibold" style={{ color: 'var(--ink)' }}>暂时没有可测试的单词</h2>
          <p className="mt-2 max-w-xl leading-7" style={{ color: 'var(--muted)' }}>
            先选择词书并完成一轮学习，系统就能从新词、复习和错词中生成测试。
          </p>
          <Link className="button-primary mt-5" to="/word-books">
            去选择词书
            <ArrowRight size={16} />
          </Link>
        </section>
      )}

      {!isLoading && current && (
        <>
          <section className="surface mb-5 rounded-lg p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              <div>
                <div className="text-sm font-bold text-[#355e3b]">测试进度</div>
                <div className="mt-1 text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
                  {currentIndex + 1} / {questions.length}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm font-semibold sm:flex sm:flex-wrap sm:justify-end" style={{ color: 'var(--muted)' }}>
                <ProgressPill label="正确" value={correctCount} />
                <ProgressPill label="错误" value={records.length - correctCount} />
                <ProgressPill label="正确率" value={`${accuracy}%`} />
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#eee8d8] dark:bg-[#3d3a32]">
              <div
                className="h-full rounded-full bg-[#355e3b] dark:bg-[#7fb87a]"
                style={{ width: `${Math.round((records.length / questions.length) * 100)}%` }}
              />
            </div>
          </section>

          <section className="surface rounded-lg p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full bg-[#e6efdf] px-3 py-1 text-xs font-bold text-[#355e3b] dark:bg-[#1e2f1c] dark:text-[#7fb87a]">
                {quizTypeLabel[current.type]}
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>
                {current.item.word.part_of_speech || '词性未标注'}
              </span>
            </div>

            {current.type === 'choice' ? (
              <ChoiceQuestion question={current} record={currentRecord} isSubmitting={isSubmitting} onSubmit={submitCurrent} />
            ) : (
              <SpellingQuestion
                question={current}
                value={spellingInput}
                record={currentRecord}
                isSubmitting={isSubmitting}
                onChange={setSpellingInput}
                onSubmit={() => submitCurrent(spellingInput)}
              />
            )}

            {currentRecord && (
              <FeedbackPanel record={currentRecord} quizMode={quizMode} isLast={currentIndex + 1 >= questions.length} onNext={goNextQuestion} />
            )}
          </section>
        </>
      )}

      {isComplete && (
        <section className="surface rounded-lg p-6">
          <p className="text-sm font-bold text-[#355e3b]">测试完成</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl" style={{ color: 'var(--ink)' }}>
            正确率 {accuracy}%
          </h2>
          <p className="mt-3 max-w-2xl leading-7" style={{ color: 'var(--muted)' }}>
            {getResultAdvice(accuracy, wrongRecords.length)}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <SummaryMetric label="题目数" value={records.length} />
            <SummaryMetric label="答对" value={correctCount} />
            <SummaryMetric label="答错" value={wrongRecords.length} />
            <SummaryMetric label="正式写入" value={quizMode === 'formal' ? records.length : 0} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <TypeReport title="选择题表现" icon={<SearchCheck size={18} />} stats={choiceStats} />
            <TypeReport title="拼写题表现" icon={<Keyboard size={18} />} stats={spellingStats} />
          </div>

          {wrongRecords.length > 0 && (
            <div className="mt-5">
              <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>本次错题</h3>
              <div className="mt-3 grid gap-3">
                {wrongRecords.map((record) => (
                  <WrongRecordCard record={record} key={record.question.id} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-2 sm:flex sm:flex-wrap">
            <button className="button-primary" onClick={loadQuiz} type="button">
              再测一轮
            </button>
            {wrongRecords.length > 0 && (
              <button className="button-secondary" onClick={retryWrongQuestions} type="button">
                重测错题
              </button>
            )}
            {wrongRecords.length > 0 && (
              <Link className="button-secondary" to="/mistakes">
                复盘错词
                <ArrowRight size={16} />
              </Link>
            )}
            <Link className="button-secondary" to="/dashboard">
              返回首页
            </Link>
          </div>
        </section>
      )}
    </>
  );
}

function ChoiceQuestion({
  question,
  record,
  isSubmitting,
  onSubmit,
}: {
  question: QuizQuestion;
  record?: QuizRecord;
  isSubmitting: boolean;
  onSubmit: (answer: string) => void;
}) {
  return (
    <div className="mt-8">
      <h2 className="break-words text-4xl font-semibold tracking-normal sm:text-5xl md:text-6xl" style={{ color: 'var(--ink)' }}>
        {question.item.word.text}
      </h2>
      {question.item.word.phonetic && (
        <p className="mt-4 text-lg font-semibold text-[#355e3b] dark:text-[#7fb87a]">
          {question.item.word.phonetic}
        </p>
      )}
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {question.options.map((option) => (
          <button
            className={getOptionClass(option, question.item.word.meaning, record)}
            disabled={isSubmitting || Boolean(record)}
            key={option}
            onClick={() => onSubmit(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function SpellingQuestion({
  question,
  value,
  record,
  isSubmitting,
  onChange,
  onSubmit,
}: {
  question: QuizQuestion;
  value: string;
  record?: QuizRecord;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#f5ead2] text-[#9b6b2f] dark:bg-[#2e2516] dark:text-[#d4a346]">
          <Keyboard size={24} />
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: 'var(--muted)' }}>根据中文写英文</div>
          <h2 className="mt-1 break-words text-4xl font-semibold tracking-normal" style={{ color: 'var(--ink)' }}>
            {question.item.word.meaning}
          </h2>
        </div>
      </div>
      <div className="mt-8 max-w-xl rounded-lg border p-4 sm:p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
        <input
          autoFocus
          className="input"
          disabled={isSubmitting || Boolean(record)}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && value.trim() && !record) onSubmit();
          }}
          placeholder="输入英文单词..."
          value={record?.answer ?? value}
        />
        <button className="button-primary mt-3 w-full sm:w-auto" disabled={isSubmitting || Boolean(record) || !value.trim()} onClick={onSubmit} type="button">
          提交答案
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function FeedbackPanel({
  record,
  quizMode,
  isLast,
  onNext,
}: {
  record: QuizRecord;
  quizMode: QuizMode;
  isLast: boolean;
  onNext: () => void;
}) {
  return (
    <div
      className="mt-8 rounded-lg border p-5"
      style={{
        borderColor: record.isCorrect ? 'var(--green)' : 'var(--red)',
        background: record.isCorrect ? 'var(--green-soft)' : 'var(--red-soft)',
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: record.isCorrect ? 'var(--green)' : 'var(--red)' }}>
            {record.isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {record.isCorrect ? '回答正确' : '回答错误'}
          </div>
          <p className="mt-2 leading-7" style={{ color: 'var(--ink)' }}>
            {buildFeedbackText(record, quizMode)}
          </p>
        </div>
        <button className="button-primary" onClick={onNext} type="button">
          {isLast ? '查看结果' : '下一题'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function WrongRecordCard({ record }: { record: QuizRecord }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-semibold" style={{ color: 'var(--ink)' }}>{record.question.item.word.text}</div>
        <span className="rounded-full bg-[#f4dddd] px-3 py-1 text-xs font-bold text-[#a13d3d]">
          {quizTypeLabel[record.question.type]}
        </span>
      </div>
      <div className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>
        释义：{record.question.item.word.meaning}
      </div>
      <div className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>
        你的答案：{record.answer || '未填写'}
      </div>
      {typeof record.similarity === 'number' && (
        <div className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>
          拼写相似度：{record.similarity}%
        </div>
      )}
      {record.question.item.word.example_sentence && (
        <div className="mt-3 rounded-lg bg-[#fffdf8] p-3 text-sm leading-6 dark:bg-[#1f1d18]" style={{ color: 'var(--muted)' }}>
          {record.question.item.word.example_sentence}
        </div>
      )}
    </div>
  );
}

function TypeReport({
  title,
  icon,
  stats,
}: {
  title: string;
  icon: React.ReactNode;
  stats: { total: number; correct: number; accuracy: number };
}) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--green)' }}>
        {icon}
        {title}
      </div>
      <div className="mt-3 text-3xl font-semibold" style={{ color: 'var(--ink)' }}>{stats.accuracy}%</div>
      <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
        {stats.correct} / {stats.total || 0} 题正确
      </div>
    </div>
  );
}

function buildFeedbackText(record: QuizRecord, quizMode: QuizMode) {
  if (record.isCorrect) {
    return quizMode === 'formal'
      ? '这个词已经比较稳定，系统会把它安排到更合适的复习时间。'
      : '回答正确。当前是练习模式，这次结果只用于本轮反馈。';
  }
  const answer = `${record.question.item.word.text}，释义为 ${record.question.item.word.meaning}`;
  return quizMode === 'formal'
    ? `正确答案是 ${answer}。这道题已经进入错词和复习系统。`
    : `正确答案是 ${answer}。当前是练习模式，不会改动你的学习进度。`;
}

function getOptionClass(option: string, correctAnswer: string, record?: QuizRecord) {
  const base = 'answer min-h-[64px] justify-start px-4 text-left';
  if (!record) return base;
  if (option === correctAnswer) return `${base} answer-good`;
  if (option === record.answer && !record.isCorrect) return `${base} answer-wrong`;
  return base;
}

function buildQuestions(items: StudyItem[], words: Word[], typeFilter: QuizTypeFilter) {
  return items.map((item, index) => {
    const type: QuizType = typeFilter === 'mixed'
      ? index % 2 === 0 ? 'choice' : 'spelling'
      : typeFilter;
    return {
      id: `${item.progress_id}-${type}-${index}-${Date.now()}`,
      type,
      item,
      options: type === 'choice' ? buildOptions(item.word, words, index) : [],
    };
  });
}

function buildOptions(word: Word, words: Word[], seed: number) {
  const options = new Set<string>([word.meaning]);
  const candidates = seededSort(
    words
      .filter((item) => item.id !== word.id)
      .map((item) => item.meaning)
      .filter(Boolean),
    seed,
  );

  for (const candidate of candidates) {
    if (options.size >= 4) break;
    options.add(candidate);
  }

  for (const fallback of ['常见释义', '抽象概念', '动作或状态', '人物或事物']) {
    if (options.size >= 4) break;
    options.add(fallback);
  }

  return seededSort([...options], seed + 11);
}

function uniqueStudyItems(items: StudyItem[]) {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.progress_id)) return false;
    seen.add(item.progress_id);
    return true;
  });
}

function seededSort<T>(items: T[], seed: number) {
  return [...items].sort((a, b) => stableHash(String(a), seed) - stableHash(String(b), seed));
}

function stableHash(value: string, seed: number) {
  let hash = seed + 17;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000003;
  }
  return hash;
}

function normalizeWord(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function getSimilarityScore(input: string, target: string) {
  const left = normalizeWord(input);
  const right = normalizeWord(target);
  if (!left && !right) return 100;
  if (!left || !right) return 0;
  const distance = levenshteinDistance(left, right);
  const maxLength = Math.max(left.length, right.length);
  return Math.round(((maxLength - distance) / maxLength) * 100);
}

function levenshteinDistance(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  for (let column = 1; column <= right.length; column += 1) rows[0][column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + cost,
      );
    }
  }
  return rows[left.length][right.length];
}

function getResultAdvice(accuracy: number, wrongCount: number) {
  if (wrongCount === 0) return '这一轮全部答对，说明这些词已经比较稳定，可以继续学习或去做复习。';
  if (accuracy >= 70) return '整体表现不错，但错题已经暴露出薄弱点，建议趁热复盘一次。';
  return '这一轮错误偏多，建议先复盘错题，不要急着继续增加新词。';
}

function getTypeStats(records: QuizRecord[], type: QuizType) {
  const filtered = records.filter((record) => record.question.type === type);
  const correct = filtered.filter((record) => record.isCorrect).length;
  return {
    total: filtered.length,
    correct,
    accuracy: filtered.length ? Math.round((correct / filtered.length) * 100) : 0,
  };
}

function ProgressPill({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="min-w-0 rounded-full border border-[#ddd7c7] bg-[#fbf8ef] px-3 py-1 text-center dark:border-[#3d3a32] dark:bg-[#1f1d18]">
      {label} {value}
    </span>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="text-3xl font-semibold" style={{ color: 'var(--ink)' }}>{value}</div>
      <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}
