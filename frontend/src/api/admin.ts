import { api, getAuthHeaders } from './client';
import type { ContentReport, MembershipOrder, MembershipPlan, PaginatedResponse, WordBook } from '../types';

export type AdminOverview = {
  users: number;
  total_users: number;
  demo_users: number;
  word_books: number;
  words: number;
  reviews: number;
  feedback_open: number;
  content_reports_open: number;
  ai_today: number;
  members: number;
  paid_orders: number;
  paid_revenue_cents: number;
};

export type AdminUser = {
  id: number;
  email: string;
  role: 'user' | 'admin' | 'operator' | 'reviewer';
  created_at: string;
  membership_tier: string;
  learning_goal: string | null;
  progress_count: number;
  review_count: number;
  feedback_count: number;
};

export type AdminOperationLog = {
  id: number;
  actor_user_id: number;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: string | null;
  created_at: string;
};

export type AdminFeedback = {
  id: number;
  user_id: number;
  user_email: string;
  category: string;
  contact: string | null;
  content: string;
  status: string;
  created_at: string;
};

export type AdminAIUsage = {
  id: number;
  user_id: number;
  user_email: string;
  feature: string;
  created_at: string;
};

export type AdminAIUsageResponse = PaginatedResponse<AdminAIUsage> & {
  feature_summary: { feature: string; count: number }[];
};

export async function getAdminOverview(token: string) {
  const { data } = await api.get<AdminOverview>('/admin/overview', {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function getAdminUsers(token: string, q = '') {
  const { data } = await api.get<PaginatedResponse<AdminUser>>('/admin/users', {
    headers: getAuthHeaders(token),
    params: { q, page: 1, page_size: 20 },
  });
  return data;
}

export async function getAdminWordBooks(token: string, q = '') {
  const { data } = await api.get<PaginatedResponse<WordBook>>('/admin/word-books', {
    headers: getAuthHeaders(token),
    params: { q, page: 1, page_size: 20 },
  });
  return data;
}

export async function getAdminFeedback(token: string, statusFilter = 'all') {
  const { data } = await api.get<PaginatedResponse<AdminFeedback>>('/admin/feedback', {
    headers: getAuthHeaders(token),
    params: { status_filter: statusFilter, page: 1, page_size: 20 },
  });
  return data;
}

export async function updateAdminFeedbackStatus(token: string, feedbackId: number, status: string) {
  const { data } = await api.patch<{ id: number; status: string }>(
    `/admin/feedback/${feedbackId}`,
    {},
    { headers: getAuthHeaders(token), params: { status } },
  );
  return data;
}

export async function getAdminAIUsage(token: string) {
  const { data } = await api.get<AdminAIUsageResponse>('/admin/ai-usage', {
    headers: getAuthHeaders(token),
    params: { page: 1, page_size: 20 },
  });
  return data;
}

export async function updateAdminUserRole(token: string, userId: number, role: AdminUser['role']) {
  const { data } = await api.patch<AdminUser>(
    `/admin/users/${userId}/role`,
    { role },
    { headers: getAuthHeaders(token) },
  );
  return data;
}

export async function getAdminOperationLogs(token: string) {
  const { data } = await api.get<PaginatedResponse<AdminOperationLog>>('/admin/operation-logs', {
    headers: getAuthHeaders(token),
    params: { page: 1, page_size: 20 },
  });
  return data;
}

export async function getAdminOrders(token: string) {
  const { data } = await api.get<PaginatedResponse<MembershipOrder>>('/admin/orders', {
    headers: getAuthHeaders(token),
    params: { page: 1, page_size: 20 },
  });
  return data;
}

export async function getAdminMembershipPlans(token: string) {
  const { data } = await api.get<MembershipPlan[]>('/admin/membership-plans', {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function getAdminContentReports(token: string, statusFilter = 'all') {
  const { data } = await api.get<PaginatedResponse<ContentReport>>('/admin/content-reports', {
    headers: getAuthHeaders(token),
    params: { status_filter: statusFilter, page: 1, page_size: 20 },
  });
  return data;
}

export async function updateAdminContentReport(
  token: string,
  reportId: number,
  payload: { status: string; review_note?: string | null },
) {
  const { data } = await api.patch<ContentReport>(`/admin/content-reports/${reportId}`, payload, {
    headers: getAuthHeaders(token),
  });
  return data;
}
