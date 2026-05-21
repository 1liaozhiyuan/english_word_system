import { AlertTriangle, BookOpen, CheckCircle2, CheckSquare, Download, FileUp, Plus, Search, Square, Trash2, Upload } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { deleteWordBook, getWordBookProgressPaginated, importWordBook, previewWordBookImport, selectWordBook } from '../api/wordBooks';
import { useAuth } from '../auth/AuthContext';
import { ListSkeleton } from '../components/ListSkeleton';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { WordBookImportPreview, WordBookProgress } from '../types';

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
  const [category, setCategory] = React.useState('通用');
  const [difficulty, setDifficulty] = React.useState('标准');
  const [query, setQuery] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<WordBookImportPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = React.useState(false);
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
  const cannotImport = isImporting || isPreviewing || !file || Boolean(preview && preview.error_count > 0);

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

  async function runPreview(nextFile: File) {
    if (!nextFile.name.toLowerCase().endsWith('.csv')) {
      setPreview(null);
      setMessage({ text: '请选择 CSV 文件。', tone: 'warning' });
      return null;
    }

    setIsPreviewing(true);
    try {
      const result = await previewWordBookImport(token, nextFile);
      setPreview(result);
      if (result.error_count > 0) {
        setMessage({ text: `发现 ${result.error_count} 行数据有问题，请先修正后再导入。`, tone: 'warning' });
      } else if (result.duplicate_in_file_count > 0 || result.duplicate_in_database_count > 0) {
        setMessage({ text: '预览完成，但存在重复单词。你仍然可以导入，也可以先整理 CSV。', tone: 'info' });
      } else {
        setMessage({ text: `预览完成，可导入 ${result.valid_count} 个单词。`, tone: 'success' });
      }
      return result;
    } catch (error) {
      setPreview(null);
      setMessage({ text: getErrorMessage(error), tone: 'error' });
      return null;
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setPreview(null);
    if (nextFile) {
      await runPreview(nextFile);
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

    const nextPreview = preview ?? (await runPreview(file));
    if (!nextPreview) return;
    if (nextPreview.error_count > 0) {
      setMessage({ text: 'CSV 中仍有错误行，修正后再导入。', tone: 'warning' });
      return;
    }
    if (nextPreview.valid_count === 0) {
      setMessage({ text: 'CSV 中没有可导入的单词。', tone: 'warning' });
      return;
    }

    setIsImporting(true);
    try {
      const result = await importWordBook(token, { title, description, category, difficulty, file });
      const skippedText = result.skipped_count > 0 ? `，已跳过 ${result.skipped_count} 个重复词` : '';
      setMessage({ text: `导入成功：${result.title}，共导入 ${result.imported_count} 个单词${skippedText}。`, tone: 'success' });
      setTitle('');
      setDescription('');
      setCategory('通用');
      setDifficulty('标准');
      setFile(null);
      setPreview(null);
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
      'abandon,/əˈbændən/,放弃,v.,He abandoned the plan.,他放弃了这个计划。,高频动词',
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
      const next = keepOnlyLoadedIds(current, books);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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
    const idsToDelete = selectedLoadedIds;
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
        description="选择系统词书，或导入自己的 CSV 词表。词书较多时，页面会按需加载，避免一次加载过多内容。"
      />
      <Message tone={message.tone}>{message.text}</Message>

      {!hasAnyProgress && books.length > 0 && (
        <section className="surface mb-5 rounded-lg p-5">
          <p className="text-sm font-bold text-[#355e3b]">第一次使用建议</p>
          <h3 className="mt-2 text-2xl font-semibold">先选择一本词书加入学习计划</h3>
          <p className="mt-2 leading-7" style={{ color: 'var(--muted)' }}>
            加入后，首页会生成今日任务，学习页会展示待学单词，复习页会根据你的答题结果安排后续复习。
          </p>
        </section>
      )}

      <section className="surface mb-5 rounded-lg p-4 sm:p-5">
        <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#e6efdf] text-[#355e3b]">
              <FileUp size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-semibold">导入 CSV 词书</h3>
              <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                CSV 至少需要包含 word 和 meaning 两列。选择文件后会先预览并提示错误行，确认无误后再写入数据库。
              </p>
            </div>
          </div>
          <button className="button-secondary w-full sm:w-auto" onClick={handleDownloadTemplate} type="button">
            <Download size={16} />
            下载模板
          </button>
        </div>

        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_160px_auto]" onSubmit={handleImport}>
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
          <input
            className="input"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="分类，例如 CET-4"
          />
          <select className="input" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            <option value="入门">入门</option>
            <option value="标准">标准</option>
            <option value="进阶">进阶</option>
            <option value="考试">考试</option>
          </select>
          <label className="button-secondary min-w-0 cursor-pointer justify-start lg:min-w-[150px]">
            <Upload className="shrink-0" size={16} />
            <span className="truncate">{file ? file.name : '选择 CSV'}</span>
            <input
              className="hidden"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
          <button className="button-primary lg:col-start-5" disabled={cannotImport} type="submit">
            {isPreviewing ? '预览中...' : isImporting ? '导入中...' : preview ? '确认导入' : '先预览再导入'}
          </button>
        </form>

        {preview && <ImportPreviewPanel preview={preview} />}
      </section>

      <section className="mb-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <label className="relative block min-w-0 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: 'var(--muted)' }} />
            <input
              className="input pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索词书名称、描述、分类或难度"
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-[auto_auto_auto] sm:items-center">
            <span className="text-sm font-semibold sm:pr-2" style={{ color: 'var(--muted)' }}>
              已加载 {books.length} / {totalBooks}
            </span>
            <button className="button-secondary w-full sm:w-auto" disabled={books.length === 0 || isDeleting} onClick={toggleSelectAllLoaded} type="button">
              {allLoadedSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              {allLoadedSelected ? '取消已加载' : '选择已加载'}
            </button>
            <button
              className="button-secondary w-full sm:w-auto"
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
          <div className="mt-3 grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" style={{ borderColor: 'var(--red)', background: 'var(--red-soft)' }}>
            <span className="text-sm font-semibold leading-6" style={{ color: 'var(--red)' }}>
              确认删除已选中的 {loadedSelectedCount} 本词书？这个操作无法撤销。
            </span>
            <div className="grid grid-cols-2 gap-2 sm:flex">
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
          <article className="surface min-w-0 rounded-lg p-4 transition hover:-translate-y-0.5 hover:border-[#b9ad95] sm:p-5" key={book.id}>
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
              <span className="shrink-0 rounded-full bg-[#fbf8ef] px-3 py-1 text-sm font-bold text-[#6b6a62] dark:bg-[#1f1d18] dark:text-[#9a978d]">
                {book.word_count} words
              </span>
            </div>

            <h3 className="mt-5 min-w-0 break-words text-xl font-semibold">{book.title}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                {book.category || '通用'}
              </span>
              <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>
                {book.difficulty || '标准'}
              </span>
            </div>
            <p className="mt-2 min-h-10 text-sm leading-6" style={{ color: 'var(--muted)' }}>
              {book.description || '暂无描述'}
            </p>

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
            <div className="mt-3 rounded-lg p-3 text-sm font-semibold" style={{ background: 'var(--panel)', color: 'var(--muted)' }}>
              词书总量：{book.word_count} 个单词 · 当前完成度按已学习单词计算
            </div>

            <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
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

function ImportPreviewPanel({ preview }: { preview: WordBookImportPreview }) {
  const hasErrors = preview.error_count > 0;
  const hasDuplicates = preview.duplicate_in_file_count > 0 || preview.duplicate_in_database_count > 0;

  return (
      <div className="mt-4 rounded-lg border p-3 sm:p-4" style={{ borderColor: hasErrors ? 'var(--red)' : 'var(--line)', background: 'var(--panel)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          {hasErrors ? <AlertTriangle size={18} style={{ color: 'var(--red)' }} /> : <CheckCircle2 size={18} style={{ color: 'var(--green)' }} />}
          导入预览
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <PreviewBadge label="总行数" value={preview.total_rows} />
          <PreviewBadge label="可导入" value={preview.valid_count} />
          <PreviewBadge label="错误" value={preview.error_count} tone={hasErrors ? 'error' : 'default'} />
          <PreviewBadge label="文件重复" value={preview.duplicate_in_file_count} tone={preview.duplicate_in_file_count > 0 ? 'warning' : 'default'} />
          <PreviewBadge label="库内重复" value={preview.duplicate_in_database_count} tone={preview.duplicate_in_database_count > 0 ? 'warning' : 'default'} />
        </div>
      </div>

      {hasErrors && (
        <div className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--red)', background: 'var(--red-soft)' }}>
          <div className="font-semibold" style={{ color: 'var(--red)' }}>需要修正的行</div>
          <ul className="mt-2 space-y-1">
            {preview.errors.slice(0, 6).map((error) => (
              <li key={`${error.row_number}-${error.message}`}>
                第 {error.row_number} 行：{error.message}
              </li>
            ))}
          </ul>
          {preview.errors.length > 6 && <p className="mt-2">还有 {preview.errors.length - 6} 行错误未展示。</p>}
        </div>
      )}

      {preview.words.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--line)' }}>
          <div className="grid min-w-[520px] grid-cols-[80px_1fr_1.2fr] gap-3 px-3 py-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted)', background: 'var(--surface)' }}>
            <span>行号</span>
            <span>单词</span>
            <span>释义</span>
          </div>
          {preview.words.slice(0, 5).map((word) => (
            <div className="grid min-w-[520px] grid-cols-[80px_1fr_1.2fr] items-center gap-3 border-t px-3 py-2 text-sm" key={`${word.row_number}-${word.word}`} style={{ borderColor: 'var(--line)' }}>
              <span>{word.row_number}</span>
              <span className="font-semibold">
                {word.word}
                {word.duplicate_in_file && <span className="ml-2 rounded-full bg-[#fff3cd] px-2 py-0.5 text-xs text-[#8a6200]">文件重复</span>}
                {word.duplicate_in_database && <span className="ml-2 rounded-full bg-[#e6efdf] px-2 py-0.5 text-xs text-[#355e3b]">已存在</span>}
              </span>
              <span style={{ color: 'var(--muted)' }}>{word.meaning}</span>
            </div>
          ))}
          {preview.words.length > 5 && (
            <div className="border-t px-3 py-2 text-sm" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
              还有 {preview.words.length - 5} 个可导入单词未展示。
            </div>
          )}
        </div>
      )}

      {hasDuplicates && !hasErrors && (
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          重复单词不会阻止导入，但建议在正式使用前整理词表，避免学习计划里出现同一个单词多次。
        </p>
      )}
    </div>
  );
}

function PreviewBadge({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warning' | 'error' }) {
  const color = tone === 'error' ? 'var(--red)' : tone === 'warning' ? '#8a6200' : 'var(--muted)';
  const background = tone === 'error' ? 'var(--red-soft)' : tone === 'warning' ? '#fff3cd' : 'var(--surface)';
  return (
    <span className="rounded-full px-3 py-1" style={{ color, background }}>
      {label} {value}
    </span>
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
