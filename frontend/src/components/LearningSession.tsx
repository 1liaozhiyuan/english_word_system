
import { AlertTriangle, ArrowRight, CheckCircle2, RotateCcw, Target } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { getSettings } from '../api/settings';
import { submitAnswer } from '../api/study';
import { useAuth } from '../auth/AuthContext';
import { Message } from './Message';
import { PageHeader } from './PageHeader';
import { WordCard } from './WordCard';
import type { AnswerResult, StudyItem, StudyMode, Word } from '../types';

const answerText: Record<number, string> = {
  0: '不认识',
  1: '困难',
  2: '认识',
  3: '熟练',
};

export function LearningSession({
  title,
  description,
  emptyText,
  loadItems,
  completionTitle,
  defaultBatchSize,
  nextAction,
  emptyNextAction,
}: {
  title: string;
  description: string;
  emptyText: string;
  loadItems: (token: string, limit?: number) => Promise<StudyItem[]>;
  completionTitle: string;
  defaultBatchSize: number;
  nextAction: { label: string; to: string };
  emptyNextAction?: { label: string; to: string };
}) {
  const { token } = useAuth();
  const [items, setItems] = React.useState<StudyItem[]>([]);
  const [batchSize, setBatchSize] = React.useState(defaultBatchSize);
  const [initialTotal, setInitialTotal] = React.useState(0);
  const [answered, setAnswered] = React.useState(0);
  const [correct, setCorrect] = React.useState(0);
  const [wrongWords, setWrongWords] = React.useState<Word[]>([]);
  const [lastResult, setLastResult] = React.useState<{ quality: number; result: AnswerResult } | null>(null);
  const [message, setMessage] = React.useState<{ text: string; tone: 'success' | 'error' | 'info' }>({ text: '', tone: 'success' });
  const [studyMode, setStudyMode] = React.useState<StudyMode>('en_to_cn');
  const [autoPlayWord, setAutoPlayWord] = React.useState(true);
  const [autoPlayExample, setAutoPlayExample] = React.useState(true);
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function refresh(resetSession = false, nextBatchSize = batchSize) {
    try {
      const nextItems = await loadItems(token, nextBatchSize);
      setItems(nextItems);
      if (resetSession || initialTotal === 0) {
        setInitialTotal(nextItems.length);
        setAnswered(0);
        setCorrect(0);
        setWrongWords([]);
        setLastResult(null);
      }
      if (resetSession) setMessage({ text: '学习任务已重新加载。', tone: 'info' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    }
  }

  async function handleAnswer(quality: number) {
    if (isSubmitting) return;
    const current = items[0];
    if (!current) return;

    setIsSubmitting(true);
    try {
      const result = await submitAnswer(
        token,
        current.word.id,
        quality,
        studyMode,
        current.word_book_id ?? undefined,
      );
      setAnswered((value) => value + 1);
      if (quality > 0) {
        setCorrect((value) => value + 1);
      } else {
        setWrongWords((value) => [...value, current.word]);
      }
      setLastResult({ quality, result });

      const leechText = result.is_leech ? ' 已标记为重点难词。' : '';
      setMessage({
        text: `已记录：${answerText[quality]}。下次复习：${formatNextReview(result.next_review_at)}。${leechText}`,
        tone: quality > 0 ? 'success' : 'info',
      });

      const remainingLimit = Math.max(1, batchSize - answered - 1);
      const nextItems = await loadItems(token, remainingLimit);
      setItems(nextItems);
      if (initialTotal === 0) {
        setInitialTotal(Math.max(1, nextItems.length + 1));
      }
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBatchSizeChange(value: number) {
    setBatchSize(value);
    refresh(true, value);
  }

  React.useEffect(() => {
    getSettings(token)
      .then((settings) => {
        setStudyMode(settings.default_study_mode);
        setAutoPlayWord(settings.auto_play_word);
        setAutoPlayExample(settings.auto_play_example);
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));
  }, [token]);

  React.useEffect(() => {
    if (settingsLoaded) refresh(true, defaultBatchSize);
  }, [settingsLoaded, token, defaultBatchSize]);

  const total = Math.max(initialTotal, answered + items.length);
  const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
  const liveAccuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const isComplete = answered > 0 && items.length === 0;
  const completionStats = getCompletionStats(answered, correct, wrongWords.length);
  const recommendedAction = getRecommendedAction({ wrongCount: wrongWords.length, correctCount: correct, answered, nextAction });

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={(
          <button className="button-secondary" onClick={() => refresh(true)} type="button">
            <RotateCcw size={16} />
            重新加载
          </button>
        )}
      />
      <Message tone={message.tone}>{message.text}</Message>

      <section className="surface mb-5 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-[#355e3b]">学习模式</div>
            <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              选择不同训练方式，系统会按同一套记忆进度记录表现。
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {studyModes.map(({ mode, label }) => (
              <button
                className={studyMode === mode ? 'button-primary' : 'button-secondary'}
                key={mode}
                onClick={() => setStudyMode(mode)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="surface mb-5 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-[#355e3b]">本轮数量</div>
            <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              根据当前精力选择一组任务，完成后再进入下一轮。
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[5, 10, 20, 30].map((value) => (
              <button
                className={batchSize === value ? 'button-primary' : 'button-secondary'}
                key={value}
                onClick={() => handleBatchSizeChange(value)}
                type="button"
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </section>

      {items[0] && (
        <>
          <section className="surface mb-5 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-[#355e3b]">本轮进度</div>
                <div className="mt-1 text-2xl font-semibold">
                  {answered + 1} / {total}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm font-semibold" style={{ color: 'var(--muted)' }}>
                <ProgressPill label="正确" value={correct} />
                <ProgressPill label="错误" value={wrongWords.length} />
                <ProgressPill label="正确率" value={`${liveAccuracy}%`} />
                <ProgressPill label="剩余" value={Math.max(total - answered, 0)} />
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#eee8d8] dark:bg-[#3d3a32]">
              <div className="h-full rounded-full bg-[#355e3b] dark:bg-[#7fb87a]" style={{ width: `${progress}%` }} />
            </div>
            {lastResult && (
              <div className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
                上一题：{answerText[lastResult.quality]}，下次复习 {formatNextReview(lastResult.result.next_review_at)}
                {lastResult.result.is_leech ? ' | 已识别为重点难词' : ''}
              </div>
            )}
          </section>
          <WordCard
            item={items[0]}
            studyMode={studyMode}
            autoPlayWord={autoPlayWord}
            autoPlayExample={autoPlayExample}
            isSubmitting={isSubmitting}
            onAnswer={handleAnswer}
          />
        </>
      )}

      {isComplete && (
        <section className="surface rounded-lg p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_220px] lg:items-start">
            <div>
              <p className="text-sm font-bold text-[#355e3b]">本轮完成</p>
              <h2 className="mt-2 text-4xl font-semibold tracking-normal">{completionTitle}</h2>
              <p className="mt-3 max-w-2xl leading-7" style={{ color: 'var(--muted)' }}>
                {completionStats.description}
              </p>
            </div>
            <div className="rounded-lg border border-[#ddd7c7] bg-[#fbf8ef] p-5 text-center dark:border-[#3d3a32] dark:bg-[#1f1d18]">
              <div
                className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-8 text-3xl font-semibold"
                style={{ borderColor: completionStats.color, color: completionStats.color }}
              >
                {completionStats.accuracy}%
              </div>
              <div className="mt-3 text-sm font-bold" style={{ color: completionStats.color }}>
                {completionStats.title}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <SummaryMetric label="完成" value={answered} />
            <SummaryMetric label="正确" value={correct} />
            <SummaryMetric label="错误" value={wrongWords.length} />
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <AdvicePanel icon={<Target size={19} />} title="下一步建议" text={completionStats.nextAdvice} tone="green" />
            <AdvicePanel
              icon={wrongWords.length > 0 ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}
              title={wrongWords.length > 0 ? '错词处理' : '状态很好'}
              text={completionStats.mistakeAdvice}
              tone={wrongWords.length > 0 ? 'amber' : 'green'}
            />
          </div>

          {wrongWords.length > 0 && (
            <div className="mt-5">
              <h3 className="font-semibold">本轮错词</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {wrongWords.map((word) => (
                  <span className="rounded-full bg-[#f4dddd] px-3 py-1 text-sm font-bold text-[#a13d3d]" key={word.id}>
                    {word.text}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <button className="button-primary" onClick={() => refresh(true)} type="button">
              继续一轮
            </button>
            <Link className="button-secondary" to={recommendedAction.to}>
              {recommendedAction.label}
              <ArrowRight size={16} />
            </Link>
            <Link className="button-secondary" to="/dashboard">
              返回首页
            </Link>
          </div>
        </section>
      )}

      {!items[0] && !isComplete && (
        <div className="surface flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-lg p-6 text-center" style={{ color: 'var(--muted)' }}>
          <div>{emptyText}</div>
          {emptyNextAction && (
            <Link className="button-primary" to={emptyNextAction.to}>
              {emptyNextAction.label}
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      )}
    </>
  );
}

function getRecommendedAction({
  wrongCount,
  correctCount,
  answered,
  nextAction,
}: {
  wrongCount: number;
  correctCount: number;
  answered: number;
  nextAction: { label: string; to: string };
}) {
  if (wrongCount >= 3 || (answered >= 5 && wrongCount > correctCount)) {
    return { label: '复盘错词', to: '/mistakes' };
  }
  return nextAction;
}

function getCompletionStats(answered: number, correct: number, wrongCount: number) {
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

  if (wrongCount === 0) {
    return {
      accuracy,
      title: '稳定完成',
      color: 'var(--green)',
      description: '这一轮没有新增错词，说明当前任务难度比较合适。可以继续下一组，也可以去复习页处理到期单词。',
      nextAdvice: '如果精力还不错，可以继续一小组；如果已经学习了一段时间，去复习页清理到期单词会更稳。',
      mistakeAdvice: '本轮没有新增错词，当前词组可以放心进入后续间隔复习。',
    };
  }

  if (accuracy >= 70) {
    return {
      accuracy,
      title: '整体可控',
      color: 'var(--amber)',
      description: '这一轮大部分单词已经能识别，少量错误会进入错词本。现在适合做一次短复盘。',
      nextAdvice: '建议先看一眼错词，再继续下一组，避免错误记忆被带到后面的学习里。',
      mistakeAdvice: '错词数量不多，可以在错词本里安排重练，重点看释义和例句。',
    };
  }

  return {
    accuracy,
    title: '需要复盘',
    color: 'var(--red)',
    description: '这一轮错误偏多，说明这组词对你来说负荷较高。先复盘比继续加新词更有效。',
    nextAdvice: '建议暂时不要继续加新词，先进入错词本，把刚才出错的词重新过一遍。',
    mistakeAdvice: '优先处理错词，尤其是反复出错的单词，系统会逐步把它们识别为重点难词。',
  };
}

function AdvicePanel({
  icon,
  title,
  text,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: 'green' | 'amber';
}) {
  const color = tone === 'green' ? 'var(--green)' : 'var(--amber)';
  const background = tone === 'green' ? 'var(--green-soft)' : 'var(--amber-soft)';

  return (
    <div className="rounded-lg border border-[#ddd7c7] bg-[#fbf8ef] p-4 dark:border-[#3d3a32] dark:bg-[#1f1d18]">
      <div className="flex items-center gap-2 text-sm font-bold" style={{ color }}>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background }}>
          {icon}
        </span>
        {title}
      </div>
      <p className="mt-3 text-sm leading-7" style={{ color: 'var(--muted)' }}>
        {text}
      </p>
    </div>
  );
}

function ProgressPill({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="rounded-full border border-[#ddd7c7] bg-[#fbf8ef] px-3 py-1 dark:border-[#3d3a32] dark:bg-[#1f1d18]">
      {label} {value}
    </span>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#ddd7c7] bg-[#fffdf8] p-4 dark:border-[#3d3a32] dark:bg-[#1f1d18]">
      <div className="text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}

function formatNextReview(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '稍后';
  return date.toLocaleString();
}

const studyModes: { mode: StudyMode; label: string }[] = [
  { mode: 'en_to_cn', label: '英译中' },
  { mode: 'cn_to_en', label: '中译英' },
  { mode: 'listening', label: '听音辨义' },
  { mode: 'spelling', label: '拼写' },
];
