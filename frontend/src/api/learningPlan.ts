import { api, getAuthHeaders } from './client';
import type { LearningPlan } from '../types';

export async function getLearningPlan(token: string) {
  const { data } = await api.get<LearningPlan>('/learning-plan', {
    headers: getAuthHeaders(token),
  });
  return data;
}
