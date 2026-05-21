import React from 'react';
import { Activity, BookOpen, Bot, ClipboardList, ReceiptText, Search, Users } from 'lucide-react';
import {
  getAdminAIUsage,
  getAdminContentReports,
  getAdminFeedback,
  getAdminMembershipPlans,
  getAdminOperationLogs,
  getAdminOrders,
  getAdminOverview,
  getAdminUsers,
  getAdminWordBooks,
  updateAdminFeedbackStatus,
  updateAdminContentReport,
  updateAdminUserRole,
  type AdminAIUsageResponse,
  type AdminFeedback,
  type AdminOperationLog,
  type AdminOverview,
  type AdminUser,
} from '../api/admin';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { ContentReport, MembershipOrder, MembershipPlan, WordBook } from '../types';

type TabKey = 'users' | 'books' | 'feedback' | 'content' | 'ai' | 'orders' | 'logs';

export function AdminPage() {
  const { token } = useAuth();
  const [overview, setOverview] = React.useState<AdminOverview | null>(null);
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [books, setBooks] = React.useState<WordBook[]>([]);
  const [feedback, setFeedback] = React.useState<AdminFeedback[]>([]);
  const [contentReports, setContentReports] = React.useState<ContentReport[]>([]);
  const [aiUsage, setAiUsage] = React.useState<AdminAIUsageResponse | null>(null);
  const [operationLogs, setOperationLogs] = React.useState<AdminOperationLog[]>([]);
  const [orders, setOrders] = React.useState<MembershipOrder[]>([]);
  const [plans, setPlans] = React.useState<MembershipPlan[]>([]);
  const [tab, setTab] = React.useState<TabKey>('users');
  const [query, setQuery] = React.useState('');
  const [feedbackStatus, setFeedbackStatus] = React.useState('all');
  const [contentStatus, setContentStatus] = React.useState('all');
  const [message, setMessage] = React.useState<{ text: string; tone: 'success' | 'error' | 'info' }>({ text: '', tone: 'info' });
  const [isLoading, setIsLoading] = React.useState(true);

  async function loadAdminData() {
    setIsLoading(true);
    try {
      const [nextOverview, nextUsers, nextBooks, nextFeedback, nextContent, nextAiUsage, nextLogs, nextOrders, nextPlans] = await Promise.all([
        getAdminOverview(token),
        getAdminUsers(token, query),
        getAdminWordBooks(token, query),
        getAdminFeedback(token, feedbackStatus),
        getAdminContentReports(token, contentStatus),
        getAdminAIUsage(token),
        getAdminOperationLogs(token),
        getAdminOrders(token),
        getAdminMembershipPlans(token),
      ]);
      setOverview(nextOverview);
      setUsers(nextUsers.items);
      setBooks(nextBooks.items);
      setFeedback(nextFeedback.items);
      setContentReports(nextContent.items);
      setAiUsage(nextAiUsage);
      setOperationLogs(nextLogs.items);
      setOrders(nextOrders.items);
      setPlans(nextPlans);
      setMessage({ text: '', tone: 'info' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFeedbackStatus(feedbackId: number, status: string) {
    try {
      await updateAdminFeedbackStatus(token, feedbackId, status);
      setMessage({ text: '反馈状态已更新。', tone: 'success' });
      await loadAdminData();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    }
  }

  async function handleUserRole(userId: number, role: AdminUser['role']) {
    try {
      await updateAdminUserRole(token, userId, role);
      setMessage({ text: '用户角色已更新。', tone: 'success' });
      await loadAdminData();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    }
  }

  async function handleContentStatus(reportId: number, status: string) {
    try {
      await updateAdminContentReport(token, reportId, { status, review_note: status === 'resolved' ? '已处理' : null });
      setMessage({ text: '内容审核状态已更新。', tone: 'success' });
      await loadAdminData();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    }
  }

  React.useEffect(() => {
    loadAdminData();
  }, [token, query, feedbackStatus, contentStatus]);

  return (
    <>
      <PageHeader
        title="运营后台"
        description="查看用户、词库、反馈工单、AI 使用记录、会员订单和操作日志，所有指标均来自数据库。"
        action={<button className="button-secondary" onClick={loadAdminData} type="button">刷新数据</button>}
      />
      <Message tone={message.tone}>{message.text}</Message>

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-9">
        <AdminMetric label="真实用户" value={overview?.users ?? 0} icon={<Users size={18} />} />
        <AdminMetric label="测试账号" value={overview?.demo_users ?? 0} icon={<Users size={18} />} />
        <AdminMetric label="会员" value={overview?.members ?? 0} icon={<Users size={18} />} />
        <AdminMetric label="订单" value={overview?.paid_orders ?? 0} icon={<ReceiptText size={18} />} />
        <AdminMetric label="收入" value={formatMoney(overview?.paid_revenue_cents ?? 0)} icon={<ReceiptText size={18} />} />
        <AdminMetric label="词库" value={overview?.word_books ?? 0} icon={<BookOpen size={18} />} />
        <AdminMetric label="单词" value={overview?.words ?? 0} icon={<BookOpen size={18} />} />
        <AdminMetric label="练习" value={overview?.reviews ?? 0} icon={<Activity size={18} />} />
        <AdminMetric label="待审核" value={overview?.content_reports_open ?? 0} icon={<ClipboardList size={18} />} />
        <AdminMetric label="今日 AI" value={overview?.ai_today ?? 0} icon={<Bot size={18} />} />
      </section>

      <section className="surface mb-5 rounded-lg p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: 'var(--muted)' }} />
            <input
              className="input pl-10"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索用户邮箱或词库"
              value={query}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <TabButton active={tab === 'users'} icon={<Users size={16} />} label="用户" onClick={() => setTab('users')} />
            <TabButton active={tab === 'books'} icon={<BookOpen size={16} />} label="词库" onClick={() => setTab('books')} />
            <TabButton active={tab === 'feedback'} icon={<ClipboardList size={16} />} label="反馈" onClick={() => setTab('feedback')} />
            <TabButton active={tab === 'content'} icon={<ClipboardList size={16} />} label="审核" onClick={() => setTab('content')} />
            <TabButton active={tab === 'ai'} icon={<Bot size={16} />} label="AI" onClick={() => setTab('ai')} />
            <TabButton active={tab === 'orders'} icon={<ReceiptText size={16} />} label="订单" onClick={() => setTab('orders')} />
            <TabButton active={tab === 'logs'} icon={<Activity size={16} />} label="日志" onClick={() => setTab('logs')} />
          </div>
        </div>
      </section>

      {isLoading && <section className="surface rounded-lg p-5 text-sm" style={{ color: 'var(--muted)' }}>正在加载后台数据...</section>}

      {!isLoading && tab === 'users' && <UsersPanel users={users} onRoleChange={handleUserRole} />}
      {!isLoading && tab === 'books' && <BooksPanel books={books} />}
      {!isLoading && tab === 'feedback' && (
        <FeedbackPanel
          feedback={feedback}
          statusFilter={feedbackStatus}
          onStatusFilterChange={setFeedbackStatus}
          onUpdateStatus={handleFeedbackStatus}
        />
      )}
      {!isLoading && tab === 'content' && (
        <ContentReportsPanel
          reports={contentReports}
          statusFilter={contentStatus}
          onStatusFilterChange={setContentStatus}
          onUpdateStatus={handleContentStatus}
        />
      )}
      {!isLoading && tab === 'ai' && <AIUsagePanel usage={aiUsage} />}
      {!isLoading && tab === 'orders' && <OrdersPanel orders={orders} plans={plans} />}
      {!isLoading && tab === 'logs' && <OperationLogsPanel logs={operationLogs} />}
    </>
  );
}

function AdminMetric({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="surface rounded-lg p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>{label}</span>
        <span style={{ color: 'var(--green)' }}>{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={active ? 'button-primary' : 'button-secondary'} onClick={onClick} type="button">
      {icon}
      {label}
    </button>
  );
}

function UsersPanel({ users, onRoleChange }: { users: AdminUser[]; onRoleChange: (userId: number, role: AdminUser['role']) => void }) {
  return (
    <Panel title="用户运营">
      <div className="grid gap-3">
        {users.map((user) => (
          <RowCard key={user.id}>
            <div>
              <h3 className="font-semibold">{user.email}</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                注册：{formatDate(user.created_at)} · 目标：{user.learning_goal ?? '未设置'}
              </p>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-5">
              <Mini label="角色" value={roleLabel(user.role)} />
              <Mini label="会员" value={user.membership_tier} />
              <Mini label="学习词" value={user.progress_count} />
              <Mini label="练习" value={user.review_count} />
              <Mini label="反馈" value={user.feedback_count} />
            </div>
            <select className="input w-auto" onChange={(event) => onRoleChange(user.id, event.target.value as AdminUser['role'])} value={user.role}>
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
              <option value="operator">内容运营</option>
              <option value="reviewer">审核人员</option>
            </select>
          </RowCard>
        ))}
        {users.length === 0 && <EmptyText text="暂无用户数据。" />}
      </div>
    </Panel>
  );
}

function BooksPanel({ books }: { books: WordBook[] }) {
  return (
    <Panel title="词库内容">
      <div className="grid gap-3">
        {books.map((book) => (
          <RowCard key={book.id}>
            <div>
              <h3 className="font-semibold">{book.title}</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                {book.category} · {book.difficulty} · {book.description || '无描述'}
              </p>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Mini label="单词数" value={book.word_count} />
              <Mini label="ID" value={book.id} />
            </div>
          </RowCard>
        ))}
        {books.length === 0 && <EmptyText text="暂无词库数据。" />}
      </div>
    </Panel>
  );
}

function FeedbackPanel({
  feedback,
  statusFilter,
  onStatusFilterChange,
  onUpdateStatus,
}: {
  feedback: AdminFeedback[];
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onUpdateStatus: (feedbackId: number, status: string) => void;
}) {
  return (
    <Panel
      title="反馈工单"
      action={(
        <select className="input w-auto" onChange={(event) => onStatusFilterChange(event.target.value)} value={statusFilter}>
          <option value="all">全部</option>
          <option value="open">待处理</option>
          <option value="processing">处理中</option>
          <option value="closed">已关闭</option>
        </select>
      )}
    >
      <div className="grid gap-3">
        {feedback.map((item) => (
          <RowCard key={item.id}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{item.category}</h3>
                <span className="chip" style={{ background: 'var(--panel)', color: 'var(--muted)' }}>{statusLabel(item.status)}</span>
              </div>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>{item.content}</p>
              <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                {item.user_email} · {item.contact || '无联系方式'} · {formatDate(item.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="button-secondary" onClick={() => onUpdateStatus(item.id, 'processing')} type="button">处理中</button>
              <button className="button-secondary" onClick={() => onUpdateStatus(item.id, 'closed')} type="button">关闭</button>
            </div>
          </RowCard>
        ))}
        {feedback.length === 0 && <EmptyText text="暂无反馈工单。" />}
      </div>
    </Panel>
  );
}

function ContentReportsPanel({
  reports,
  statusFilter,
  onStatusFilterChange,
  onUpdateStatus,
}: {
  reports: ContentReport[];
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onUpdateStatus: (reportId: number, status: string) => void;
}) {
  return (
    <Panel
      title="内容审核"
      action={(
        <select className="input w-auto" onChange={(event) => onStatusFilterChange(event.target.value)} value={statusFilter}>
          <option value="all">全部</option>
          <option value="open">待审核</option>
          <option value="reviewing">审核中</option>
          <option value="resolved">已处理</option>
          <option value="rejected">已驳回</option>
        </select>
      )}
    >
      <div className="grid gap-3">
        {reports.map((item) => (
          <RowCard key={item.id}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{item.source_type} · {item.reason}</h3>
                <span className="chip" style={{ background: 'var(--panel)', color: 'var(--muted)' }}>{contentStatusLabel(item.status)}</span>
              </div>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>{item.content}</p>
              <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                {item.user_email ?? `用户 ${item.user_id}`} · {formatDate(item.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="button-secondary" onClick={() => onUpdateStatus(item.id, 'reviewing')} type="button">审核中</button>
              <button className="button-secondary" onClick={() => onUpdateStatus(item.id, 'resolved')} type="button">已处理</button>
              <button className="button-secondary" onClick={() => onUpdateStatus(item.id, 'rejected')} type="button">驳回</button>
            </div>
          </RowCard>
        ))}
        {reports.length === 0 && <EmptyText text="暂无内容审核记录。" />}
      </div>
    </Panel>
  );
}

function AIUsagePanel({ usage }: { usage: AdminAIUsageResponse | null }) {
  return (
    <Panel title="AI 使用记录">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(usage?.feature_summary ?? []).map((item) => <Mini key={item.feature} label={item.feature} value={item.count} />)}
      </div>
      <div className="grid gap-3">
        {(usage?.items ?? []).map((item) => (
          <RowCard key={item.id}>
            <div>
              <h3 className="font-semibold">{item.feature}</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{item.user_email} · {formatDate(item.created_at)}</p>
            </div>
          </RowCard>
        ))}
        {(usage?.items.length ?? 0) === 0 && <EmptyText text="暂无 AI 使用记录。" />}
      </div>
    </Panel>
  );
}

function OrdersPanel({ orders, plans }: { orders: MembershipOrder[]; plans: MembershipPlan[] }) {
  return (
    <Panel title="订单与会员套餐">
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {plans.map((plan) => (
          <Mini
            key={plan.id}
            label={plan.is_recommended ? `${plan.name} · 推荐` : plan.name}
            value={`${formatMoney(plan.price_cents)} / ${plan.duration_days} 天`}
          />
        ))}
      </div>
      <div className="grid gap-3">
        {orders.map((order) => (
          <RowCard key={order.id}>
            <div>
              <h3 className="font-semibold">{order.plan_name}</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                {order.order_no} · {order.user_email ?? `用户 ${order.user_id}`} · {formatDate(order.created_at)}
              </p>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <Mini label="金额" value={formatMoney(order.amount_cents)} />
              <Mini label="状态" value={order.status === 'paid' ? '已支付' : order.status} />
              <Mini label="支付时间" value={order.paid_at ? formatDate(order.paid_at) : '-'} />
            </div>
          </RowCard>
        ))}
        {orders.length === 0 && <EmptyText text="暂无订单记录。" />}
      </div>
    </Panel>
  );
}

function OperationLogsPanel({ logs }: { logs: AdminOperationLog[] }) {
  return (
    <Panel title="操作日志">
      <div className="grid gap-3">
        {logs.map((item) => (
          <RowCard key={item.id}>
            <div>
              <h3 className="font-semibold">{item.action}</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                {item.actor_email ?? `用户 ${item.actor_user_id}`} · {item.target_type ?? 'system'} #{item.target_id ?? '-'} · {formatDate(item.created_at)}
              </p>
              {item.detail && <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>{item.detail}</p>}
            </div>
          </RowCard>
        ))}
        {logs.length === 0 && <EmptyText text="暂无操作日志。" />}
      </div>
    </Panel>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="surface rounded-lg p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function RowCard({ children }: { children: React.ReactNode }) {
  return (
    <article className="rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">{children}</div>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <div className="rounded-lg border p-5 text-center text-sm" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>{text}</div>;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatMoney(value: number) {
  return `¥${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}`;
}

function statusLabel(value: string) {
  if (value === 'processing') return '处理中';
  if (value === 'closed') return '已关闭';
  return '待处理';
}

function contentStatusLabel(value: string) {
  if (value === 'reviewing') return '审核中';
  if (value === 'resolved') return '已处理';
  if (value === 'rejected') return '已驳回';
  return '待审核';
}

function roleLabel(value: AdminUser['role']) {
  if (value === 'admin') return '管理员';
  if (value === 'operator') return '内容运营';
  if (value === 'reviewer') return '审核人员';
  return '普通用户';
}
