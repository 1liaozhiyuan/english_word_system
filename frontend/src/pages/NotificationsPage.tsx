import React from 'react';
import { ArrowRight, Bell, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { getNotifications, markNotificationRead } from '../api/notifications';
import { useAuth } from '../auth/AuthContext';
import { LoadingState } from '../components/LoadingState';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { NotificationItem, NotificationSummary } from '../types';

export function NotificationsPage() {
  const { token } = useAuth();
  const [data, setData] = React.useState<NotificationSummary | null>(null);
  const [message, setMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);

  async function loadNotifications() {
    setIsLoading(true);
    setMessage('');
    try {
      setData(await getNotifications(token));
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRead(item: NotificationItem) {
    try {
      await markNotificationRead(token, item.id);
      await loadNotifications();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  React.useEffect(() => {
    loadNotifications();
  }, [token]);

  return (
    <>
      <PageHeader
        title="消息中心"
        description="根据真实学习任务、复习到期、错题和 AI 额度生成站内提醒。"
        action={<button className="button-secondary" onClick={loadNotifications} type="button">刷新</button>}
      />
      <Message tone="error">{message}</Message>
      {isLoading && <LoadingState text="正在同步消息..." />}
      {!isLoading && data && (
        <>
          <section className="dashboard-hero mb-5 rounded-lg p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--green)' }}>
                  <Bell size={18} />
                  未读消息
                </div>
                <h2 className="mt-2 text-4xl font-semibold">{data.unread_count}</h2>
              </div>
              <Link className="button-primary" to="/learning-settings">
                学习提醒设置
                <ArrowRight size={16} />
              </Link>
            </div>
          </section>
          <section className="surface rounded-lg p-5">
            <div className="grid gap-3">
              {data.items.map((item) => (
                <article className="rounded-lg border p-4" key={item.id} style={{ borderColor: item.read_at ? 'var(--line)' : 'var(--green)', background: 'var(--paper)' }}>
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{item.title}</h3>
                        {!item.read_at && <span className="chip" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>未读</span>}
                      </div>
                      <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>{item.content}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.action_url && <Link className="button-secondary" to={item.action_url}>去处理</Link>}
                      {!item.read_at && (
                        <button className="button-secondary" onClick={() => handleRead(item)} type="button">
                          <CheckCircle2 size={16} />
                          标记已读
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
              {data.items.length === 0 && (
                <div className="rounded-lg border p-5 text-center text-sm" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
                  暂无消息。产生复习、错题或提醒设置后，这里会自动生成真实提醒。
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
