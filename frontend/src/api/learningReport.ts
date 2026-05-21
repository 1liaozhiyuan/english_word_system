import { api, getAuthHeaders } from './client';
import type { LearningReport } from '../types';

export async function getLearningReport(token: string) {
  const { data } = await api.get<LearningReport>('/learning-report', {
    headers: getAuthHeaders(token),
  });
  return data;
}
