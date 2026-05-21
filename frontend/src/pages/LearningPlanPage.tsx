import React from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Library, Route, Settings, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { getLearningPlan } from '../api/learningPlan';
import { useAuth } from '../auth/AuthContext';
import { LoadingState } from '../components/LoadingState';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { LearningPlan } from '../types';

export function LearningPlanPage() {
  const { token } = useAuth();
  const [plan, setPlan] = React.useState<LearningPlan | null>(null);
  const [message, setMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);

  async function loadPlan() {
    setIsLoading(true);
    setMessage('');
    try {
      setPlan(await getLearningPlan(token));
    } catch (error) {
      setMessage(getErrorMessage(error));
      setPlan(null);
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    loadPlan();
  }, [token]);

  return (
    <>
      <PageHeader
        title="学习计划"
        description="根据目标日期、每日任务、当前词库进度和复习积压，动态评估计划风险。"
        action={(
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/onboarding">
              <Target size={16} />
              目标引导
            </Link>
            <Link className="button-secondary" to="/learning-settings">
              <Settings size={16} />
              学习设置
            </Link>
          </div>
        )}
      />

      <Message tone="error">{message}</Message>
      {isLoading && <LoadingState text="正在生成学习计划..." />}

      {!isLoading && plan && (
        <>
          <section className="dashboard-hero mb-5 rounded-lg p-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip" style={{ background: riskStyle(plan.risk_level).background, color: riskStyle(plan.risk_level).color }}>
                    {riskLabel(plan.risk_level)}
                  </span>
                  <span className="chip" style={{ background: 'var(--panel)', color: 'var(--muted)' }}>
                    {plan.learning_goal ?? '未设置目标'}
                  </span>
                </div>
                <h2 className="mt-4 text-4xl font-semibold tracking-normal">
                  {plan.overall_completion_rate}% 总体进度
                </h2>
                <p className="mt-3 max-w-2xl leading-7" style={{ color: 'var(--muted)' }}>
                  {plan.risk_message}
                </p>
                <div className="mt-5 h-3 max-w-2xl overflow-hidden rounded-full" style={{ background: 'var(--panel)' }}>
                  <div className="h-full rounded-full" style={{ width: `${plan.overall_completion_rate}%`, background: 'var(--green)' }} />
                </div>
              </div>

              <div className="rounded-lg border p-5" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                <div className="flex items-center gap-2 font-semibold">
                  <CalendarDays size={18} style={{ color: 'var(--green)' }} />
                  目标时间
                </div>
                <div className="mt-4 grid gap-3">
                  <PlanMetric label="目标日期" value={plan.target_date ?? '未设置'} />
                  <PlanMetric label="剩余天数" value={plan.days_left === null ? '未知' : `${plan.days_left} 天`} />
                  <PlanMetric label="预计完成" value={plan.estimated_finish_days === null ? '暂无词库' : `${plan.estimated_finish_days} 天`} />
                </div>
              </div>
            </div>
          </section>

          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PlanCard icon={<Library size={20} />} label="计划单词" value={plan.total_words} />
            <PlanCard icon={<CheckCircle2 size={20} />} label="已学习" value={plan.studied_words} />
            <PlanCard icon={<Target size={20} />} label="已掌握" value={plan.mastered_words} />
            <PlanCard icon={<Route size={20} />} label="剩余" value={plan.remaining_words} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="surface rounded-lg p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold">当前词库</h3>
                <Link className="button-secondary" to="/word-books">管理词库</Link>
              </div>
              <div className="grid gap-3">
                {plan.current_books.map((book) => (
                  <article className="rounded-lg border p-4" key={book.id} style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h4 className="text-lg font-semibold">{book.title}</h4>
                        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                          {book.category} · {book.difficulty} · {book.studied_count}/{book.word_count} 已学习
                        </p>
                      </div>
                      <span className="text-xl font-semibold" style={{ color: 'var(--green)' }}>{book.completion_rate}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--panel)' }}>
                      <div className="h-full rounded-full" style={{ width: `${book.completion_rate}%`, background: 'var(--green)' }} />
                    </div>
                  </article>
                ))}
                {plan.current_books.length === 0 && (
                  <div className="rounded-lg border p-5 text-center text-sm" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
                    还没有加入学习词库。请先选择一本词库生成计划。
                  </div>
                )}
              </div>
            </div>

            <aside className="grid content-start gap-5">
              <section className="surface rounded-lg p-5">
                <h3 className="text-xl font-semibold">每日任务</h3>
                <div className="mt-4 grid gap-3">
                  <PlanMetric label="每日学习时间" value={`${plan.daily_minutes} 分钟`} />
                  <PlanMetric label="每日新词" value={`${plan.daily_new_limit} 个`} />
                  <PlanMetric label="每日复习" value={`${plan.daily_review_limit} 个`} />
                  <PlanMetric label="今日完成率" value={`${plan.today_completion_rate}%`} />
                </div>
              </section>
              <section className="surface rounded-lg p-5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={20} style={{ color: riskStyle(plan.risk_level).color }} />
                  <h3 className="text-xl font-semibold">调整建议</h3>
                </div>
                <p className="mt-3 text-sm leading-7" style={{ color: 'var(--muted)' }}>
                  {plan.recommended_daily_new_limit !== plan.daily_new_limit
                    ? `建议把每日新词调整到 ${plan.recommended_daily_new_limit} 个左右，以匹配目标日期。`
                    : '当前每日新词量与目标基本匹配，可以继续保持。'}
                </p>
                <Link className="button-primary mt-4 w-full" to="/learning-settings">
                  <Clock size={16} />
                  调整每日节奏
                </Link>
              </section>
            </aside>
          </section>
        </>
      )}
    </>
  );
}

function PlanCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="surface rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>{label}</span>
        <span style={{ color: 'var(--green)' }}>{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-4 py-3" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function riskLabel(level: LearningPlan['risk_level']) {
  if (level === 'setup') return '需要设置';
  if (level === 'high') return '高风险';
  if (level === 'medium') return '需关注';
  return '健康';
}

function riskStyle(level: LearningPlan['risk_level']) {
  if (level === 'high') return { color: 'var(--red)', background: 'var(--red-soft)' };
  if (level === 'medium') return { color: 'var(--amber)', background: 'var(--amber-soft)' };
  return { color: 'var(--green)', background: 'var(--green-soft)' };
}
