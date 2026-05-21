import { ArrowRight, Search, Star, Trash2 } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { getFavoritesPaginated, unfavoriteWord } from '../api/favorites';
import { useAuth } from '../auth/AuthContext';
import { FavoriteButton } from '../components/FavoriteButton';
import { ListSkeleton } from '../components/ListSkeleton';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { StudyItem } from '../types';

const PAGE_SIZE = 16;

export function FavoritesPage() {
  const { token } = useAuth();
  const [items, setItems] = React.useState<StudyItem[]>([]);
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ text: string; tone: 'success' | 'error' | 'info' }>({ text: '', tone: 'success' });

  async function loadFavorites(nextPage = page, keyword = query) {
    setIsLoading(true);
    try {
      const result = await getFavoritesPaginated(token, nextPage, PAGE_SIZE, keyword.trim());
      setItems(result.items);
      setPage(result.page);
      setTotalPages(result.total_pages);
      setTotal(result.total);
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    loadFavorites(1, query);
  }, [token]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      loadFavorites(1, query);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [query, token]);

  async function removeFavorite(wordId: number) {
    try {
      await unfavoriteWord(token, wordId);
      setItems((current) => current.filter((item) => item.word.id !== wordId));
      setTotal((value) => Math.max(0, value - 1));
      setMessage({ text: '已取消收藏。', tone: 'success' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    }
  }

  return (
    <>
      <PageHeader
        title="收藏"
        description="把重要单词放在这里，后续可以集中复盘、测试和整理。"
        action={(
          <Link className="button-secondary" to="/quiz">
            去测试
            <ArrowRight size={16} />
          </Link>
        )}
      />
      <Message tone={message.tone}>{message.text}</Message>

      <section className="surface mb-5 rounded-lg p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <label className="relative block min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: 'var(--muted)' }} />
            <input
              className="input pl-10"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索收藏单词、释义、词性或例句"
              value={query}
            />
          </label>
          <span className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
            已收藏 {total} 个
          </span>
        </div>
      </section>

      <section className="grid gap-3">
        {isLoading && items.length === 0 && <ListSkeleton count={4} />}
        {!isLoading && items.length === 0 && (
          <div className="surface flex min-h-[300px] flex-col items-center justify-center rounded-lg p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#e6efdf] text-[#355e3b] dark:bg-[#1e2f1c] dark:text-[#7fb87a]">
              <Star size={28} />
            </div>
            <h2 className="mt-5 text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
              还没有收藏单词
            </h2>
            <p className="mt-2 max-w-xl leading-7" style={{ color: 'var(--muted)' }}>
              在背词卡片或词书详情里点击收藏，就能把重点单词集中到这里。
            </p>
            <Link className="button-primary mt-5" to="/study">
              去学习
              <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {items.map((item) => (
          <article className="surface rounded-lg p-4 sm:p-5" key={item.progress_id}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-words text-2xl font-semibold" style={{ color: 'var(--ink)' }}>{item.word.text}</h3>
                  {item.word.part_of_speech && (
                    <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'var(--panel)', color: 'var(--muted)' }}>
                      {item.word.part_of_speech}
                    </span>
                  )}
                  {item.is_leech && (
                    <span className="rounded-full bg-[#f4dddd] px-3 py-1 text-xs font-bold text-[#a13d3d]">重点难词</span>
                  )}
                </div>
                {item.word.phonetic && <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--green)' }}>{item.word.phonetic}</p>}
                <p className="mt-4 break-words text-xl" style={{ color: 'var(--ink)' }}>{item.word.meaning}</p>
                {(item.word.example_sentence || item.word.example_translation) && (
                  <div className="mt-4 rounded-lg p-4 text-sm leading-7" style={{ background: 'var(--panel)', color: 'var(--muted)' }}>
                    {item.word.example_sentence && <p>{item.word.example_sentence}</p>}
                    {item.word.example_translation && <p>{item.word.example_translation}</p>}
                  </div>
                )}
              </div>
              <div className="grid gap-2 sm:flex lg:grid">
                <FavoriteButton
                  wordId={item.word.id}
                  initialFavorite
                  onChange={(isFavorite) => {
                    if (!isFavorite) {
                      setItems((current) => current.filter((value) => value.word.id !== item.word.id));
                      setTotal((value) => Math.max(0, value - 1));
                    }
                  }}
                />
                <button className="button-secondary" onClick={() => removeFavorite(item.word.id)} type="button">
                  <Trash2 size={16} />
                  移除
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {items.length > 0 && totalPages > 1 && (
        <div className="mt-5 flex justify-center gap-2">
          <button className="button-secondary" disabled={page <= 1 || isLoading} onClick={() => loadFavorites(page - 1)} type="button">
            上一页
          </button>
          <span className="flex items-center px-3 text-sm font-bold" style={{ color: 'var(--muted)' }}>
            {page} / {totalPages}
          </span>
          <button className="button-secondary" disabled={page >= totalPages || isLoading} onClick={() => loadFavorites(page + 1)} type="button">
            下一页
          </button>
        </div>
      )}
    </>
  );
}
