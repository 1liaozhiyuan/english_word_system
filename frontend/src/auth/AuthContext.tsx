import React from 'react';
import { getMe, login as loginApi, register as registerApi } from '../api/auth';
import { getErrorMessage } from '../api/client';
import type { User } from '../types';

type AuthContextValue = {
  token: string;
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  message: string;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  acceptToken: (token: string, successMessage?: string) => Promise<boolean>;
  logout: () => void;
  clearMessage: () => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState(localStorage.getItem('token') ?? '');
  const [user, setUser] = React.useState<User | null>(null);
  const [message, setMessage] = React.useState('');
  const [isInitializing, setIsInitializing] = React.useState(Boolean(token));

  async function loadUser(nextToken: string) {
    const currentUser = await getMe(nextToken);
    setUser(currentUser);
  }

  async function login(email: string, password: string) {
    try {
      const data = await loginApi(email, password);
      return acceptToken(data.access_token, '登录成功。');
    } catch (error) {
      localStorage.removeItem('token');
      setToken('');
      setUser(null);
      setMessage(getErrorMessage(error));
      return false;
    }
  }

  async function register(email: string, password: string) {
    try {
      const data = await registerApi(email, password);
      return acceptToken(data.access_token, '注册成功。');
    } catch (error) {
      setMessage(getErrorMessage(error));
      return false;
    }
  }

  async function acceptToken(nextToken: string, successMessage = '操作成功。') {
    try {
      localStorage.setItem('token', nextToken);
      setToken(nextToken);
      await loadUser(nextToken);
      setMessage(successMessage);
      return true;
    } catch (error) {
      localStorage.removeItem('token');
      setToken('');
      setUser(null);
      setMessage(getErrorMessage(error));
      return false;
    }
  }

  function logout() {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setMessage('已退出登录。');
  }

  React.useEffect(() => {
    if (!token) {
      setIsInitializing(false);
      return;
    }
    setIsInitializing(true);
    loadUser(token).catch(() => {
      localStorage.removeItem('token');
      setToken('');
      setUser(null);
    }).finally(() => setIsInitializing(false));
  }, [token]);

  const value = React.useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      isInitializing,
      message,
      login,
      register,
      acceptToken,
      logout,
      clearMessage: () => setMessage(''),
    }),
    [token, user, isInitializing, message],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
