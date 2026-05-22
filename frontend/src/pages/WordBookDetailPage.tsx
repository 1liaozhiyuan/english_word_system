import {
  ArrowLeft,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  Save,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { getSettings } from '../api/settings';
import {
  addWordToBook,
  batchDeleteWords,
  batchMoveWords,
  deleteWordBook,
  exportWordBook,
  getWordBookDetail,
  getWordBookWordProgressPaginated,
  getWordBooks,
  removeWordFromBook,
  selectWordBook,
  updateWord,
  updateWordBook,
} from '../api/wordBooks';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FavoriteButton } from '../components/FavoriteButton';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { WordBookSummary } from '../api/wordBooks';
import type { Word, WordBook, WordBookDetail, WordBookPayload, WordPayload, WordProgress } from '../types';

const emptyForm: WordPayload = {
  text: '',
  meaning: '',
  phonetic: '',
  part_of_speech: '',
  example_sentence: '',
  example_translation: '',
  note: '',
  english_definition: '',
  root_affix: '',
  collocations: '',
  synonyms: '',
  antonyms: '',
  word_family: '',
  confusing_words: '',
  exam_tags: '',
  difficulty_tag: '',
};

const statusText: Record<string, string> = {
  none: '未加入',
  new: '新词',
  learning: '学习中',
  reviewing: '复习中',
  mastered: '已掌握',
  mistake: '错词',
};

const filters = [
  { key: 'all', label: '全部' },
  { key: 'none', label: '未加入' },
  { key: 'new', label: '新词' },
  { key: 'learning', label: '学习中' },
  { key: 'reviewing', label: '复习中' },
  { key: 'mastered', label: '已掌握' },
  { key: 'mistake', label: '错词' },
] as const;

type FilterKey = (typeof filters)[number]['key'];
type MessageState = { text: string; tone: 'success' | 'error' | 'info' | 'warning' };

