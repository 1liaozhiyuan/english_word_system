import React from 'react';
import { BookOpenCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { Message } from '../components/Message';

export function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const data = await forgotPassword(email);
      setMessage(`重置令牌已生成：${data.reset_token}\n（在正式环境中，这会通过邮件发送。请复制令牌前往重置密码页面。）`);
      setSent(true);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <AuthShell title="忘记密码" subtitle="输入注册邮箱获取重置链接">
      <Message>{message}</Message>
      {!sent ? (
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
          <button className="button-primary mt-2 w-full" type="submit">
            发送重置链接
          </button>
        </form>
      ) : (
        <div className="mt-4 space-y-3">
          <button className="button-primary w-full" onClick={() => navigate('/reset-password')}>
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
