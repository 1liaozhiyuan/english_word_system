import { api, getAuthHeaders } from './client';
import type { Stats } from '../types';

export async function getStatsOverview(token: string) {
  const { data } = await api.get<Stats>('/stats/overview', {
    headers: getAuthHeaders(token),
  });
  return data;
}
