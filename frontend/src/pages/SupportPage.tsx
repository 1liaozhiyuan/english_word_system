import React from 'react';
import { AlertTriangle, LifeBuoy, Send, Trash2 } from 'lucide-react';
import { deleteAccount } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { submitFeedback } from '../api/feedback';
import { useAuth } from '../auth/AuthContext';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';

export function SupportPage() {
  const { token, user, logout } = useAuth();
  const [form, setForm] = React.useState({ category: '学习问题', contact: user?.email ?? '', content: '' });
  const [password, setPassword] = React.useState('');
  const [confirmText, setConfirmText] = React.useState('');
  const [message, setMessage] = React.useState<{ text: string; tone: 'success' | 'error' | 'info' }>({ text: '', tone: 'info' });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleFeedback(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await submitFeedback(token, form);
      setForm({ ...form, content: '' });
      setMessage({ text: '反馈已提交，后台可以继续扩展为工单处理流程。', tone: 'success' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteAccount() {
    if (confirmText !== '删除账号') {
      setMessage({ text: '请输入“删除账号”确认这个不可逆操作。', tone: 'error' });
      return;
    }
    try {
      await deleteAccount(token, password);
      logout();
      setMessage({ text: '账号已注销。', tone: 'success' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    }
  }

  return (
    <>
      <PageHeader title="帮助与反馈" description="提供客服反馈、问题分类、联系方式和账号注销路径，补齐上架所需的用户支持入口。" />
      <Message tone={message.tone}>{message.text}</Message>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <form className="surface rounded-lg p-5" onSubmit={handleFeedback}>
          <div className="mb-4 flex items-center gap-2">
            <LifeBuoy size={22} style={{ color: 'var(--green)' }} />
            <h3 className="text-xl font-semibold">提交反馈</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <select className="input" onChange={(event) => setForm({ ...form, category: event.target.value })} value={form.category}>
              <option>学习问题</option>
              <option>AI 内容不准确</option>
              <option>词库纠错</option>
              <option>支付与会员</option>
              <option>账号与隐私</option>
              <option>其他建议</option>
            </select>
            <input className="input" onChange={(event) => setForm({ ...form, contact: event.target.value })} placeholder="联系方式" value={form.contact} />
          </div>
          <textarea
            className="input mt-3 min-h-[180px] py-3"
            onChange={(event) => setForm({ ...form, content: event.target.value })}
            placeholder="请描述你遇到的问题、错误单词、AI 回答异常或产品建议。"
            value={form.content}
          />
          <button className="button-primary mt-4" disabled={isSubmitting || form.content.trim().length < 5} type="submit">
            <Send size={16} />
            {isSubmitting ? '提交中...' : '提交反馈'}
          </button>
        </form>

        <aside className="surface rounded-lg p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={22} style={{ color: 'var(--red)' }} />
            <h3 className="text-xl font-semibold">注销账号</h3>
          </div>
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>
            注销后会删除当前账号、学习进度、错题、收藏、学习设置和反馈记录。词库公共内容不会被删除。
          </p>
          <div className="mt-4 grid gap-3">
            <input className="input" onChange={(event) => setPassword(event.target.value)} placeholder="当前账号密码" type="password" value={password} />
            <input className="input" onChange={(event) => setConfirmText(event.target.value)} placeholder="输入：删除账号" value={confirmText} />
            <button className="button-danger" disabled={!password || confirmText !== '删除账号'} onClick={handleDeleteAccount} type="button">
              <Trash2 size={16} />
              确认注销
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
