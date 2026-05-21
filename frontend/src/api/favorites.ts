import { api, getAuthHeaders } from './client';
import type { PaginatedResponse, StudyItem } from '../types';

export async function getFavoritesPaginated(token: string, page: number, pageSize: number, q = '') {
  const { data } = await api.get<PaginatedResponse<StudyItem>>('/favorites-paginated', {
    headers: getAuthHeaders(token),
    params: { page, page_size: pageSize, q },
  });
  return data;
}

export async function getFavoriteStatus(token: string, wordId: number) {
  const { data } = await api.get<{ is_favorite: boolean }>(`/words/${wordId}/favorite`, {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function favoriteWord(token: string, wordId: number) {
  const { data } = await api.post<{ is_favorite: boolean }>(
    `/words/${wordId}/favorite`,
    {},
    { headers: getAuthHeaders(token) },
  );
  return data;
}

export async function unfavoriteWord(token: string, wordId: number) {
  const { data } = await api.delete<{ is_favorite: boolean }>(`/words/${wordId}/favorite`, {
    headers: getAuthHeaders(token),
  });
  return data;
}