export function WordBookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const wordBookId = Number(id);

  const [book, setBook] = React.useState<WordBookDetail | null>(null);
  const [allBooks, setAllBooks] = React.useState<WordBook[]>([]);
  const [wordProgress, setWordProgress] = React.useState<WordProgress[]>([]);
  const [summary, setSummary] = React.useState<WordBookSummary>({
    total: 0,
    added: 0,
    studied: 0,
    mastered: 0,
    mistakes: 0,
    reviewing: 0,
    completionRate: 0,
  });
  const [bookForm, setBookForm] = React.useState<WordBookPayload>({
    title: '',
    description: '',
    category: '通用',
    difficulty: '标准',
  });
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<FilterKey>('all');
  const [message, setMessage] = React.useState<MessageState>({ text: '', tone: 'success' });
  const [newWord, setNewWord] = React.useState<WordPayload>(emptyForm);
  const [editingWordId, setEditingWordId] = React.useState<number | null>(null);
  const [editingWord, setEditingWord] = React.useState<WordPayload>(emptyForm);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(30);
  const [totalPages, setTotalPages] = React.useState(1);
  const [isLoadingWords, setIsLoadingWords] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteBookConfirm, setShowDeleteBookConfirm] = React.useState(false);
  const [wordToRemove, setWordToRemove] = React.useState<Word | null>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = React.useState(false);
  const [moveTargetId, setMoveTargetId] = React.useState('');
  const [showMoveConfirm, setShowMoveConfirm] = React.useState(false);
  const isMutating = isSaving || isDeleting;

  const loadWords = React.useCallback(async () => {
    if (!Number.isFinite(wordBookId)) return;
    setIsLoadingWords(true);
    try {
      const result = await getWordBookWordProgressPaginated(token, wordBookId, page, pageSize, query, filter);
      setWordProgress(result.items);
      setSelectedIds((current) => keepOnlyVisibleIds(current, result.items));
      setTotalPages(result.total_pages);
      setSummary(result.summary);
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsLoadingWords(false);
    }
  }, [token, wordBookId, page, pageSize, query, filter]);

  const loadBook = React.useCallback(async () => {
    if (!Number.isFinite(wordBookId)) {
      setMessage({ text: '词书 ID 无效。', tone: 'error' });
      return;
    }
    try {
      const detail = await getWordBookDetail(token, wordBookId);
      setBook(detail);
      setBookForm({
        title: detail.title,
        description: detail.description,
        category: detail.category || '通用',
        difficulty: detail.difficulty || '标准',
      });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    }
  }, [token, wordBookId]);

  React.useEffect(() => {
    loadBook();
    getWordBooks().then(setAllBooks).catch(() => setAllBooks([]));
  }, [loadBook]);

  React.useEffect(() => {
    getSettings(token)
      .then((settings) => {
        setPageSize(settings.word_book_page_size || 30);
        setPage(1);
      })
      .catch(() => undefined);
  }, [token]);

  React.useEffect(() => {
    loadWords();
  }, [loadWords]);

  async function handleSelect() {
    if (!book) return;
    try {
      const data = await selectWordBook(token, book.id);
      setMessage({
        text: data.created > 0 ? `已加入 ${data.created} 个新单词。` : '这本词书已经在你的学习计划中。',
        tone: 'success',
      });
      await loadWords();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    }
  }

  async function handleUpdateBook(event: React.FormEvent) {
    event.preventDefault();
    if (!bookForm.title.trim()) {
      setMessage({ text: '词书名称不能为空。', tone: 'warning' });
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateWordBook(token, wordBookId, {
        title: bookForm.title.trim(),
        description: bookForm.description.trim(),
        category: bookForm.category.trim() || '通用',
        difficulty: bookForm.difficulty.trim() || '标准',
      });
      setBook((current) => (current ? { ...current, ...updated } : current));
      setMessage({ text: '词书信息已更新。', tone: 'success' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteBook() {
    if (!book) return;
    setIsDeleting(true);
    try {
      await deleteWordBook(token, book.id);
      setShowDeleteBookConfirm(false);
      navigate('/word-books');
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleExportBook() {
    if (!book) return;
    try {
      const blob = await exportWordBook(token, book.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${book.title || `word-book-${book.id}`}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      setMessage({ text: 'CSV 已导出。', tone: 'success' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    }
  }

  async function handleAddWord(event: React.FormEvent) {
    event.preventDefault();
    if (!newWord.text.trim() || !newWord.meaning.trim()) {
      setMessage({ text: '英文单词和中文释义必填。', tone: 'warning' });
      return;
    }
    setIsSaving(true);
    try {
      await addWordToBook(token, wordBookId, normalizePayload(newWord));
      setNewWord(emptyForm);
      setMessage({ text: '单词已新增。', tone: 'success' });
      await loadBook();
      await loadWords();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(word: Word) {
    setEditingWordId(word.id);
    setEditingWord({
      text: word.text,
      meaning: word.meaning,
      phonetic: word.phonetic ?? '',
      part_of_speech: word.part_of_speech ?? '',
      example_sentence: word.example_sentence ?? '',
      example_translation: word.example_translation ?? '',
      note: word.note ?? '',
      english_definition: word.english_definition ?? '',
      root_affix: word.root_affix ?? '',
      collocations: word.collocations ?? '',
      synonyms: word.synonyms ?? '',
      antonyms: word.antonyms ?? '',
      word_family: word.word_family ?? '',
      confusing_words: word.confusing_words ?? '',
      exam_tags: word.exam_tags ?? '',
      difficulty_tag: word.difficulty_tag ?? '',
    });
  }

  async function handleUpdateWord(wordId: number) {
    if (!editingWord.text.trim() || !editingWord.meaning.trim()) {
      setMessage({ text: '英文单词和中文释义必填。', tone: 'warning' });
      return;
    }
    setIsSaving(true);
    try {
      await updateWord(token, wordId, normalizePayload(editingWord));
      setEditingWordId(null);
      setMessage({ text: '单词已更新。', tone: 'success' });
      await loadWords();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  async function removeWordNow(word: Word) {
    setIsDeleting(true);
    try {
      const result = await removeWordFromBook(token, wordBookId, word.id);
      setWordToRemove(null);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(word.id);
        return next;
      });
      setWordProgress((current) => current.filter((item) => item.word.id !== word.id));
      if (result.word_book_deleted) {
        window.alert('这个词书已经没有单词，系统已自动删除该词书。');
        navigate('/word-books', { replace: true });
        return;
      }
      setMessage({ text: '单词已从当前词书移除。', tone: 'success' });
      await loadBook();
      await loadWords();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRemoveWord() {
    if (!wordToRemove) return;
    await removeWordNow(wordToRemove);
  }

  async function requestRemoveWord(word: Word) {
    const confirmed = window.confirm(`确认从当前词书移除 “${word.text}”？相关学习进度也会同步移除。`);
    if (!confirmed) return;
    await removeWordNow(word);
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`确认从当前词书批量移除 ${selectedIds.size} 个单词？相关学习进度也会同步移除。`);
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      const result = await batchDeleteWords(token, wordBookId, [...selectedIds]);
      const deletedIds = new Set(selectedIds);
      setSelectedIds(new Set());
      setShowBatchDeleteConfirm(false);
      setWordProgress((current) => current.filter((item) => !deletedIds.has(item.word.id)));
      if (result.word_book_deleted) {
        window.alert(`已移除 ${result.deleted} 个单词。这个词书已经为空，系统已自动删除该词书。`);
        navigate('/word-books', { replace: true });
        return;
      }
      setMessage({ text: `已移除 ${result.deleted} 个单词。`, tone: 'success' });
      await loadBook();
      await loadWords();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleBatchMove() {
    const targetWordBookId = Number(moveTargetId);
    if (selectedIds.size === 0 || !targetWordBookId || targetWordBookId === wordBookId) return;
    const count = selectedIds.size;
    setIsSaving(true);
    try {
      await batchMoveWords(token, wordBookId, [...selectedIds], targetWordBookId);
      setSelectedIds(new Set());
      setMoveTargetId('');
      setShowMoveConfirm(false);
      setMessage({ text: `已移动 ${count} 个单词。`, tone: 'success' });
      await loadBook();
      await loadWords();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  function toggleSelect(wordId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  }

  function goToPage(nextPage: number) {
    setSelectedIds(new Set());
    setEditingWordId(null);
    setMoveTargetId('');
    setPage(nextPage);
  }

  function toggleSelectCurrentPage() {
    const currentIds = wordProgress.map((item) => item.word.id);
    const allSelected = currentIds.length > 0 && currentIds.every((wordId) => selectedIds.has(wordId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      currentIds.forEach((wordId) => {
        if (allSelected) next.delete(wordId);
        else next.add(wordId);
      });
      return next;
    });
  }

  function clearFilters() {
    setQuery('');
    setFilter('all');
    setPage(1);
    setSelectedIds(new Set());
    setEditingWordId(null);
    setMoveTargetId('');
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setMoveTargetId('');
    setShowBatchDeleteConfirm(false);
    setShowMoveConfirm(false);
  }

  const selectedTargetBook = allBooks.find((item) => item.id === Number(moveTargetId));
  const currentPageAllSelected = wordProgress.length > 0 && wordProgress.every((item) => selectedIds.has(item.word.id));
  const hasActiveFilter = Boolean(query.trim()) || filter !== 'all';

  return (
    <>
      <PageHeader
        title={book?.title ?? '词书详情'}
        description={book?.description || '查看单词学习状态，并管理这本词书中的内容。'}
        action={(
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <Link className="button-secondary" to="/word-books">
              <ArrowLeft size={16} />
              返回词书
            </Link>
            <button className="button-primary" disabled={!book || isMutating} onClick={handleSelect} type="button">
              <Plus size={16} />
              加入学习
            </button>
          </div>
        )}
      />
      <Message tone={message.tone}>{message.text}</Message>

      {book && (
        <>
          <section className="surface mb-5 rounded-lg p-4 sm:p-5">
            <form className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_150px_150px_auto_auto]" onSubmit={handleUpdateBook}>
              <input
                className="input"
                disabled={isMutating}
                value={bookForm.title}
                onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })}
                placeholder="词书名称"
              />
              <input
                className="input"
                disabled={isMutating}
                value={bookForm.description}
                onChange={(event) => setBookForm({ ...bookForm, description: event.target.value })}
                placeholder="词书描述"
              />
              <input
                className="input"
                disabled={isMutating}
                value={bookForm.category}
                onChange={(event) => setBookForm({ ...bookForm, category: event.target.value })}
                placeholder="分类"
              />
              <select
                className="input"
                disabled={isMutating}
                value={bookForm.difficulty}
                onChange={(event) => setBookForm({ ...bookForm, difficulty: event.target.value })}
              >
                <option value="入门">入门</option>
                <option value="标准">标准</option>
                <option value="进阶">进阶</option>
                <option value="考试">考试</option>
              </select>
              <button className="button-secondary" disabled={isSaving} type="submit">
                <Save size={16} />
                保存
              </button>
              <button className="button-secondary" disabled={isMutating} type="button" onClick={handleExportBook}>
                <Download size={16} />
                导出 CSV
              </button>
            </form>
            <button className="button-secondary mt-3 w-full sm:w-auto" disabled={isMutating} style={{ color: 'var(--red)' }} type="button" onClick={() => setShowDeleteBookConfirm(true)}>
              <Trash2 size={16} />
              删除词书
            </button>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full px-3 py-1" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                {book.category || '通用'}
              </span>
              <span className="rounded-full px-3 py-1" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>
                {book.difficulty || '标准'}
              </span>
            </div>
          </section>

          <section className="surface mb-5 rounded-lg p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>词书进度</p>
                <h3 className="mt-1 text-3xl font-semibold" style={{ color: 'var(--ink)' }}>{summary.completionRate}%</h3>
              </div>
              <div className="w-full max-w-md lg:justify-self-end">
                <div className="mb-2 flex justify-between text-sm font-semibold" style={{ color: 'var(--muted)' }}>
                  <span>已掌握 {summary.mastered}</span>
                  <span>总计 {summary.total}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#eee8d8] dark:bg-[#3d3a32]">
                  <div className="h-full rounded-full bg-[#355e3b] dark:bg-[#7fb87a]" style={{ width: `${summary.completionRate}%` }} />
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <SummaryMetric label="已加入" value={summary.added} />
              <SummaryMetric label="已学习" value={summary.studied} />
              <SummaryMetric label="复习中" value={summary.reviewing} />
              <SummaryMetric label="已掌握" value={summary.mastered} />
              <SummaryMetric label="错词" value={summary.mistakes} />
            </div>
          </section>

          <section className="surface mb-5 rounded-lg p-4 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <label className="relative block min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: 'var(--muted)' }} />
                <input
                  className="input pl-10"
                  disabled={isMutating}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                    setSelectedIds(new Set());
                    setEditingWordId(null);
                  }}
                  placeholder="搜索英文、释义、词性或例句"
                />
              </label>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
                {filters.map((item) => (
                  <button
                    className={`${filter === item.key ? 'button-primary' : 'button-secondary'} shrink-0`}
                    disabled={isMutating}
                    key={item.key}
                    onClick={() => {
                      setFilter(item.key);
                      setPage(1);
                      setSelectedIds(new Set());
                      setEditingWordId(null);
                    }}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="surface mb-5 rounded-lg p-4 sm:p-5">
            <div className="grid gap-3 xl:grid-cols-[auto_auto_minmax(220px,1fr)_auto_auto] xl:items-center">
              <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
                已选择 {selectedIds.size} 个单词 · 每页 {pageSize} 个
              </span>
              <button className="button-secondary" disabled={isMutating || wordProgress.length === 0} onClick={toggleSelectCurrentPage} type="button">
                {currentPageAllSelected ? <Square size={16} /> : <CheckSquare size={16} />}
                {currentPageAllSelected ? '取消本页' : '选择本页'}
              </button>
              <select
                className="input min-w-0"
                disabled={isMutating || selectedIds.size === 0}
                onChange={(e) => setMoveTargetId(e.target.value)}
                value={moveTargetId}
              >
                <option value="">选择目标词书</option>
                {allBooks.filter((item) => item.id !== wordBookId).map((item) => (
                  <option key={item.id} value={item.id}>{item.title} ({item.word_count} 词)</option>
                ))}
              </select>
              <button className="button-secondary" disabled={isMutating || selectedIds.size === 0 || !moveTargetId} onClick={() => setShowMoveConfirm(true)} type="button">
                确认移动
              </button>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <button className="button-secondary" disabled={isMutating || selectedIds.size === 0} onClick={handleBatchDelete} type="button">
                  <Trash2 size={16} />
                  批量移除
                </button>
                <button className="button-secondary" disabled={isMutating || selectedIds.size === 0} onClick={clearSelection} type="button">
                  <X size={16} />
                  取消选择
                </button>
              </div>
            </div>
          </section>

          <section className="surface mb-5 rounded-lg p-4 sm:p-5">
            <h3 className="text-xl font-semibold" style={{ color: 'var(--ink)' }}>新增单词</h3>
            <WordForm
              actionLabel={isSaving ? '保存中...' : '新增单词'}
              disabled={isMutating}
              onValidationError={setMessage}
              onChange={setNewWord}
              onSubmit={handleAddWord}
              value={newWord}
            />
          </section>

          <section className="grid gap-3">
            {isLoadingWords && <WordDetailSkeleton count={3} />}

            {!isLoadingWords && wordProgress.map((item) => (
              <article className="surface min-w-0 rounded-lg p-4 sm:p-5" key={item.word.id}>
                <div className="flex items-start gap-3">
                  <div className="checkbox-cell pt-1">
                    <button
                      aria-label={selectedIds.has(item.word.id) ? '取消选择单词' : '选择单词'}
                      className="rounded p-1"
                      disabled={isMutating}
                      onClick={() => toggleSelect(item.word.id)}
                      style={{ color: selectedIds.has(item.word.id) ? 'var(--green)' : 'var(--muted)' }}
                      type="button"
                    >
                      {selectedIds.has(item.word.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    {editingWordId === item.word.id ? (
                      <div>
                        <WordForm
                          actionLabel={isSaving ? '保存中...' : '保存修改'}
                          disabled={isMutating}
                          onValidationError={setMessage}
                          onChange={setEditingWord}
                          onSubmit={(event) => {
                            event.preventDefault();
                            handleUpdateWord(item.word.id);
                          }}
                          value={editingWord}
                        />
                        <button className="button-secondary mt-3 w-full sm:w-auto" disabled={isMutating} onClick={() => setEditingWordId(null)} type="button">
                          <X size={16} />
                          取消编辑
                        </button>
                      </div>
                    ) : (
                      <WordProgressCard
                        item={item}
                        isMutating={isMutating}
                        onEdit={() => startEditing(item.word)}
                        onRemove={() => requestRemoveWord(item.word)}
                      />
                    )}
                  </div>
                </div>
              </article>
            ))}

            {!isLoadingWords && wordProgress.length === 0 && (
              <div className="surface rounded-lg p-5 text-center text-sm" style={{ color: 'var(--muted)' }}>
                <div>没有找到匹配的单词。</div>
                {hasActiveFilter && (
                  <button className="button-secondary mt-4" onClick={clearFilters} type="button">
                    清空搜索和筛选
                  </button>
                )}
              </div>
            )}

            {!isLoadingWords && totalPages > 1 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button className="pagination-btn" disabled={page <= 1 || isMutating} onClick={() => goToPage(Math.max(1, page - 1))} type="button">
                  <ChevronLeft size={16} />
                  上一页
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 9).map((item) => (
                  <button
                    key={item}
                    className={`pagination-btn ${item === page ? 'pagination-btn-active' : ''}`}
                    disabled={isMutating}
                    onClick={() => goToPage(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
                <button className="pagination-btn" disabled={page >= totalPages || isMutating} onClick={() => goToPage(Math.min(totalPages, page + 1))} type="button">
                  下一页
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={showDeleteBookConfirm}
        title="删除这本词书？"
        description={`将删除“${book?.title ?? ''}”及其单词关联，并移除这本词书下的学习进度。这个操作无法撤销。`}
        confirmLabel="删除词书"
        isLoading={isDeleting}
        onCancel={() => setShowDeleteBookConfirm(false)}
        onConfirm={handleDeleteBook}
      />
      <ConfirmDialog
        open={Boolean(wordToRemove)}
        title="移除这个单词？"
        description={`将从当前词书中移除 ${wordToRemove?.text ?? ''}，相关学习进度也会同步移除。`}
        confirmLabel="移除单词"
        isLoading={isDeleting}
        onCancel={() => setWordToRemove(null)}
        onConfirm={handleRemoveWord}
      />
      <ConfirmDialog
        open={showBatchDeleteConfirm}
        title="批量移除单词？"
        description={`将从当前词书中移除 ${selectedIds.size} 个单词，相关学习进度也会同步移除。`}
        confirmLabel="批量移除"
        isLoading={isDeleting}
        onCancel={() => setShowBatchDeleteConfirm(false)}
        onConfirm={handleBatchDelete}
      />
      <ConfirmDialog
        open={showMoveConfirm}
        title="移动选中的单词？"
        description={`将 ${selectedIds.size} 个单词移动到“${selectedTargetBook?.title ?? '目标词书'}”。移动后当前词书里的关联会被移除。`}
        confirmLabel="确认移动"
        isLoading={isSaving}
        tone="normal"
        onCancel={() => setShowMoveConfirm(false)}
        onConfirm={handleBatchMove}
      />
    </>
  );
}

function WordProgressCard({
  item,
  isMutating,
  onEdit,
  onRemove,
}: {
  item: WordProgress;
  isMutating: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const statusKey = item.wrong_count > 0 ? 'mistake' : item.status ?? 'none';

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link className="min-w-0 break-words text-2xl font-semibold hover:underline" style={{ color: 'var(--ink)' }} to={`/words/${item.word.id}`}>
              {item.word.text}
            </Link>
            <span className={statusBadgeClass(statusKey)}>{statusText[statusKey]}</span>
            {item.is_leech && (
              <span className="rounded-full bg-[#f4dddd] px-3 py-1 text-xs font-bold text-[#a13d3d] dark:bg-[#2e1b1b] dark:text-[#d47373]">
                重点难词
              </span>
            )}
          </div>
          <p className="mt-1 break-words text-sm font-semibold" style={{ color: 'var(--green)' }}>{item.word.phonetic}</p>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          {item.word.part_of_speech && (
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'var(--panel)', color: 'var(--muted)' }}>
              {item.word.part_of_speech}
            </span>
          )}
          {item.word.difficulty_tag && (
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
              {item.word.difficulty_tag}
            </span>
          )}
          {item.word.exam_tags && (
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>
              {item.word.exam_tags}
            </span>
          )}
          <button className="button-secondary" disabled={isMutating} onClick={onEdit} type="button">
            <Pencil size={16} />
            编辑
          </button>
          <FavoriteButton wordId={item.word.id} initialFavorite={item.is_favorite} disabled={isMutating} />
          <button className="button-secondary" disabled={isMutating} onClick={onRemove} type="button">
            <Trash2 size={16} />
            移除
          </button>
        </div>
      </div>
      <p className="mt-4 break-words text-xl" style={{ color: 'var(--ink)' }}>{item.word.meaning}</p>
      {item.word.english_definition && (
        <p className="mt-2 break-words text-sm leading-6" style={{ color: 'var(--muted)' }}>
          {item.word.english_definition}
        </p>
      )}
      {item.word.note && (
        <div className="mt-2 break-words rounded-lg p-3 text-sm leading-6" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
          笔记：{item.word.note}
        </div>
      )}
      {(item.word.example_sentence || item.word.example_translation) && (
        <div className="mt-4 break-words rounded-lg p-4 text-sm leading-7" style={{ background: 'var(--panel)', color: 'var(--muted)' }}>
          {item.word.example_sentence && <p>{item.word.example_sentence}</p>}
          {item.word.example_translation && <p>{item.word.example_translation}</p>}
        </div>
      )}
      {(item.word.collocations || item.word.synonyms || item.word.confusing_words) && (
        <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
          {item.word.collocations && <MiniWordMeta label="搭配" value={item.word.collocations} />}
          {item.word.synonyms && <MiniWordMeta label="同义" value={item.word.synonyms} />}
          {item.word.confusing_words && <MiniWordMeta label="易混" value={item.word.confusing_words} />}
        </div>
      )}
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
        <ProgressMetric label="掌握度" value={item.mastery_level} />
        <ProgressMetric label="EF 因子" value={item.easiness_factor.toFixed(1)} />
        <ProgressMetric label="正确次数" value={item.correct_count} />
        <ProgressMetric label="错误次数" value={item.wrong_count} danger={item.wrong_count > 0} />
        <ProgressMetric label="下次复习" value={formatDate(item.next_review_at)} />
      </div>
    </>
  );
}

function WordForm({
  value,
  onChange,
  onSubmit,
  actionLabel,
  disabled = false,
  onValidationError,
}: {
  value: WordPayload;
  onChange: (value: WordPayload) => void;
  onSubmit: (event: React.FormEvent) => void;
  actionLabel: string;
  disabled?: boolean;
  onValidationError?: (message: MessageState) => void;
}) {
  const textInputRef = React.useRef<HTMLInputElement | null>(null);
  const meaningInputRef = React.useRef<HTMLInputElement | null>(null);

  function updateField(field: keyof WordPayload, nextValue: string) {
    onChange({ ...value, [field]: nextValue });
  }

  function handleSubmit(event: React.FormEvent) {
    if (!value.text.trim()) {
      event.preventDefault();
      onValidationError?.({ text: '请先填写英文单词。', tone: 'warning' });
      textInputRef.current?.focus();
      return;
    }
    if (!value.meaning.trim()) {
      event.preventDefault();
      onValidationError?.({ text: '请先填写中文释义。', tone: 'warning' });
      meaningInputRef.current?.focus();
      return;
    }
    onSubmit(event);
  }

  return (
    <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
      <div className="rounded-lg border p-3 sm:p-4" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
        <div className="mb-3 text-sm font-bold" style={{ color: 'var(--green)' }}>基础信息</div>
        <div className="grid gap-3 md:grid-cols-2">
          <input ref={textInputRef} className="input" disabled={disabled} value={value.text} onChange={(event) => updateField('text', event.target.value)} placeholder="英文单词，必填" />
          <input ref={meaningInputRef} className="input" disabled={disabled} value={value.meaning} onChange={(event) => updateField('meaning', event.target.value)} placeholder="中文释义，必填" />
          <input className="input" disabled={disabled} value={value.phonetic ?? ''} onChange={(event) => updateField('phonetic', event.target.value)} placeholder="音标，可选" />
          <input className="input" disabled={disabled} value={value.part_of_speech ?? ''} onChange={(event) => updateField('part_of_speech', event.target.value)} placeholder="词性，可选" />
          <input className="input" disabled={disabled} value={value.difficulty_tag ?? ''} onChange={(event) => updateField('difficulty_tag', event.target.value)} placeholder="难度标签，例如 B2 / 考研核心" />
          <input className="input" disabled={disabled} value={value.exam_tags ?? ''} onChange={(event) => updateField('exam_tags', event.target.value)} placeholder="考试标签，例如 四级、考研、雅思" />
        </div>
      </div>
      <div className="rounded-lg border p-3 sm:p-4" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
        <div className="mb-3 text-sm font-bold" style={{ color: 'var(--green)' }}>例句</div>
        <div className="grid gap-3">
          <textarea className="input min-h-24" disabled={disabled} value={value.english_definition ?? ''} onChange={(event) => updateField('english_definition', event.target.value)} placeholder="英文释义，适合进阶用户理解语境" />
          <input className="input" disabled={disabled} value={value.example_sentence ?? ''} onChange={(event) => updateField('example_sentence', event.target.value)} placeholder="英文例句，可选" />
          <input className="input" disabled={disabled} value={value.example_translation ?? ''} onChange={(event) => updateField('example_translation', event.target.value)} placeholder="例句翻译，可选" />
        </div>
      </div>
      <div className="rounded-lg border p-3 sm:p-4" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
        <div className="mb-3 text-sm font-bold" style={{ color: 'var(--green)' }}>用法与辨析</div>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="input" disabled={disabled} value={value.root_affix ?? ''} onChange={(event) => updateField('root_affix', event.target.value)} placeholder="词根词缀，例如 sign + ific" />
          <input className="input" disabled={disabled} value={value.collocations ?? ''} onChange={(event) => updateField('collocations', event.target.value)} placeholder="常见搭配，例如 make significant progress" />
          <input className="input" disabled={disabled} value={value.synonyms ?? ''} onChange={(event) => updateField('synonyms', event.target.value)} placeholder="同义词，多个可用逗号分隔" />
          <input className="input" disabled={disabled} value={value.antonyms ?? ''} onChange={(event) => updateField('antonyms', event.target.value)} placeholder="反义词，多个可用逗号分隔" />
          <input className="input" disabled={disabled} value={value.word_family ?? ''} onChange={(event) => updateField('word_family', event.target.value)} placeholder="派生词，例如 significance / significantly" />
          <input className="input" disabled={disabled} value={value.confusing_words ?? ''} onChange={(event) => updateField('confusing_words', event.target.value)} placeholder="易混词，例如 similar / sign" />
        </div>
      </div>
      <div className="rounded-lg border p-3 sm:p-4" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
        <div className="mb-3 text-sm font-bold" style={{ color: 'var(--green)' }}>笔记</div>
        <input className="input" disabled={disabled} value={value.note ?? ''} onChange={(event) => updateField('note', event.target.value)} placeholder="笔记/记忆技巧，可选" />
      </div>
      <button className="button-primary w-full sm:w-fit" disabled={disabled} type="submit">
        <Check size={16} />
        {actionLabel}
      </button>
    </form>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg p-4" style={{ background: 'var(--panel)' }}>
      <div className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>{value}</div>
      <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}

function MiniWordMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <span className="font-semibold" style={{ color: 'var(--muted)' }}>{label}：</span>
      <span className="break-words" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

function ProgressMetric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="font-semibold" style={danger ? { color: 'var(--red)' } : { color: 'var(--ink)' }}>{value}</div>
      <div className="mt-1 text-xs font-semibold" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}

function statusBadgeClass(status: string) {
  if (status === 'mistake') return 'rounded-full bg-[#f4dddd] dark:bg-[#2e1b1b] px-3 py-1 text-xs font-bold text-[#a13d3d] dark:text-[#d47373]';
  if (status === 'mastered') return 'rounded-full bg-[#e6efdf] dark:bg-[#1e2f1c] px-3 py-1 text-xs font-bold text-[#355e3b] dark:text-[#7fb87a]';
  if (status === 'reviewing') return 'rounded-full bg-[#f5ead2] dark:bg-[#2e2516] px-3 py-1 text-xs font-bold text-[#9b6b2f] dark:text-[#d4a346]';
  return 'rounded-full px-3 py-1 text-xs font-bold';
}

function formatDate(value: string | null) {
  if (!value) return '未安排';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未安排';
  return date.toLocaleString();
}

function normalizePayload(payload: WordPayload): WordPayload {
  return {
    text: payload.text.trim(),
    meaning: payload.meaning.trim(),
    phonetic: payload.phonetic?.trim() || null,
    part_of_speech: payload.part_of_speech?.trim() || null,
    example_sentence: payload.example_sentence?.trim() || null,
    example_translation: payload.example_translation?.trim() || null,
    note: payload.note?.trim() || null,
    english_definition: payload.english_definition?.trim() || null,
    root_affix: payload.root_affix?.trim() || null,
    collocations: payload.collocations?.trim() || null,
    synonyms: payload.synonyms?.trim() || null,
    antonyms: payload.antonyms?.trim() || null,
    word_family: payload.word_family?.trim() || null,
    confusing_words: payload.confusing_words?.trim() || null,
    exam_tags: payload.exam_tags?.trim() || null,
    difficulty_tag: payload.difficulty_tag?.trim() || null,
  };
}

function keepOnlyVisibleIds(selected: Set<number>, items: WordProgress[]) {
  const visibleIds = new Set(items.map((item) => item.word.id));
  return new Set([...selected].filter((id) => visibleIds.has(id)));
}

function WordDetailSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div className="surface rounded-lg p-4 sm:p-5" key={index}>
          <div className="flex items-start gap-3">
            <div className="skeleton h-8 w-8 rounded-lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="skeleton h-8 w-40 rounded" />
                <div className="flex gap-2">
                  <div className="skeleton h-10 w-20 rounded-lg" />
                  <div className="skeleton h-10 w-20 rounded-lg" />
                </div>
              </div>
              <div className="skeleton mt-4 h-6 w-2/3 rounded" />
              <div className="skeleton mt-3 h-20 w-full rounded-lg" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {Array.from({ length: 5 }, (_, metricIndex) => (
                  <div className="skeleton h-16 rounded-lg" key={metricIndex} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
