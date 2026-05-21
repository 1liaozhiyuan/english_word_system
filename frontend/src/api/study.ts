import { api, getAuthHeaders } from './client';
import type { AnswerResult, DataImportResult, PaginatedResponse, ReviewLogItem, StudyItem, StudyMode } from '../types';

export async function getTodayStudy(token: string) {
  const { data } = await api.get<StudyItem[]>('/study/today', {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function getNewStudy(token: string, limit?: number) {
  const { data } = await api.get<StudyItem[]>('/study/new', {
    headers: getAuthHeaders(token),
    params: limit ? { limit } : undefined,
  });
  return data;
}

export async function getTodayReview(token: string, limit?: number) {
  const { data } = await api.get<StudyItem[]>('/review/today', {
    headers: getAuthHeaders(token),
    params: limit ? { limit } : undefined,
  });
  return data;
}

export async function submitAnswer(
  token: string,
  wordId: number,
  quality: number,
  studyMode?: StudyMode,
  wordBookId?: number,
) {
  const { data } = await api.post<AnswerResult>(
    '/study/answer',
    { word_id: wordId, quality, study_mode: studyMode, word_book_id: wordBookId },
    { headers: getAuthHeaders(token) },
  );
  return data;
}

export async function getMistakes(token: string) {
  const { data } = await api.get<StudyItem[]>('/mistakes', {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function getMistakesPaginated(token: string, page: number, pageSize: number, q = '') {
  const { data } = await api.get<PaginatedResponse<StudyItem>>('/mistakes-paginated', {
    headers: getAuthHeaders(token),
    params: { page, page_size: pageSize, q },
  });
  return data;
}

export async function practiceMistake(token: string, wordId: number) {
  const { data } = await api.post<StudyItem>(
    `/mistakes/${wordId}/practice`,
    {},
    { headers: getAuthHeaders(token) },
  );
  return data;
}

export async function practiceMistakesBatch(token: string, wordIds: number[]) {
  const { data } = await api.post<{ scheduled: number }>(
    '/mistakes/practice-batch',
    { word_ids: wordIds },
    { headers: getAuthHeaders(token) },
  );
  return data;
}

export async function resolveMistake(token: string, wordId: number) {
  const { data } = await api.post<StudyItem>(
    `/mistakes/${wordId}/resolve`,
    {},
    { headers: getAuthHeaders(token) },
  );
  return data;
}

export async function getStudyHistory(token: string) {
  const { data } = await api.get<ReviewLogItem[]>('/study/history', {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function getStudyHistoryPaginated(token: string, page: number, pageSize: number, q = '') {
  const { data } = await api.get<PaginatedResponse<ReviewLogItem>>('/study/history-paginated', {
    headers: getAuthHeaders(token),
    params: { page, page_size: pageSize, q },
  });
  return data;
}

export async function exportUserData(token: string) {
  const { data } = await api.get<Blob>('/data/export', {
    headers: getAuthHeaders(token),
    responseType: 'blob',
  });
  return data;
}

export async function exportAnkiData(token: string) {
  const { data } = await api.get<Blob>('/data/export/anki', {
    headers: getAuthHeaders(token),
    responseType: 'blob',
  });
  return data;
}

export async function importUserData(token: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<DataImportResult>('/data/import', form, {
    headers: getAuthHeaders(token),
  });
  return data;
}
