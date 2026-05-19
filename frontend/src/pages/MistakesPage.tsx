import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, Sparkles } from 'lucide-react';
import { analyzeMistakes } from '../api/ai';
import { getErrorMessage } from '../api/client';
import { getMistakesPaginated, practiceMistake } from '../api/study';
import { useAuth } from '../auth/AuthContext';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import { AIResultPanel } from '../components/AIResultPanel';
import { ListSkeleton } from '../components/ListSkeleton';
import type { StudyItem } from '../types';

const PAGE_SIZE = 12;

export function MistakesPage() {
  const { token } = useAuth();
  const [mistakes, setMistakes] = React.useState<StudyItem[]>([]);
  const [scheduledIds, setScheduledIds] = React.useState<number[]>([]);
  const [message, setMessage] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [aiAnalysis, setAiAnalysis] = React.useState('');
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const aiAbortRef = React.useRef<AbortController | null>(null);

  async function loadMistakes(nextPage = 1, append = false, keyword = query) {
    setIsLoading(true);
    try {
      const result = await getMistakesPaginated(token, nextPage, PAGE_SIZE, keyword.trim());
      setMistakes((current) => (append ? [...current, ...result.items] : result.items));
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
    try {
      await practiceMistake(token, wordId);
      setScheduledIds((ids) => [...new Set([...ids, wordId])]);
      setMessage('已安排重练，将出现在今日复习中。');
      await loadMistakes(1, false);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleAnalyzeMistakes() {
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setIsAiLoading(true);
    setAiAnalysis('');
    try {
      setAiAnalysis(await analyzeMistakes(token, mistakes.map((item) => item.word), setAiAnalysis, { signal: controller.signal }));
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

  const leechCount = mistakes.filter((item) => item.is_leech).length;

  return (
    <>
      <PageHeader
        title="错词本"
        description="集中处理反复出错的单词。列表会按需加载，错词很多时也不会一次性拖慢页面。"
        action={
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" disabled={mistakes.length === 0 || isAiLoading} onClick={handleAnalyzeMistakes}>
              <Sparkles size={16} />
              AI 分析错词
            </button>
            {scheduledIds.length > 0 && (
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat label="错词总数" value={total} />
            <MiniStat label="已加载" value={mistakes.length} />
            <MiniStat label="重点难词" value={leechCount} />
          </div>
          <label className="relative block min-w-[260px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6a62]" size={18} />
            <input
              className="input pl-10"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索错词或释义"
              value={query}
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {mistakes.length === 0 && isLoading && <ListSkeleton count={4} />}
        {mistakes.length === 0 && !isLoading && (
          <div className="surface rounded-lg p-5 text-sm" style={{ color: 'var(--muted)' }}>
            暂无错词。继续保持。
          </div>
        )}
        {mistakes.map((item) => {
          const scheduled = scheduledIds.includes(item.word.id);
          return (
            <div className="surface rounded-lg p-5 transition hover:-translate-y-0.5" key={item.progress_id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>{item.word.text}</div>
                  <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--green)' }}>{item.word.phonetic}</div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {item.is_leech && (
                    <span className="rounded-full bg-[#f4dddd] px-3 py-1 text-xs font-bold text-[#a13d3d] dark:bg-[#2e1b1b] dark:text-[#d47373]">
                      重点难词
                    </span>
                  )}
                  <span className="rounded-full bg-[#f4dddd] px-3 py-1 text-xs font-bold text-[#a13d3d] dark:bg-[#2e1b1b] dark:text-[#d47373]">
                    错词
                  </span>
                </div>
              </div>
              <div className="mt-4 text-xl" style={{ color: 'var(--ink)' }}>{item.word.meaning}</div>
              <div className="mt-4 rounded-lg p-4 text-sm leading-6" style={{ background: 'var(--panel)', color: 'var(--muted)' }}>
                <p>{item.word.example_sentence || '暂无例句'}</p>
                {item.word.example_translation && <p className="mt-2">{item.word.example_translation}</p>}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>
                  掌握度 {item.mastery_level} · 间隔 {formatInterval(item.interval_days)}
                </span>
                <button
                  className={scheduled ? 'button-secondary' : 'button-primary'}
                  disabled={scheduled}
                  onClick={() => handlePractice(item.word.id)}
                >
                  {scheduled ? '已安排' : '安排重练'}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {mistakes.length > 0 && page < totalPages && (
        <div className="mt-5 flex justify-center">
          <button className="button-secondary" disabled={isLoading} onClick={handleLoadMore}>
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

function formatInterval(value: number) {
  if (!value) return '未开始';
  if (value < 1) return `${Math.round(value * 24 * 60)} 分钟`;
  if (value < 30) return `${Math.round(value)} 天`;
  return `${Math.round(value / 30)} 个月`;
}
