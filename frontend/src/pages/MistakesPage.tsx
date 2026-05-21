import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, CheckSquare, Clock3, RotateCcw, Search, Sparkles, Square, Target, Trash2 } from 'lucide-react';
import { analyzeMistakes } from '../api/ai';
import { getErrorMessage } from '../api/client';
import { getMistakesPaginated, practiceMistake, practiceMistakesBatch, resolveMistake } from '../api/study';
import { useAuth } from '../auth/AuthContext';
import { AIResultPanel } from '../components/AIResultPanel';
import { ListSkeleton } from '../components/ListSkeleton';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { StudyItem } from '../types';

const PAGE_SIZE = 12;

export function MistakesPage() {
  const { token } = useAuth();
  const [mistakes, setMistakes] = React.useState<StudyItem[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [scheduledIds, setScheduledIds] = React.useState<Set<number>>(new Set());
  const [message, setMessage] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isMutating, setIsMutating] = React.useState(false);
  const [aiAnalysis, setAiAnalysis] = React.useState('');
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const aiAbortRef = React.useRef<AbortController | null>(null);

  const visibleWordIds = mistakes.map((item) => item.word.id);
  const selectedVisibleIds = visibleWordIds.filter((id) => selectedIds.has(id));
  const allVisibleSelected = visibleWordIds.length > 0 && visibleWordIds.every((id) => selectedIds.has(id));
  const leechCount = mistakes.filter((item) => item.is_leech).length;
  const highRiskCount = mistakes.filter((item) => getMistakeRisk(item) === 'high').length;

  async function loadMistakes(nextPage = 1, append = false, keyword = query) {
    setIsLoading(true);
    try {
      const result = await getMistakesPaginated(token, nextPage, PAGE_SIZE, keyword.trim());
      const nextItems = append ? mergeMistakes(mistakes, result.items) : result.items;
      setMistakes(nextItems);
      setSelectedIds((current) => keepOnlyVisibleIds(current, nextItems));
      setPage(result.page);
      setTotalPages(result.total_pages);
      setTotal(result.total);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePractice(wordId: number) {
    setIsMutating(true);
    try {
      await practiceMistake(token, wordId);
      setScheduledIds((ids) => new Set([...ids, wordId]));
      setMessage('已安排重练，这个单词会出现在今日复习中。');
      await loadMistakes(1, false);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleBatchPractice() {
    if (selectedVisibleIds.length === 0) {
      setMessage('请先选择要重练的错词。');
      return;
    }

    setIsMutating(true);
    try {
      const result = await practiceMistakesBatch(token, selectedVisibleIds);
      setScheduledIds((ids) => new Set([...ids, ...selectedVisibleIds]));
      setSelectedIds(new Set());
      setMessage(`已安排 ${result.scheduled} 个错词重练。`);
      await loadMistakes(1, false);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleResolve(wordId: number) {
    setIsMutating(true);
    try {
      await resolveMistake(token, wordId);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(wordId);
        return next;
      });
      setMessage('已移出错词本。之后如果再次答错，它还会重新进入错词本。');
      await loadMistakes(1, false);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleAnalyzeMistakes() {
    const words = mistakes.slice(0, 20).map((item) => item.word);
    if (words.length === 0) return;

    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setIsAiLoading(true);
    setAiAnalysis('');
    try {
      setAiAnalysis(await analyzeMistakes(token, words, setAiAnalysis, { signal: controller.signal }));
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setAiAnalysis(getErrorMessage(error));
      }
    } finally {
      setIsAiLoading(false);
      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null;
      }
    }
  }

  function stopAI() {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setIsAiLoading(false);
  }

  function toggleSelect(wordId: number) {
    setSelectedIds((current) => {
      const next = keepOnlyVisibleIds(current, mistakes);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((current) => {
      const next = keepOnlyVisibleIds(current, mistakes);
      if (allVisibleSelected) {
        visibleWordIds.forEach((id) => next.delete(id));
      } else {
        visibleWordIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function handleLoadMore() {
    if (page >= totalPages || isLoading) return;
    await loadMistakes(page + 1, true);
  }

  React.useEffect(() => {
    loadMistakes(1, false);
  }, [token]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMistakes(1, false, query);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [query, token]);

  return (
    <>
      <PageHeader
        title="错词本"
        description="集中处理反复出错的单词。先筛选高风险错词，再安排重练或移出错词本。"
        action={
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" disabled={mistakes.length === 0 || isAiLoading} onClick={handleAnalyzeMistakes} type="button">
              <Sparkles size={16} />
              AI 分析错词
            </button>
            {scheduledIds.size > 0 && (
              <Link className="button-primary" to="/review">
                去复习
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        }
      />
      <Message>{message}</Message>
      <AIResultPanel title="AI 错词分析" content={aiAnalysis} isLoading={isAiLoading} onStop={stopAI} />

      <section className="surface mb-5 rounded-lg p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(260px,420px)] lg:items-center">
          <div className="grid gap-3 sm:grid-cols-4">
            <MiniStat label="错词总数" value={total} />
            <MiniStat label="已加载" value={mistakes.length} />
            <MiniStat label="重点难词" value={leechCount} />
            <MiniStat label="高风险" value={highRiskCount} />
          </div>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6a62]" size={18} />
            <input
              className="input pl-10"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索错词或释义"
              value={query}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
          <div className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>
            已选择 {selectedVisibleIds.length} 个当前已加载错词
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" disabled={mistakes.length === 0 || isMutating} onClick={toggleSelectAllVisible} type="button">
              {allVisibleSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              {allVisibleSelected ? '取消已加载' : '选择已加载'}
            </button>
            <button className="button-primary" disabled={selectedVisibleIds.length === 0 || isMutating} onClick={handleBatchPractice} type="button">
              <RotateCcw size={16} />
              批量重练
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {mistakes.length === 0 && isLoading && <ListSkeleton count={4} />}
        {mistakes.length === 0 && !isLoading && (
          <div className="surface rounded-lg p-5 text-sm" style={{ color: 'var(--muted)' }}>
            暂无错词。继续保持，现在的学习状态很干净。
          </div>
        )}

        {mistakes.map((item) => {
          const scheduled = scheduledIds.has(item.word.id);
          const selected = selectedIds.has(item.word.id);
          const risk = getMistakeRisk(item);

          return (
            <article className="surface rounded-lg p-5 transition hover:-translate-y-0.5" key={item.progress_id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    aria-label={selected ? '取消选择错词' : '选择错词'}
                    className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg border"
                    disabled={isMutating}
                    onClick={() => toggleSelect(item.word.id)}
                    style={{ borderColor: 'var(--line)', color: selected ? 'var(--green)' : 'var(--muted)' }}
                    type="button"
                  >
                    {selected ? <CheckSquare size={20} /> : <Square size={20} />}
                  </button>
                  <div className="min-w-0">
                    <div className="break-words text-2xl font-semibold" style={{ color: 'var(--ink)' }}>{item.word.text}</div>
                    {item.word.phonetic && <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--green)' }}>{item.word.phonetic}</div>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {item.is_leech && <Badge tone="red">重点难词</Badge>}
                  <Badge tone={risk === 'high' ? 'red' : risk === 'medium' ? 'amber' : 'green'}>
                    {riskLabel[risk]}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 text-xl" style={{ color: 'var(--ink)' }}>{item.word.meaning}</div>
              {item.word.part_of_speech && (
                <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--muted)' }}>{item.word.part_of_speech}</div>
              )}

              <div className="mt-4 rounded-lg p-4 text-sm leading-6" style={{ background: 'var(--panel)', color: 'var(--muted)' }}>
                <p>{item.word.example_sentence || '暂无例句'}</p>
                {item.word.example_translation && <p className="mt-2">{item.word.example_translation}</p>}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <MistakeMetric label="错误次数" value={item.wrong_count} tone="red" />
                <MistakeMetric label="正确次数" value={item.correct_count} tone="green" />
                <MistakeMetric label="掌握度" value={item.mastery_level} />
              </div>

              <div className="mt-4 grid gap-2 text-sm" style={{ color: 'var(--muted)' }}>
                <div className="flex items-center gap-2">
                  <Clock3 size={16} />
                  间隔 {formatInterval(item.interval_days)}，下次复习 {formatDate(item.next_review_at)}
                </div>
                <div className="flex items-center gap-2">
                  <Target size={16} />
                  {getReviewAdvice(item)}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <button
                  className={scheduled ? 'button-secondary' : 'button-primary'}
                  disabled={scheduled || isMutating}
                  onClick={() => handlePractice(item.word.id)}
                  type="button"
                >
                  <RotateCcw size={16} />
                  {scheduled ? '已安排' : '安排重练'}
                </button>
                <button
                  className="button-secondary"
                  disabled={isMutating}
                  onClick={() => handleResolve(item.word.id)}
                  style={{ color: 'var(--red)' }}
                  type="button"
                >
                  <Trash2 size={16} />
                  移出错词本
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {mistakes.length > 0 && page < totalPages && (
        <div className="mt-5 flex justify-center">
          <button className="button-secondary" disabled={isLoading} onClick={handleLoadMore} type="button">
            {isLoading ? '加载中...' : `加载更多（${page}/${totalPages}）`}
          </button>
        </div>
      )}
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-4 py-3" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>{value}</div>
      <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}

function MistakeMetric({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'red' | 'green' }) {
  const color = tone === 'red' ? 'var(--red)' : tone === 'green' ? 'var(--green)' : 'var(--ink)';
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="text-lg font-semibold" style={{ color }}>{value}</div>
      <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'red' | 'amber' | 'green' }) {
  const color = tone === 'red' ? 'var(--red)' : tone === 'amber' ? 'var(--amber)' : 'var(--green)';
  const background = tone === 'red' ? 'var(--red-soft)' : tone === 'amber' ? 'var(--amber-soft)' : 'var(--green-soft)';
  return (
    <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ color, background }}>
      {children}
    </span>
  );
}

function getMistakeRisk(item: StudyItem): 'low' | 'medium' | 'high' {
  if (item.is_leech || item.wrong_count >= 5) return 'high';
  if (item.wrong_count >= 3 || item.mastery_level <= 1) return 'medium';
  return 'low';
}

const riskLabel = {
  low: '轻度错词',
  medium: '需要复盘',
  high: '高风险',
};

function getReviewAdvice(item: StudyItem) {
  const risk = getMistakeRisk(item);
  if (risk === 'high') return '建议先安排重练，再看例句和 AI 分析，避免继续累积错误记忆。';
  if (risk === 'medium') return '建议今天复盘一次，重点确认释义和拼写是否混淆。';
  return '偶发错误，可以快速过一遍，确认已经能稳定回忆。';
}

function formatInterval(value: number) {
  if (!value) return '未开始';
  if (value < 1) return `${Math.round(value * 24 * 60)} 分钟`;
  if (value < 30) return `${Math.round(value)} 天`;
  return `${Math.round(value / 30)} 个月`;
}

function formatDate(value: string | null) {
  if (!value) return '暂未安排';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂未安排';
  return date.toLocaleString();
}

function mergeMistakes(current: StudyItem[], incoming: StudyItem[]) {
  const byId = new Map<number, StudyItem>();
  [...current, ...incoming].forEach((item) => byId.set(item.progress_id, item));
  return [...byId.values()];
}

function keepOnlyVisibleIds(selected: Set<number>, items: StudyItem[]) {
  const visibleIds = new Set(items.map((item) => item.word.id));
  return new Set([...selected].filter((id) => visibleIds.has(id)));
}
