import { api, getAuthHeaders } from './client';
import type { CheckInStatus } from '../types';

export async function getCheckInStatus(token: string) {
  const { data } = await api.get<CheckInStatus>('/check-in/status', {
    headers: getAuthHeaders(token),
  });
  return data;
}
