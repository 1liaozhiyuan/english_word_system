import axios from 'axios';

const apiBaseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

export const api = axios.create({
  baseURL: apiBaseURL.replace(/\/$/, ''),
  timeout: 15000,
});

export function getAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') {
      return '请求超时，请确认后端服务和数据库正在运行，然后再试一次。';
    }
    if (!error.response) {
      return '无法连接后端服务，请确认后端已启动，并检查前端 API 地址配置。';
    }
    const detail = error.response?.data?.detail;
    if (detail === 'Email already registered') {
      return '这个邮箱已经注册过了，请直接登录，或换一个邮箱注册。';
    }
    if (detail === 'Invalid email or password') {
      return '邮箱或密码不正确。';
    }
    if (detail === 'Not authenticated') {
      return '请先登录。';
    }
    if (typeof detail === 'string') {
      return detail;
    }
    if (error.response?.status === 422) {
      return '提交的数据格式不正确，请检查后再试。';
    }
    return '请求失败，请确认后端服务正在运行。';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return '操作失败，请稍后重试。';
}
