import { api, getAuthHeaders } from './client';
import type { ContentReport } from '../types';

export async function submitContentReport(
  token: string,
  payload: { source_type: string; source_id?: string | null; reason: string; content: string },
) {
  const { data } = await api.post<ContentReport>('/content-reports', payload, {
    headers: getAuthHeaders(token),
  });
  return data;
}
