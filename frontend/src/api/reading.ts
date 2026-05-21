import { api, getAuthHeaders } from './client';
import type { ReadingArticle, ReadingProgressResult } from '../types';

export async function getReadingArticles(token: string) {
  const { data } = await api.get<ReadingArticle[]>('/reading/articles', {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function completeReadingArticle(token: string, articleId: number, readingSeconds: number) {
  const { data } = await api.post<ReadingProgressResult>(
    `/reading/articles/${articleId}/complete`,
    { reading_seconds: readingSeconds },
    { headers: getAuthHeaders(token) },
  );
  return data;
}
