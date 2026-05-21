import { AlertTriangle, ArrowRight, CheckCircle2, Home, Library, RotateCcw, Settings, Target, TimerReset } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { getSettings } from '../api/settings';
import { submitAnswer } from '../api/study';
import { useAuth } from '../auth/AuthContext';
import { Message } from './Message';
import { LoadingState } from './LoadingState';
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
  const [autoRevealAfterAudio, setAutoRevealAfterAudio] = React.useState(false);
  const [autoAdvance, setAutoAdvance] = React.useState(true);
  const [answerDelayMs, setAnswerDelayMs] = React.useState(800);
  const [pendingItems, setPendingItems] = React.useState<StudyItem[] | null>(null);
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isWaitingNext, setIsWaitingNext] = React.useState(false);

  const current = items[0];
  const total = Math.max(initialTotal, answered + items.length);
  const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
  const liveAccuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const isComplete = answered > 0 && items.length === 0;
  const completionStats = getCompletionStats(answered, correct, wrongWords.length);
  const recommendedAction = getRecommendedAction({ wrongCount: wrongWords.length, correctCount: correct, answered, nextAction });

  async function refresh(resetSession = false, nextBatchSize = batchSize) {
    setIsLoading(true);
    try {
      const nextItems = await loadItems(token, nextBatchSize);
      setItems(nextItems);
      if (resetSession || initialTotal === 0) {
        setInitialTotal(nextItems.length);
        setAnswered(0);
        setCorrect(0);
        setWrongWords([]);
        setLastResult(null);
        setPendingItems(null);
        setIsWaitingNext(false);
      }
      if (resetSession) setMessage({ text: '学习任务已重新加载。', tone: 'info' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
      if (resetSession) {
        setItems([]);
        setInitialTotal(0);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAnswer(quality: number) {
    if (isSubmitting || !current) return;

    setIsSubmitting(true);
    try {
      const result = await submitAnswer(
        token,
        current.word.id,
        quality,
        studyMode,
        current.word_book_id ?? undefined,
      );
      const isCorrect = quality > 0;
      setAnswered((value) => value + 1);
      setCorrect((value) => value + (isCorrect ? 1 : 0));
      if (!isCorrect) {
        setWrongWords((value) => addUniqueWord(value, current.word));
      }
      setLastResult({ quality, result });

      const leechText = result.is_leech ? ' 已标记为重点难词。' : '';
      setMessage({
        text: `已记录：${answerText[quality]}。下次复习：${formatNextReview(result.next_review_at)}。${leechText}`,
        tone: isCorrect ? 'success' : 'info',
      });

      const answeredNext = answered + 1;
      const sessionLimit = Math.max(1, initialTotal || batchSize);
      const remainingLimit = Math.max(0, sessionLimit - answeredNext);
      const nextItems = remainingLimit > 0 ? await loadItems(token, remainingLimit) : [];
      if (initialTotal === 0) {
        setInitialTotal(Math.max(1, nextItems.length + 1));
      }

      if (autoAdvance) {
        await wait(answerDelayMs);
        setItems(nextItems);
      } else {
        setPendingItems(nextItems);
        setIsWaitingNext(true);
      }
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function continueToNext() {
    if (!pendingItems) return;
    setItems(pendingItems);
    setPendingItems(null);
    setIsWaitingNext(false);
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
        setAutoRevealAfterAudio(settings.auto_reveal_after_audio);
        setAutoAdvance(settings.auto_advance);
        setAnswerDelayMs(settings.answer_delay_ms);
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));
  }, [token]);

  React.useEffect(() => {
    if (settingsLoaded) refresh(true, defaultBatchSize);
  }, [settingsLoaded, token, defaultBatchSize]);

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={(
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            <Link className="button-secondary" to="/dashboard">
              <Home size={16} />
              首页
            </Link>
            <Link className="button-secondary" to="/word-books">
              <Library size={16} />
              词库
            </Link>
            <Link className="button-secondary" to="/learning-settings">
              <Settings size={16} />
              学习设置
            </Link>
            <Link className="button-secondary" to={nextAction.to}>
              <ArrowRight size={16} />
              {nextAction.label}
            </Link>
            <button className="button-secondary" disabled={isLoading || isSubmitting || isComplete} onClick={() => refresh(true)} type="button">
              <RotateCcw size={16} />
              {isLoading ? '加载中...' : isComplete ? '今日已完成' : '重新加载'}
            </button>
          </div>
        )}
      />
      <Message tone={message.tone}>{message.text}</Message>

      {isLoading && !current && <LoadingState text="正在加载学习任务..." />}

      {!isLoading && current && (
        <>
          <section className="surface mb-5 rounded-lg p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              <div>
                <div className="text-sm font-bold text-[#355e3b]">本轮进度</div>
                <div className="mt-1 text-2xl font-semibold">
                  {answered + 1} / {total}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm font-semibold sm:flex sm:flex-wrap sm:justify-end" style={{ color: 'var(--muted)' }}>
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
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
                <TimerReset size={16} />
                上一题：{answerText[lastResult.quality]}，下次复习 {formatNextReview(lastResult.result.next_review_at)}
                {lastResult.result.is_leech ? '，重点难词' : ''}
              </div>
            )}
          </section>

          <WordCard
            item={current}
            studyMode={studyMode}
            autoPlayWord={autoPlayWord}
            autoPlayExample={autoPlayExample}
            autoRevealAfterAudio={autoRevealAfterAudio}
            isSubmitting={isSubmitting}
            isWaitingNext={isWaitingNext}
            onAnswer={handleAnswer}
            onContinue={continueToNext}
          />
        </>
      )}

      {!isLoading && isComplete && (
        <section className="surface rounded-lg p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_220px] lg:items-start">
            <div>
              <p className="text-sm font-bold text-[#355e3b]">本轮完成</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">{completionTitle}</h2>
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

          <div className="mt-6 grid gap-2 sm:flex sm:flex-wrap">
            <Link className="button-primary" to="/learning-settings">
              调整学习数量
            </Link>
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

      {!isLoading && !current && !isComplete && (
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

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function addUniqueWord(words: Word[], word: Word) {
  if (words.some((item) => item.id === word.id)) return words;
  return [...words, word];
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
      mistakeAdvice: '错词数量不多，可以在错词本里安排重练，重点看释义、词性和例句。',
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
    <span className="min-w-0 rounded-full border border-[#ddd7c7] bg-[#fbf8ef] px-3 py-1 text-center dark:border-[#3d3a32] dark:bg-[#1f1d18]">
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
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes <= 1) return '很快';
  if (diffMinutes < 60) return `${diffMinutes} 分钟后`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时后`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} 天后`;
}
