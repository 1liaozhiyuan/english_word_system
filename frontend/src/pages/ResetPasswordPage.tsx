import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Message } from '../components/Message';
import { AuthShell } from './LoginPage';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = React.useState(searchParams.get('token') ?? '');
  const [password, setPassword] = React.useState('');
  const [message, setMessage] = React.useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const data = await resetPassword(token, password);
      setMessage('密码已重置。正在登录...');
      localStorage.setItem('token', data.access_token);
      navigate('/dashboard');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <AuthShell title="重置密码" subtitle="输入重置令牌和新密码">
      <Message>{message}</Message>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="text-sm font-bold">
          重置令牌
          <input
            className="input mt-2"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="粘贴重置令牌"
          />
        </label>
        <label className="text-sm font-bold">
          新密码
          <input
            className="input mt-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="至少 6 位"
          />
        </label>
        <button className="button-primary mt-2 w-full" type="submit">
          重置密码
        </button>
      </form>
      <p className="mt-5 text-center text-sm" style={{ color: 'var(--muted)' }}>
        <Link className="font-bold" style={{ color: 'var(--green)' }} to="/login">返回登录</Link>
      </p>
    </AuthShell>
  );
}
