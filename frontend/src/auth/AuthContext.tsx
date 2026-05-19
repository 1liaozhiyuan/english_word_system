import React from 'react';
import { getMe, login as loginApi, register as registerApi } from '../api/auth';
import { getErrorMessage } from '../api/client';
import type { User } from '../types';

type AuthContextValue = {
  token: string;
  user: User | null;
  isAuthenticated: boolean;
  message: string;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearMessage: () => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState(localStorage.getItem('token') ?? '');
  const [user, setUser] = React.useState<User | null>(null);
  const [message, setMessage] = React.useState('');

  async function loadUser(nextToken: string) {
    const currentUser = await getMe(nextToken);
    setUser(currentUser);
  }

  async function login(email: string, password: string) {
    try {
      const data = await loginApi(email, password);
      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      await loadUser(data.access_token);
      setMessage('登录成功。');
      return true;
    } catch (error) {
      setMessage(getErrorMessage(error));
      return false;
    }
  }

  async function register(email: string, password: string) {
    try {
      const data = await registerApi(email, password);
      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      await loadUser(data.access_token);
      setMessage('注册成功。');
      return true;
    } catch (error) {
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
    if (!token) return;
    loadUser(token).catch(() => {
      localStorage.removeItem('token');
      setToken('');
      setUser(null);
    });
  }, [token]);

  const value = React.useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      message,
      login,
      register,
      logout,
      clearMessage: () => setMessage(''),
    }),
    [token, user, message],
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
