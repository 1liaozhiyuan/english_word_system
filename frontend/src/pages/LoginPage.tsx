import React from 'react';
import { BookOpenCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Message } from '../components/Message';

export function LoginPage() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const { login, message } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (await login(email, password)) {
      navigate('/dashboard');
    }
  }

  return (
    <AuthShell title="欢迎回来" subtitle="登录后继续你的单词学习进度">
      <Message>{message}</Message>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="text-sm font-bold">
          邮箱
          <input className="input mt-2" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="text-sm font-bold">
          密码
          <input
            className="input mt-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="button-primary mt-2 w-full" type="submit">
          登录
        </button>
      </form>
      <p className="mt-3 text-center text-sm" style={{ color: 'var(--muted)' }}>
        <Link className="font-bold" style={{ color: 'var(--green)' }} to="/forgot-password">忘记密码？</Link>
      </p>
      <p className="mt-2 text-center text-sm" style={{ color: 'var(--muted)' }}>
        还没有账号？ <Link className="font-bold" style={{ color: 'var(--green)' }} to="/register">创建账号</Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-5 py-8">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-[#ddd7c7] bg-[#fffdf8] shadow-[0_24px_80px_rgba(47,43,34,0.12)] md:grid-cols-[1fr_420px]">
        <div className="hidden bg-[#263c2a] p-8 text-white md:flex md:flex-col md:justify-between">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/12">
              <BookOpenCheck size={25} />
            </div>
            <h1 className="mt-8 text-4xl font-semibold tracking-normal">English Word System</h1>
            <p className="mt-4 max-w-sm leading-7 text-white/78">
              用清晰的学习流程、错词记录和间隔复习，把每天的单词任务变得可控。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-white/10 p-3">
              <strong className="block text-lg">10</strong>
              starter words
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <strong className="block text-lg">4</strong>
              review levels
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <strong className="block text-lg">1</strong>
              daily flow
            </div>
          </div>
        </div>
        <div className="p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b6a62]">Vocabulary</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal">{title}</h2>
          <p className="mb-6 mt-2 text-sm text-[#6b6a62]">{subtitle}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
