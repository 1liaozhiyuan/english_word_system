import { BookOpen, CheckSquare, Download, FileUp, Plus, Search, Square, Trash2, Upload } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { deleteWordBook, getWordBookProgressPaginated, importWordBook, selectWordBook } from '../api/wordBooks';
import { useAuth } from '../auth/AuthContext';
import { ListSkeleton } from '../components/ListSkeleton';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { WordBookProgress } from '../types';

const PAGE_SIZE = 12;

type MessageState = {
  text: string;
  tone: 'success' | 'error' | 'info' | 'warning';
};

export function WordBooksPage() {
  const { token } = useAuth();
  const [books, setBooks] = React.useState<WordBookProgress[]>([]);
  const [message, setMessage] = React.useState<MessageState>({ text: '', tone: 'success' });
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalBooks, setTotalBooks] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = React.useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<number | null>(null);

  const loadedIds = books.map((book) => book.id);
  const selectedLoadedIds = loadedIds.filter((id) => selectedIds.has(id));
  const loadedSelectedCount = selectedLoadedIds.length;
  const allLoadedSelected = loadedIds.length > 0 && loadedIds.every((id) => selectedIds.has(id));
  const hasAnyProgress = books.some((book) => book.added_count > 0);

  async function loadBooks(nextPage = 1, append = false, keyword = query) {
    setIsLoading(true);
    try {
      const result = await getWordBookProgressPaginated(token, nextPage, PAGE_SIZE, keyword.trim());
      const nextBooks = append ? mergeBooks(books, result.items) : result.items;
      setBooks(nextBooks);
      setSelectedIds((current) => keepOnlyLoadedIds(current, nextBooks));
      setPage(result.page);
      setTotalPages(result.total_pages);
      setTotalBooks(result.total);
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    loadBooks(1, false);
  }, [token]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedIds(new Set());
      setDeleteConfirmId(null);
      setShowBatchDeleteConfirm(false);
      loadBooks(1, false, query);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [query, token]);

  async function handleSelect(id: number) {
    try {
      const data = await selectWordBook(token, id);
      setMessage({
        text: data.created > 0 ? `已加入 ${data.created} 个新单词。` : '这本词书已经在你的学习计划中。',
        tone: 'success',
      });
      await loadBooks(1, false);
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    }
  }

  async function handleImport(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setMessage({ text: '请选择一个 CSV 文件。', tone: 'warning' });
      return;
    }
    if (!title.trim()) {
      setMessage({ text: '请输入词书名称。', tone: 'warning' });
      return;
    }

    setIsImporting(true);
    try {
      const result = await importWordBook(token, { title, description, file });
      setMessage({ text: `导入成功：${result.title}，共 ${result.imported_count} 个单词。`, tone: 'success' });
      setTitle('');
      setDescription('');
      setFile(null);
      await loadBooks(1, false);
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsImporting(false);
    }
  }

  function handleDownloadTemplate() {
    const csv = [
      'word,phonetic,meaning,part_of_speech,example_sentence,example_translation,note',
      'abandon,/əˈbændən/,放弃,v.,He abandoned the plan.,他放弃了这个计划。,',
    ].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'word-book-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function toggleSelect(id: number) {
    setShowBatchDeleteConfirm(false);
    setDeleteConfirmId(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return keepOnlyLoadedIds(next, books);
    });
  }

  function toggleSelectAllLoaded() {
    setShowBatchDeleteConfirm(false);
    setDeleteConfirmId(null);
    setSelectedIds((current) => {
      const next = keepOnlyLoadedIds(current, books);
      if (allLoadedSelected) {
        loadedIds.forEach((id) => next.delete(id));
      } else {
        loadedIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function handleBatchDelete() {
    const idsToDelete = books.filter((book) => selectedIds.has(book.id)).map((book) => book.id);
    if (idsToDelete.length === 0) {
      setShowBatchDeleteConfirm(false);
      setMessage({ text: '没有可删除的已选词书，请重新选择。', tone: 'warning' });
      return;
    }

    setIsDeleting(true);
    try {
      const results = await Promise.allSettled(idsToDelete.map((id) => deleteWordBook(token, id)));
      const deleted = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.length - deleted;
      setSelectedIds(new Set());
      setShowBatchDeleteConfirm(false);
      setMessage({
        text: failed > 0 ? `已删除 ${deleted} 本词书，${failed} 本删除失败。` : `已删除 ${deleted} 本词书。`,
        tone: failed > 0 ? 'warning' : 'success',
      });
      await loadBooks(1, false);
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSingleDelete(book: WordBookProgress) {
    setIsDeleting(true);
    try {
      await deleteWordBook(token, book.id);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(book.id);
        return next;
      });
      setDeleteConfirmId(null);
      setMessage({ text: `已删除词书：${book.title}。`, tone: 'success' });
      await loadBooks(1, false);
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleLoadMore() {
    if (page >= totalPages || isLoading) return;
    await loadBooks(page + 1, true);
  }

  return (
    <>
      <PageHeader
        title="词书"
        description="选择词书或导入自己的 CSV 文件。词书较多时，页面会按需加载。"
      />
      <Message tone={message.tone}>{message.text}</Message>

      {!hasAnyProgress && books.length > 0 && (
        <section className="surface mb-5 rounded-lg p-5">
          <p className="text-sm font-bold text-[#355e3b]">第一次使用建议</p>
          <h3 className="mt-2 text-2xl font-semibold">先选择一本词书加入学习计划</h3>
          <p className="mt-2 leading-7" style={{ color: 'var(--muted)' }}>
            加入后，首页会生成今日任务，新词页会展示待学单词，复习页会根据你的答题结果安排后续复习。
          </p>
        </section>
      )}

      <section className="surface mb-5 rounded-lg p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#e6efdf] text-[#355e3b]">
              <FileUp size={22} />
            </div>
            <div>
              <h3 className="text-xl font-semibold">导入 CSV 词书</h3>
              <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                CSV 至少需要包含 word 和 meaning 两列，可选列：phonetic、part_of_speech、example_sentence、example_translation、note。
              </p>
            </div>
          </div>
          <button className="button-secondary" onClick={handleDownloadTemplate} type="button">
            <Download size={16} />
            下载模板
          </button>
        </div>

        <form className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]" onSubmit={handleImport}>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="词书名称，例如 CET-4 Unit 1"
          />
          <input
            className="input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="词书描述，可选"
          />
          <label className="button-secondary min-w-[150px]">
            <Upload size={16} />
            {file ? file.name : '选择 CSV'}
            <input
              className="hidden"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button className="button-primary lg:col-start-3" disabled={isImporting} type="submit">
            {isImporting ? '导入中...' : '导入词书'}
          </button>
        </form>
      </section>

      <section className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="relative block min-w-[260px] max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: 'var(--muted)' }} />
            <input
              className="input pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索词书名称或描述"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>
              已加载 {books.length} / {totalBooks}
            </span>
            <button className="button-secondary" disabled={books.length === 0 || isDeleting} onClick={toggleSelectAllLoaded} type="button">
              {allLoadedSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              {allLoadedSelected ? '取消已加载' : '选择已加载'}
            </button>
            <button
              className="button-secondary"
              disabled={loadedSelectedCount === 0 || isDeleting}
              onClick={() => setShowBatchDeleteConfirm((value) => !value)}
              type="button"
            >
              <Trash2 size={16} />
              删除选中 {loadedSelectedCount || ''}
            </button>
          </div>
        </div>

        {showBatchDeleteConfirm && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--red)', background: 'var(--red-soft)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--red)' }}>
              确认删除已选中的 {loadedSelectedCount} 本词书？这个操作无法撤销。
            </span>
            <div className="flex gap-2">
              <button className="button-secondary" disabled={isDeleting} onClick={() => setShowBatchDeleteConfirm(false)} type="button">
                取消
              </button>
              <button className="button-danger" disabled={isDeleting || loadedSelectedCount === 0} onClick={handleBatchDelete} type="button">
                {isDeleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {books.length === 0 && isLoading && <ListSkeleton count={4} />}

        {books.map((book) => (
          <article className="surface rounded-lg p-5 transition hover:-translate-y-0.5 hover:border-[#b9ad95]" key={book.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  aria-label={selectedIds.has(book.id) ? '取消选择词书' : '选择词书'}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border"
                  disabled={isDeleting}
                  onClick={() => toggleSelect(book.id)}
                  style={{ borderColor: 'var(--line)', color: selectedIds.has(book.id) ? 'var(--green)' : 'var(--muted)' }}
                  type="button"
                >
                  {selectedIds.has(book.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#e6efdf] text-[#355e3b]">
                  <BookOpen size={22} />
                </div>
              </div>
              <span className="rounded-full bg-[#fbf8ef] px-3 py-1 text-sm font-bold text-[#6b6a62] dark:bg-[#1f1d18] dark:text-[#9a978d]">
                {book.word_count} words
              </span>
            </div>

            <h3 className="mt-5 text-xl font-semibold">{book.title}</h3>
            <p className="mt-2 min-h-10 text-sm leading-6" style={{ color: 'var(--muted)' }}>{book.description}</p>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                <span>完成率</span>
                <span>{book.completion_rate}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#eee8d8] dark:bg-[#3d3a32]">
                <div className="h-full rounded-full bg-[#355e3b] dark:bg-[#7fb87a]" style={{ width: `${book.completion_rate}%` }} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Metric label="已加入" value={book.added_count} />
              <Metric label="已学习" value={book.studied_count} />
              <Metric label="已掌握" value={book.mastered_count} />
              <Metric label="错词" value={book.mistake_count} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link className="button-secondary" to={`/word-books/${book.id}`}>
                查看详情
              </Link>
              <button className="button-primary" disabled={isDeleting} onClick={() => handleSelect(book.id)} type="button">
                <Plus size={16} />
                {book.added_count > 0 ? '继续学习' : '加入学习'}
              </button>
              {deleteConfirmId === book.id ? (
                <>
                  <button className="button-danger" disabled={isDeleting} onClick={() => handleSingleDelete(book)} type="button">
                    <Trash2 size={16} />
                    {isDeleting ? '删除中...' : '确认删除'}
                  </button>
                  <button className="button-secondary" disabled={isDeleting} onClick={() => setDeleteConfirmId(null)} type="button">
                    取消
                  </button>
                </>
              ) : (
                <button className="button-secondary" disabled={isDeleting} onClick={() => setDeleteConfirmId(book.id)} style={{ color: 'var(--red)' }} type="button">
                  <Trash2 size={16} />
                  删除
                </button>
              )}
            </div>
          </article>
        ))}

        {books.length === 0 && !isLoading && (
          <div className="surface rounded-lg p-5 text-sm" style={{ color: 'var(--muted)' }}>
            没有找到匹配的词书。
          </div>
        )}
      </section>

      {books.length > 0 && page < totalPages && (
        <div className="mt-5 flex justify-center">
          <button className="button-secondary" disabled={isLoading || isDeleting} onClick={handleLoadMore} type="button">
            {isLoading ? '加载中...' : `加载更多（${page}/${totalPages}）`}
          </button>
        </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--panel)' }}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}

function mergeBooks(current: WordBookProgress[], incoming: WordBookProgress[]) {
  const byId = new Map<number, WordBookProgress>();
  [...current, ...incoming].forEach((book) => byId.set(book.id, book));
  return [...byId.values()];
}

function keepOnlyLoadedIds(selected: Set<number>, books: WordBookProgress[]) {
  const loadedIds = new Set(books.map((book) => book.id));
  return new Set([...selected].filter((id) => loadedIds.has(id)));
}
