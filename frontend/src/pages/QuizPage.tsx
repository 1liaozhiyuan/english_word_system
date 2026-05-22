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
import { Link, useSearchParams } from 'react-router-dom';
import { generateStructuredQuiz, recordAIQuestionAttempt } from '../api/ai';
import { getErrorMessage } from '../api/client';
import { submitContentReport } from '../api/contentReports';
import { getFavoritesPaginated } from '../api/favorites';
import { getMistakes, getNewStudy, getTodayReview, submitAnswer } from '../api/study';
import { useAuth } from '../auth/AuthContext';
import { LoadingState } from '../components/LoadingState';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { AIQuizQuestion, StudyItem, StudyMode, Word } from '../types';

type QuizType = 'choice' | 'spelling';
type QuizTypeFilter = 'mixed' | QuizType;
type QuizMode = 'practice' | 'formal';
type QuizSource = 'mixed' | 'review' | 'new' | 'mistakes' | 'favorites';

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

const quizSourceOptions: { value: QuizSource; label: string; description: string }[] = [
  { value: 'mixed', label: '综合', description: '复习、错词和新词混合出题' },
  { value: 'review', label: '今日复习', description: '只测试今天到期的复习词' },
  { value: 'new', label: '新词', description: '只测试当前待学的新词' },
  { value: 'mistakes', label: '错词', description: '只测试错词本中的单词' },
  { value: 'favorites', label: '收藏', description: '只测试收藏夹中的单词' },
];

