import { api, getAuthHeaders } from './client';
import type {
  PaginatedResponse,
  Word,
  WordBook,
  WordBookDetail,
  WordDetail,
  WordBookImportResult,
  WordBookImportPreview,
  WordBookPayload,
  WordBookProgress,
  WordProgress,
  WordPayload,
} from '../types';

export async function getWordBooks() {
  const { data } = await api.get<WordBook[]>('/word-books');
  return data;
}

export async function getWordBookProgress(token: string) {
  const { data } = await api.get<WordBookProgress[]>('/word-books/progress', {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function getWordBookProgressPaginated(
  token: string,
  page: number,
  pageSize: number,
  q = '',
) {
  const { data } = await api.get<PaginatedResponse<WordBookProgress>>('/word-books/progress-paginated', {
    headers: getAuthHeaders(token),
    params: { page, page_size: pageSize, q },
  });
  return data;
}

export async function getWordBookDetail(token: string, wordBookId: number) {
  const { data } = await api.get<WordBookDetail>(`/word-books/${wordBookId}`, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function getWordBookWords(token: string, wordBookId: number) {
  const { data } = await api.get<Word[]>(`/word-books/${wordBookId}/words`, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function getWordBookWordsPaginated(
  token: string,
  wordBookId: number,
  page: number,
  pageSize: number,
) {
  const { data } = await api.get<PaginatedResponse<Word>>(
    `/word-books/${wordBookId}/words-paginated`,
    { headers: getAuthHeaders(token), params: { page, page_size: pageSize } },
  );
  return data;
}

export async function searchWords(
  token: string,
  wordBookId: number,
  q: string,
  page: number,
  pageSize: number,
) {
  const { data } = await api.get<PaginatedResponse<Word>>(
    `/word-books/${wordBookId}/words/search`,
    { headers: getAuthHeaders(token), params: { q, page, page_size: pageSize } },
  );
  return data;
}

export async function getWordBookWordProgress(token: string, wordBookId: number) {
  const { data } = await api.get<WordProgress[]>(`/word-books/${wordBookId}/word-progress`, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function getWordDetail(token: string, wordId: number) {
  const { data } = await api.get<WordDetail>(`/words/${wordId}`, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function getWordBookWordProgressPaginated(
  token: string,
  wordBookId: number,
  page: number,
  pageSize: number,
  q = '',
  statusFilter = 'all',
) {
  const { data } = await api.get<PaginatedResponse<WordProgress> & { summary: WordBookSummary }>(
    `/word-books/${wordBookId}/word-progress-paginated`,
    { headers: getAuthHeaders(token), params: { page, page_size: pageSize, q, status_filter: statusFilter } },
  );
  return data;
}

export type WordBookSummary = {
  total: number;
  added: number;
  studied: number;
  mastered: number;
  mistakes: number;
  reviewing: number;
  completionRate: number;
};

export async function updateWordBook(
  token: string,
  wordBookId: number,
  payload: Partial<WordBookPayload>,
) {
  const { data } = await api.patch<WordBook>(`/word-books/${wordBookId}`, payload, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function deleteWordBook(token: string, wordBookId: number) {
  const { data } = await api.delete<{ status: string }>(`/word-books/${wordBookId}`, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function batchDeleteWordBooks(token: string, wordBookIds: number[]) {
  const { data } = await api.post<{ deleted: number }>(
    '/word-books/batch-delete',
    { word_book_ids: wordBookIds },
    { headers: getAuthHeaders(token) },
  );
  return data;
}

export async function exportWordBook(token: string, wordBookId: number) {
  const { data } = await api.get<Blob>(`/word-books/${wordBookId}/export`, {
    headers: getAuthHeaders(token),
    responseType: 'blob',
  });
  return data;
}

export async function addWordToBook(token: string, wordBookId: number, payload: WordPayload) {
  const { data } = await api.post<Word>(`/word-books/${wordBookId}/words`, payload, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function updateWord(token: string, wordId: number, payload: Partial<WordPayload>) {
  const { data } = await api.patch<Word>(`/words/${wordId}`, payload, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function removeWordFromBook(token: string, wordBookId: number, wordId: number) {
  const { data } = await api.delete<{ status: string; word_book_deleted: boolean }>(`/word-books/${wordBookId}/words/${wordId}`, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function batchDeleteWords(token: string, wordBookId: number, wordIds: number[]) {
  const { data } = await api.post<{ deleted: number; word_book_deleted: boolean }>(
    `/word-books/${wordBookId}/words/batch-delete`,
    { word_ids: wordIds },
    { headers: getAuthHeaders(token) },
  );
  return data;
}

export async function batchMoveWords(
  token: string,
  wordBookId: number,
  wordIds: number[],
  targetWordBookId: number,
) {
  const { data } = await api.post<{ moved: number }>(
    `/word-books/${wordBookId}/words/batch-move`,
    { word_ids: wordIds, target_word_book_id: targetWordBookId },
    { headers: getAuthHeaders(token) },
  );
  return data;
}

export async function selectWordBook(token: string, wordBookId: number) {
  const { data } = await api.post<{ created: number }>(
    `/word-books/${wordBookId}/select`,
    {},
    { headers: getAuthHeaders(token) },
  );
  return data;
}

export async function importWordBook(
  token: string,
  payload: { title: string; description: string; category: string; difficulty: string; file: File },
) {
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('description', payload.description);
  formData.append('category', payload.category);
  formData.append('difficulty', payload.difficulty);
  formData.append('file', payload.file);

  const { data } = await api.post<WordBookImportResult>('/word-books/import', formData, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function previewWordBookImport(token: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await api.post<WordBookImportPreview>('/word-books/import/preview', formData, {
    headers: getAuthHeaders(token),
  });
  return data;
}
