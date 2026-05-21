import React from 'react';
import { BookOpenCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { Message } from '../components/Message';

export function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [messageTone, setMessageTone] = React.useState<'success' | 'error' | 'warning' | 'info'>('success');
  const [sent, setSent] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [resetLink, setResetLink] = React.useState('');
  const [resetToken, setResetToken] = React.useState('');
  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      setMessage('请先填写注册邮箱。');
      setMessageTone('warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const data = await forgotPassword(email.trim());
      const link = `${window.location.origin}/reset-password?token=${encodeURIComponent(data.reset_token)}`;
      setResetLink(link);
      setResetToken(data.reset_token);
      setMessage('重置链接已生成。当前开发环境不会真正发送邮件，请使用下面的链接继续重置密码。');
      setMessageTone('success');
      setSent(true);
    } catch (error) {
      setMessage(getErrorMessage(error));
      setMessageTone('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell title="忘记密码" subtitle="输入注册邮箱获取重置链接">
      <Message tone={messageTone}>{message}</Message>
      {!sent ? (
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="text-sm font-bold">
            邮箱
            <input
              className="input mt-2"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button className="button-primary mt-2 w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? '发送中...' : '发送重置链接'}
          </button>
        </form>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border p-3 text-sm leading-6" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            <p className="font-bold">开发环境重置链接</p>
            <p className="mt-2 break-all" style={{ color: 'var(--muted)' }}>{resetLink}</p>
          </div>
          <button className="button-primary w-full" onClick={() => navigate(`/reset-password?token=${encodeURIComponent(resetToken)}`)} type="button">
            前往重置密码
          </button>
        </div>
      )}
      <p className="mt-5 text-center text-sm" style={{ color: 'var(--muted)' }}>
        <Link className="font-bold" style={{ color: 'var(--green)' }} to="/login">返回登录</Link>
      </p>
    </AuthShell>
  );
}

import { AuthShell } from './LoginPage';