export function QuizPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [questions, setQuestions] = React.useState<QuizQuestion[]>([]);
  const [records, setRecords] = React.useState<QuizRecord[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [spellingInput, setSpellingInput] = React.useState('');
  const [message, setMessage] = React.useState<{ text: string; tone: 'success' | 'error' | 'info' }>({ text: '', tone: 'success' });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [aiQuestions, setAiQuestions] = React.useState<AIQuizQuestion[]>([]);
  const [aiAnswers, setAiAnswers] = React.useState<Record<string, string>>({});
  const [aiSubmitted, setAiSubmitted] = React.useState<Record<string, boolean>>({});
  const [aiReported, setAiReported] = React.useState<Record<string, string>>({});
  const [aiDifficulty, setAiDifficulty] = React.useState('基础');
  const [aiQuestionType, setAiQuestionType] = React.useState('混合');
  const [aiTimeLimit, setAiTimeLimit] = React.useState(0);
  const [aiStartedAt, setAiStartedAt] = React.useState<number | null>(null);
  const [quizMode, setQuizMode] = React.useState<QuizMode>('practice');
  const [quizSource, setQuizSource] = React.useState<QuizSource>((searchParams.get('source') as QuizSource) || 'mixed');
  const [quizType, setQuizType] = React.useState<QuizTypeFilter>(searchParams.get('mode') === 'spelling' ? 'spelling' : 'mixed');
  const [questionCount, setQuestionCount] = React.useState(12);

  React.useEffect(() => {
    loadQuiz();
  }, [token, quizSource, quizType, questionCount]);

  async function loadQuiz() {
    setIsLoading(true);
    setMessage({ text: '', tone: 'success' });
    try {
      const pool = await loadQuestionPool(token, quizSource, questionCount);
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
    const requestedMode = searchParams.get('mode');
    const studyMode: StudyMode = question.type === 'choice'
      ? requestedMode === 'cn_to_en' || requestedMode === 'listening' ? requestedMode : 'en_to_cn'
      : 'spelling';

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
    setIsAiLoading(true);
    setAiQuestions([]);
    setAiAnswers({});
    setAiSubmitted({});
    setAiReported({});
    setAiStartedAt(Date.now());
    try {
      const words = questions.map((question) => question.item.word);
      const quizLabel = `${aiDifficulty}难度 · ${aiQuestionType}题型 · 专项薄弱点测试`;
      setAiQuestions(await generateStructuredQuiz(token, words, quizLabel));
      setMessage({ text: 'AI 已生成练习题。请先作答，提交后再查看答案和解析。', tone: 'success' });
    } catch (error) {
      setAiQuestions(buildFallbackAIQuestions(questions.map((question) => question.item.word), aiQuestionType));
      setMessage({ text: `${getErrorMessage(error)} 已使用本地兜底题目。`, tone: 'info' });
    } finally {
      setIsAiLoading(false);
    }
  }

  async function submitAIQuestion(questionId: string) {
    const answer = aiAnswers[questionId] ?? '';
    if (!answer.trim()) return;
    try {
      await recordAIQuestionAttempt(token, questionId, answer);
      setAiSubmitted((value) => ({ ...value, [questionId]: true }));
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    }
  }

  function finishAIPractice(questionIds: string[]) {
    setAiSubmitted((value) => ({
      ...value,
      ...Object.fromEntries(questionIds.map((id) => [id, true])),
    }));
    setMessage({ text: '已交卷，未作答题目会按错误统计在本轮报告中。', tone: 'info' });
  }

  async function reportAIQuestion(question: AIQuizQuestion, reason: string) {
    try {
      await submitContentReport(token, {
        source_type: 'ai_question',
        source_id: question.id,
        reason,
        content: `题干：${question.prompt}\n答案：${question.answer}\n解析：${question.explanation || '无'}`,
      });
      setAiReported((value) => ({ ...value, [question.id]: reason }));
      setMessage({ text: '已提交题目反馈，后台可审核处理。', tone: 'success' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    }
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

  React.useEffect(() => {
    if (!currentRecord?.isCorrect) return;
    const timer = window.setTimeout(() => {
      if (currentIndex + 1 >= questions.length) {
        setCurrentIndex(questions.length);
      } else {
        setCurrentIndex((value) => value + 1);
      }
      setSpellingInput('');
    }, 360);
    return () => window.clearTimeout(timer);
  }, [currentRecord?.question.id, currentRecord?.isCorrect, currentIndex, questions.length]);

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
      <AIPracticePanel
        answers={aiAnswers}
        isLoading={isAiLoading}
        onAnswer={(id, answer) => setAiAnswers((value) => ({ ...value, [id]: answer }))}
        onSubmit={submitAIQuestion}
        onReport={reportAIQuestion}
        questions={aiQuestions}
        submitted={aiSubmitted}
        onFinish={finishAIPractice}
        timeLimitMinutes={aiTimeLimit}
        startedAt={aiStartedAt}
        reported={aiReported}
      />

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
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <SelectControl label="AI 难度" value={aiDifficulty} onChange={setAiDifficulty} options={['基础', '考试', '进阶']} />
          <SelectControl label="AI 题型" value={aiQuestionType} onChange={setAiQuestionType} options={['混合', '易混词', '拼写', '搭配', '例句填空']} />
          <SelectControl label="考试计时" value={String(aiTimeLimit)} onChange={(value) => setAiTimeLimit(Number(value))} options={['0', '5', '10', '20']} labels={{ '0': '不限时', '5': '5 分钟', '10': '10 分钟', '20': '20 分钟' }} />
          <div className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--line)', background: 'var(--paper)', color: 'var(--muted)' }}>
            AI 题目生成后会自动入库，后台可审核和复用。
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-3 md:grid-cols-5">
            {quizSourceOptions.map((option) => (
              <button
                className={quizSource === option.value ? 'rounded-lg border p-4 text-left' : 'rounded-lg border p-4 text-left transition hover:-translate-y-0.5'}
                key={option.value}
                onClick={() => setQuizSource(option.value)}
                style={{
                  borderColor: quizSource === option.value ? 'var(--green)' : 'var(--line)',
                  background: quizSource === option.value ? 'var(--green-soft)' : 'var(--paper)',
                }}
                type="button"
              >
                <div className="font-semibold">{option.label}</div>
                <div className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>{option.description}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
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

async function loadQuestionPool(token: string, source: QuizSource, questionCount: number) {
  const limit = Math.max(questionCount, 12);

  if (source === 'review') return uniqueStudyItems(await getTodayReview(token, limit));
  if (source === 'new') return uniqueStudyItems(await getNewStudy(token, limit));
  if (source === 'mistakes') return uniqueStudyItems((await getMistakes(token)).slice(0, limit));
  if (source === 'favorites') {
    const result = await getFavoritesPaginated(token, 1, limit);
    return uniqueStudyItems(result.items);
  }

  const [reviews, news, mistakes, favorites] = await Promise.all([
    getTodayReview(token, limit),
    getNewStudy(token, limit),
    getMistakes(token),
    getFavoritesPaginated(token, 1, Math.min(8, limit)).then((result) => result.items).catch(() => []),
  ]);
  return uniqueStudyItems([...reviews, ...mistakes.slice(0, 10), ...favorites, ...news]);
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
            {record.isCorrect ? '回答正确，正在进入下一题。' : buildFeedbackText(record, quizMode)}
          </p>
        </div>
        {!record.isCorrect && (
          <button className="button-primary" onClick={onNext} type="button">
            {isLast ? '查看结果' : '下一题'}
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function AIPracticePanel({
  answers,
  isLoading,
  onAnswer,
  onFinish,
  onReport,
  onSubmit,
  questions,
  reported,
  submitted,
  startedAt,
  timeLimitMinutes,
}: {
  answers: Record<string, string>;
  isLoading: boolean;
  onAnswer: (id: string, answer: string) => void;
  onFinish: (questionIds: string[]) => void;
  onReport: (question: AIQuizQuestion, reason: string) => void;
  onSubmit: (id: string) => void;
  questions: AIQuizQuestion[];
  reported: Record<string, string>;
  submitted: Record<string, boolean>;
  startedAt: number | null;
  timeLimitMinutes: number;
}) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    setCurrentIndex(0);
  }, [questions]);

  const boundedIndex = questions.length ? Math.min(currentIndex, questions.length - 1) : 0;
  const question = questions[boundedIndex];
  const value = question ? answers[question.id] ?? '' : '';
  const isSubmitted = question ? Boolean(submitted[question.id]) : false;
  const isCorrect = question ? isAIAnswerCorrect(question, value) : false;
  const isLast = questions.length > 0 && boundedIndex + 1 >= questions.length;
  const submittedQuestions = questions.filter((item) => submitted[item.id]);
  const correctQuestions = submittedQuestions.filter((item) => isAIAnswerCorrect(item, answers[item.id] ?? ''));
  const wrongQuestions = submittedQuestions.filter((item) => !isAIAnswerCorrect(item, answers[item.id] ?? ''));
  const isComplete = questions.length > 0 && submittedQuestions.length === questions.length;
  const remainingSeconds = timeLimitMinutes && startedAt
    ? Math.max(0, Math.ceil((startedAt + timeLimitMinutes * 60_000 - now) / 1000))
    : null;

  React.useEffect(() => {
    if (!timeLimitMinutes || !startedAt || isComplete) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [timeLimitMinutes, startedAt, isComplete]);

  React.useEffect(() => {
    if (remainingSeconds !== 0 || isComplete) return;
    onFinish(questions.map((item) => item.id));
  }, [remainingSeconds, isComplete, questions, onFinish]);

  React.useEffect(() => {
    if (!question || !isSubmitted || !isCorrect || isLast) return;
    const timer = window.setTimeout(() => {
      setCurrentIndex((value) => Math.min(value + 1, questions.length - 1));
    }, 360);
    return () => window.clearTimeout(timer);
  }, [isSubmitted, isCorrect, isLast, question?.id, questions.length]);

  if (isLoading) {
    return (
      <section className="surface mb-5 rounded-lg p-5 text-sm" style={{ color: 'var(--muted)' }}>
        AI 正在生成可作答题目...
      </section>
    );
  }
  if (!question) return null;
  if (isComplete) {
    return (
      <section className="surface mb-5 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--green)' }}>AI Result</p>
            <h3 className="mt-1 text-2xl font-semibold">AI 练习作答情况</h3>
          </div>
          <span className="text-4xl font-semibold" style={{ color: correctQuestions.length === questions.length ? 'var(--green)' : 'var(--ink)' }}>
            {Math.round((correctQuestions.length / questions.length) * 100)}%
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SummaryMetric label="题目数" value={questions.length} />
          <SummaryMetric label="答对" value={correctQuestions.length} />
          <SummaryMetric label="答错" value={wrongQuestions.length} />
        </div>
        <p className="mt-4 text-sm leading-7" style={{ color: 'var(--muted)' }}>
          {getAIPracticeAdvice(correctQuestions.length, questions.length, wrongQuestions)}
        </p>
        {wrongQuestions.length > 0 && (
          <div className="mt-4 grid gap-2">
            {wrongQuestions.map((item) => (
              <div className="rounded-lg border p-3 text-sm" key={item.id} style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                <div className="font-semibold" style={{ color: 'var(--ink)' }}>{item.prompt}</div>
                <div className="mt-1" style={{ color: 'var(--muted)' }}>你的答案：{answers[item.id] || '未作答'}</div>
                <div className="mt-1" style={{ color: 'var(--green)' }}>正确答案：{formatAIAnswer(item)}</div>
                {item.explanation && <div className="mt-1" style={{ color: 'var(--muted)' }}>解析：{item.explanation}</div>}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="surface mb-5 rounded-lg p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--green)' }}>AI Practice</p>
          <h3 className="mt-1 text-2xl font-semibold">AI 生成练习</h3>
        </div>
        {remainingSeconds !== null && (
          <span className="chip" style={{ background: remainingSeconds <= 60 ? 'var(--red-soft)' : 'var(--panel)', color: remainingSeconds <= 60 ? 'var(--red)' : 'var(--muted)' }}>
            剩余 {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
          </span>
        )}
        <button className="button-secondary" onClick={() => onFinish(questions.map((item) => item.id))} type="button">
          交卷
        </button>
        <p className="max-w-xl text-sm leading-6" style={{ color: 'var(--muted)' }}>
          答案和解析会在提交后显示，避免提前暴露影响练习效果。
        </p>
      </div>
      <div className="grid gap-4">
            <article className="rounded-lg border p-4" key={question.id} style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="chip" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                  第 {currentIndex + 1} / {questions.length} 题 · {question.type === 'choice' ? '选择' : question.type === 'blank' ? '填空' : '拼写'}
                </span>
                {question.related_word && <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>{question.related_word}</span>}
              </div>
              <p className="mt-3 text-lg font-semibold leading-8">{question.prompt}</p>
              {question.options.length > 0 ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {question.options.map((option) => (
                    <button
                      className={value === option ? 'answer answer-good justify-start px-4 text-left' : 'answer justify-start px-4 text-left'}
                      disabled={isSubmitted}
                      key={option}
                      onClick={() => onAnswer(question.id, option)}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  className="input mt-4"
                  disabled={isSubmitted}
                  onChange={(event) => onAnswer(question.id, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && value.trim()) onSubmit(question.id);
                  }}
                  placeholder="输入你的答案..."
                  value={value}
                />
              )}
              <button className="button-primary mt-4" disabled={isSubmitted || !value.trim()} onClick={() => onSubmit(question.id)} type="button">
                提交本题
              </button>
              {isSubmitted && (
                <div
                  className="mt-4 rounded-lg border p-4 text-sm leading-7"
                  style={{
                    borderColor: isCorrect ? 'var(--green)' : 'var(--red)',
                    background: isCorrect ? 'var(--green-soft)' : 'var(--red-soft)',
                    color: 'var(--ink)',
                  }}
                >
                  <div className="font-bold" style={{ color: isCorrect ? 'var(--green)' : 'var(--red)' }}>
                    {isCorrect ? '回答正确' : '回答错误'}
                  </div>
                  {isCorrect ? (
                    <div className="mt-1">{isLast ? '已完成全部 AI 练习。' : '正在进入下一题。'}</div>
                  ) : (
                    <>
                      <div className="mt-1">正确答案：{formatAIAnswer(question)}</div>
                      {question.explanation && <div className="mt-1">解析：{question.explanation}</div>}
                      <button
                        className="button-primary mt-3"
                        disabled={isLast}
                        onClick={() => setCurrentIndex((value) => Math.min(value + 1, questions.length - 1))}
                        type="button"
                      >
                        {isLast ? '已完成全部 AI 练习' : '下一题'}
                      </button>
                    </>
                  )}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ['inaccurate', '题目不准确'],
                  ['wrong_answer', '答案错误'],
                  ['bad_explanation', '解析不好'],
                ].map(([reason, label]) => (
                  <button
                    className="button-secondary"
                    disabled={Boolean(reported[question.id])}
                    key={reason}
                    onClick={() => onReport(question, reason)}
                    type="button"
                  >
                    {reported[question.id] === reason ? '已反馈' : label}
                  </button>
                ))}
              </div>
            </article>
      </div>
    </section>
  );
}

function SelectControl({
  label,
  value,
  onChange,
  options,
  labels = {},
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold" style={{ color: 'var(--muted)' }}>
      {label}
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{labels[option] ?? option}</option>
        ))}
      </select>
    </label>
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

function isAIAnswerCorrect(question: AIQuizQuestion, userAnswer: string) {
  const expected = question.answer ?? '';
  const selectedOption = resolveAIOption(question, userAnswer);
  const expectedOption = resolveAIOption(question, expected);
  const normalizedUser = normalizeAnswer(selectedOption || userAnswer);
  const normalizedExpected = normalizeAnswer(expectedOption || expected);
  if (!normalizedUser || !normalizedExpected) return false;
  return normalizedUser === normalizedExpected;
}

function resolveAIOption(question: AIQuizQuestion, answer: string) {
  const index = getOptionIndex(answer);
  if (index !== null && question.options[index]) return question.options[index];
  const normalized = normalizeAnswer(answer);
  return question.options.find((option) => normalizeAnswer(option) === normalized) ?? null;
}

function getOptionIndex(value: string) {
  const match = value.trim().match(/^([a-d])(?:[.、\s]|$)/i);
  if (!match) return null;
  return match[1].toLowerCase().charCodeAt(0) - 97;
}

function normalizeAnswer(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[a-d][.、\s]+/i, '')
    .replace(/[’']/g, "'")
    .replace(/[，。！？、,.!?;；:：()[\]{}"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatAIAnswer(question: AIQuizQuestion) {
  return resolveAIOption(question, question.answer) || question.answer;
}

function getAIPracticeAdvice(correct: number, total: number, wrongQuestions: AIQuizQuestion[]) {
  if (!total) return '还没有作答记录。';
  const rate = correct / total;
  if (rate >= 0.9) return '本轮 AI 练习表现稳定，可以继续增加题目难度或切换到正式测试。';
  if (rate >= 0.7) return '整体掌握不错，建议把错题中的相关单词加入今日复习，再做一轮变式题。';
  const weakWords = wrongQuestions.map((item) => item.related_word).filter(Boolean).slice(0, 3).join('、');
  return weakWords
    ? `本轮暴露出薄弱点，优先复盘 ${weakWords}，再重新生成一组专项题。`
    : '本轮错误偏多，建议先回到单词详情页看释义、例句和搭配，再重新练习。';
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

function buildFallbackAIQuestions(words: Word[], aiQuestionType: string): AIQuizQuestion[] {
  return words.slice(0, 6).map((word, index) => {
    const shouldSpell = aiQuestionType === '拼写' || (aiQuestionType === '混合' && index % 2 === 1);
    const shouldBlank = aiQuestionType === '例句填空';
    if (shouldSpell) {
      return {
        id: `fallback-${word.id}-spelling-${Date.now()}-${index}`,
        type: 'spelling',
        prompt: `根据中文释义写出英文单词：${word.meaning}`,
        options: [],
        answer: word.text,
        explanation: `这个词是 ${word.text}，释义为 ${word.meaning}。`,
        related_word: word.text,
      };
    }
    if (shouldBlank) {
      const sentence = word.example_sentence || `This is an example of ${word.text}.`;
      return {
        id: `fallback-${word.id}-blank-${Date.now()}-${index}`,
        type: 'blank',
        prompt: sentence.replace(new RegExp(escapeRegExp(word.text), 'i'), '____'),
        options: [],
        answer: word.text,
        explanation: `空格处应填 ${word.text}。`,
        related_word: word.text,
      };
    }
    return {
      id: `fallback-${word.id}-choice-${Date.now()}-${index}`,
      type: 'choice',
      prompt: `${word.text} 的中文释义是？`,
      options: buildMeaningOptions(word, words, index),
      answer: word.meaning,
      explanation: `${word.text} 表示：${word.meaning}。`,
      related_word: word.text,
    };
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMeaningOptions(word: Word, words: Word[], seed: number) {
  const options = new Set<string>([word.meaning]);
  seededSort(words.filter((item) => item.id !== word.id), seed)
    .map((item) => item.meaning)
    .forEach((meaning) => {
      if (options.size < 4 && meaning) options.add(meaning);
    });
  for (const fallback of ['常见释义', '抽象概念', '动作或状态', '人物或事物']) {
    if (options.size >= 4) break;
    options.add(fallback);
  }
  return seededSort([...options], seed + 19);
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
