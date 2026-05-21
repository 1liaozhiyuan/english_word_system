import React from 'react';
import { Bot, CheckCircle2, Crown, FileText, Mic, ReceiptText, ShieldCheck, Sparkles } from 'lucide-react';
import {
  demoPayMembershipOrder,
  getMembershipOrders,
  getMembershipPlans,
  getMembershipStatus,
} from '../api/membership';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { MembershipOrder, MembershipPlan, MembershipStatus } from '../types';

const benefits = [
  ['更高 AI 单词解释额度', Bot],
  ['AI 错因分析', Sparkles],
  ['AI 口语陪练', Mic],
  ['AI 作文批改', FileText],
  ['高级学习报告', ShieldCheck],
];

export function MembershipPage() {
  const { token } = useAuth();
  const [status, setStatus] = React.useState<MembershipStatus | null>(null);
  const [plans, setPlans] = React.useState<MembershipPlan[]>([]);
  const [orders, setOrders] = React.useState<MembershipOrder[]>([]);
  const [message, setMessage] = React.useState<{ text: string; tone: 'success' | 'error' | 'info' }>({ text: '', tone: 'info' });
  const [isLoading, setIsLoading] = React.useState(true);
  const [payingPlanId, setPayingPlanId] = React.useState<number | null>(null);

  async function loadData() {
    setIsLoading(true);
    try {
      const [nextStatus, nextPlans, nextOrders] = await Promise.all([
        getMembershipStatus(token),
        getMembershipPlans(token),
        getMembershipOrders(token),
      ]);
      setStatus(nextStatus);
      setPlans(nextPlans);
      setOrders(nextOrders);
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDemoPay(planId: number) {
    setPayingPlanId(planId);
    try {
      await demoPayMembershipOrder(token, planId);
      const [nextStatus, nextOrders] = await Promise.all([
        getMembershipStatus(token),
        getMembershipOrders(token),
      ]);
      setStatus(nextStatus);
      setOrders(nextOrders);
      setMessage({ text: '已生成演示支付订单，并开通对应会员权益。', tone: 'success' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setPayingPlanId(null);
    }
  }

  React.useEffect(() => {
    loadData();
  }, [token]);

  return (
    <>
      <PageHeader
        title="会员中心"
        description="会员套餐、订单记录和 AI 额度全部来自数据库，便于后续接入真实内购或第三方支付。"
        action={<button className="button-secondary" onClick={loadData} type="button">刷新</button>}
      />
      <Message tone={message.tone}>{message.text}</Message>

      <section className="surface mb-5 rounded-lg p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_300px] lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Crown size={23} style={{ color: 'var(--green)' }} />
              <h3 className="text-2xl font-semibold">{status?.is_member ? '当前为 Pro 会员' : '当前为免费用户'}</h3>
            </div>
            <p className="mt-3 text-sm leading-7" style={{ color: 'var(--muted)' }}>
              免费用户保留基础学习和有限 AI 次数。开通会员后可获得更高 AI 额度、高级报告、错因分析和后续口语写作能力。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip">会员等级：{status?.tier ?? 'free'}</span>
              <span className="chip">到期时间：{status?.expires_at ? formatDate(status.expires_at) : '未开通'}</span>
            </div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
            <div className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>今日 AI 剩余额度</div>
            <div className="mt-2 text-4xl font-semibold" style={{ color: 'var(--green)' }}>
              {isLoading ? '-' : status?.ai_remaining_today ?? 0}
              <span className="text-base" style={{ color: 'var(--muted)' }}> / {status?.daily_ai_limit ?? 5}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <article className="surface flex min-h-[260px] flex-col rounded-lg p-5" key={plan.id}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">{plan.name}</h3>
              {plan.is_recommended && <span className="chip" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>推荐</span>}
            </div>
            <p className="mt-3 flex-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>{plan.description}</p>
            <div className="mt-5 flex items-end gap-2">
              <span className="text-4xl font-semibold">{formatMoney(plan.price_cents)}</span>
              <span className="pb-1 text-sm" style={{ color: 'var(--muted)' }}>{plan.duration_days} 天 · {plan.ai_daily_limit} 次/日</span>
            </div>
            <button
              className={plan.is_recommended ? 'button-primary mt-5 w-full' : 'button-secondary mt-5 w-full'}
              disabled={payingPlanId === plan.id}
              onClick={() => handleDemoPay(plan.id)}
              type="button"
            >
              <Crown size={16} />
              {payingPlanId === plan.id ? '正在处理...' : '演示支付并开通'}
            </button>
          </article>
        ))}
      </section>

      <section className="surface mt-5 rounded-lg p-5">
        <div className="flex items-center gap-2">
          <ReceiptText size={21} style={{ color: 'var(--green)' }} />
          <h3 className="text-xl font-semibold">订单记录</h3>
        </div>
        <div className="mt-4 grid gap-3">
          {orders.map((order) => (
            <article className="rounded-lg border p-4" key={order.id} style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div>
                  <h4 className="font-semibold">{order.plan_name}</h4>
                  <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                    {order.order_no} · {formatDate(order.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="chip">{formatMoney(order.amount_cents)}</span>
                  <span className="chip">{order.status === 'paid' ? '已支付' : order.status}</span>
                </div>
              </div>
            </article>
          ))}
          {orders.length === 0 && <div className="rounded-lg border p-5 text-center text-sm" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>暂无订单记录。</div>}
        </div>
      </section>

      <section className="surface mt-5 rounded-lg p-5">
        <h3 className="text-xl font-semibold">会员权益</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map(([label, Icon]) => (
            <div className="rounded-lg border p-4" key={label as string} style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
              <Icon size={22} style={{ color: 'var(--green)' }} />
              <div className="mt-3 font-semibold">{label as string}</div>
              <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>免费用户保留基础能力，会员解锁更高额度和更深度的学习反馈。</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface mt-5 rounded-lg p-5">
        <h3 className="text-xl font-semibold">订阅与审核信息</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {['价格、权益和试用说明需在支付前清晰展示', '自动续费需展示取消订阅路径', '上架审核时内购项目需可见、可测试', '已购买用户可使用恢复购买入口'].map((item) => (
            <div className="flex items-start gap-2 text-sm leading-6" key={item} style={{ color: 'var(--muted)' }}>
              <CheckCircle2 className="mt-0.5 shrink-0" size={17} style={{ color: 'var(--green)' }} />
              {item}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function formatMoney(value: number) {
  return `¥${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
