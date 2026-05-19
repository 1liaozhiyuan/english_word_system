import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Message } from '../components/Message';
import { AuthShell } from './LoginPage';

export function RegisterPage() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const { register, message } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (await register(email, password)) {
      navigate('/dashboard');
    }
  }

  return (
    <AuthShell title="创建账号" subtitle="注册后系统会开始记录你的背词进度">
      <Message>{message}</Message>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="text-sm font-bold">
          邮箱
          <input
            className="input mt-2"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label className="text-sm font-bold">
          密码
          <input
            className="input mt-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="至少 6 位"
          />
        </label>
        <button className="button-primary mt-2 w-full" type="submit">
          注册
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-[#6b6a62]">
        已有账号？ <Link className="font-bold text-[#263c2a]" to="/login">去登录</Link>
      </p>
    </AuthShell>
  );
}
