import React from 'react';
import { BookOpenText, CheckCircle2, Volume2 } from 'lucide-react';
import { completeReadingArticle, getReadingArticles } from '../api/reading';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { ReadingArticle } from '../types';

export function ReadingPage() {
  const { token } = useAuth();
  const [articles, setArticles] = React.useState<ReadingArticle[]>([]);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [message, setMessage] = React.useState<{ text: string; tone: 'success' | 'error' | 'info' }>({ text: '', tone: 'info' });
  const [isLoading, setIsLoading] = React.useState(true);
  const startedAtRef = React.useRef(Date.now());

  const selected = articles.find((item) => item.id === selectedId) ?? articles[0];

  async function loadArticles() {
    setIsLoading(true);
    try {
      const next = await getReadingArticles(token);
      setArticles(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
      startedAtRef.current = Date.now();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  function playArticle() {
    const text = selected?.audio_text || selected?.content;
    if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.86;
    window.speechSynthesis.speak(utterance);
  }

  async function markComplete() {
    if (!selected) return;
    try {
      const seconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      await completeReadingArticle(token, selected.id, seconds);
      setArticles((items) => items.map((item) => (item.id === selected.id ? { ...item, completed: true } : item)));
      setMessage({ text: '阅读记录已保存。', tone: 'success' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    }
  }

  React.useEffect(() => {
    loadArticles();
  }, [token]);

  React.useEffect(() => {
    startedAtRef.current = Date.now();
  }, [selectedId]);

  return (
    <>
      <PageHeader title="阅读训练" description="分级文章来自数据库，系统会标记你词库中已学习过的词，并记录阅读完成情况。" />
      <Message tone={message.tone}>{message.text}</Message>

      {isLoading && <section className="surface rounded-lg p-5 text-sm" style={{ color: 'var(--muted)' }}>正在加载阅读材料...</section>}

      {!isLoading && selected && (
        <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="surface rounded-lg p-4">
            <h2 className="text-xl font-semibold">文章列表</h2>
            <div className="mt-4 grid gap-2">
              {articles.map((article) => (
                <button
                  className="rounded-lg border p-3 text-left"
                  key={article.id}
                  onClick={() => setSelectedId(article.id)}
                  style={{
                    borderColor: selected.id === article.id ? 'var(--green)' : 'var(--line)',
                    background: selected.id === article.id ? 'var(--green-soft)' : 'var(--paper)',
                  }}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong>{article.title}</strong>
                    {article.completed && <CheckCircle2 size={16} style={{ color: 'var(--green)' }} />}
                  </div>
                  <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{article.category} · {article.level}</p>
                </button>
              ))}
            </div>
          </aside>

          <article className="surface rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2" style={{ color: 'var(--green)' }}>
                  <BookOpenText size={20} />
                  <span className="text-sm font-semibold">{selected.category} · {selected.level}</span>
                </div>
                <h1 className="mt-2 text-3xl font-semibold">{selected.title}</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="button-secondary" onClick={playArticle} type="button"><Volume2 size={16} />播放</button>
                <button className="button-primary" onClick={markComplete} type="button">标记完成</button>
              </div>
            </div>

            <p className="mt-6 whitespace-pre-wrap text-lg leading-9">{selected.content}</p>
            {selected.translation && (
              <p className="mt-5 rounded-lg border p-4 text-sm leading-7" style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--muted)' }}>
                {selected.translation}
              </p>
            )}

            <section className="mt-6">
              <h3 className="text-xl font-semibold">已学词高亮</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.known_words.map((word) => (
                  <span className="chip" key={word.word_id}>{word.text} · {word.meaning} · {word.mastery_level}</span>
                ))}
                {selected.known_words.length === 0 && <span className="text-sm" style={{ color: 'var(--muted)' }}>这篇文章暂未匹配到你的已学词。</span>}
              </div>
            </section>
          </article>
        </section>
      )}
    </>
  );
}
