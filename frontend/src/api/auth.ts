import { api, getAuthHeaders } from './client';
import type { AuthResponse, User } from '../types';

export async function login(email: string, password: string) {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function register(email: string, password: string) {
  const { data } = await api.post<AuthResponse>('/auth/register', { email, password });
  return data;
}

export async function getMe(token: string) {
  const { data } = await api.get<User>('/me', { headers: getAuthHeaders(token) });
  return data;
}

export async function forgotPassword(email: string) {
  const { data } = await api.post<{ message: string; reset_token?: string }>('/auth/forgot-password', { email });
  return data;
}

export async function resetPassword(token: string, newPassword: string) {
  const { data } = await api.post<AuthResponse>('/auth/reset-password', {
    token,
    new_password: newPassword,
  });
  return data;
}

export async function changePassword(token: string, currentPassword: string, newPassword: string) {
  const { data } = await api.post<{ status: string }>(
    '/auth/change-password',
    { current_password: currentPassword, new_password: newPassword },
    { headers: getAuthHeaders(token) },
  );
  return data;
}
