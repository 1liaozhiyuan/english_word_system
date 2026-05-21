import { api, getAuthHeaders } from './client';
import type { NotificationItem, NotificationSummary } from '../types';

export async function getNotifications(token: string) {
  const { data } = await api.get<NotificationSummary>('/notifications', {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function markNotificationRead(token: string, notificationId: number) {
  const { data } = await api.post<NotificationItem>(
    `/notifications/${notificationId}/read`,
    {},
    { headers: getAuthHeaders(token) },
  );
  return data;
}
