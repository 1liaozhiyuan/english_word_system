import React from 'react';
import { Award, CalendarCheck, CheckCircle2, Flame, RotateCcw, Target, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCheckInStatus } from '../api/checkIn';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { LoadingState } from '../components/LoadingState';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { CheckInBadge, CheckInStatus } from '../types';

export function CheckInPage() {
  const { token } = useAuth();
  const [status, setStatus] = React.useState<CheckInStatus | null>(null);
  const [message, setMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);

  async function loadStatus() {
    setIsLoading(true);
    setMessage('');
    try {
      setStatus(await getCheckInStatus(token));
    } catch (error) {
      setStatus(null);
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    loadStatus();
  }, [token]);

  return (
    <>
      <PageHeader
        title="打卡与激励"
        description="根据真实学习记录计算今日打卡、连续学习、活跃天数和成就徽章。"
      />
      <Message tone="error">{message}</Message>
      {isLoading && <LoadingState text="正在读取打卡数据..." />}

      {!isLoading && status && (
        <>
          <section className="dashboard-hero mb-5 rounded-lg p-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip" style={{ background: status.checked_in_today ? 'var(--green-soft)' : 'var(--amber-soft)', color: status.checked_in_today ? 'var(--green)' : 'var(--amber)' }}>
                    {status.checked_in_today ? '今日已学习' : '今日未学习'}
                  </span>
                  <span className="chip" style={{ background: 'var(--panel)', color: 'var(--muted)' }}>
                    剩余 {status.remaining_tasks} 个任务
                  </span>
                </div>
                <h2 className="mt-4 text-4xl font-semibold tracking-normal">
                  连续学习 {status.streak_days} 天
                </h2>
                <p className="mt-3 max-w-2xl leading-7" style={{ color: 'var(--muted)' }}>
                  {status.can_check_in
                    ? '今天的学习任务已经清空，可以保持当前节奏。'
                    : status.checked_in_today
                      ? '今天已经产生学习记录，继续完成剩余任务就能清空今日计划。'
                      : '今天还没有学习记录，完成一次新词或复习后会自动计入今日打卡。'}
                </p>
                <div className="mt-5 h-3 max-w-2xl overflow-hidden rounded-full" style={{ background: 'var(--panel)' }}>
                  <div className="h-full rounded-full" style={{ width: `${status.today_progress_rate}%`, background: 'var(--green)' }} />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link className="button-primary" to={status.remaining_tasks > 0 ? '/review' : '/study'}>
                    <CalendarCheck size={16} />
                    继续学习
                  </Link>
                  <Link className="button-secondary" to="/stats">
                    查看统计
                  </Link>
                </div>
              </div>

              <div className="rounded-lg border p-5" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                <div className="flex items-center gap-2 font-semibold">
                  <Trophy size={18} style={{ color: 'var(--green)' }} />
                  真实数据
                </div>
                <div className="mt-4 grid gap-3">
                  <Metric label="今日完成" value={`${status.completed_today} 次`} />
                  <Metric label="30 天活跃" value={`${status.active_days_30} 天`} />
                  <Metric label="累计学习日" value={`${status.total_learning_days} 天`} />
                </div>
              </div>
            </div>
          </section>

          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={<RotateCcw size={20} />} label="累计练习" value={status.total_reviews} suffix="次" />
            <StatTile icon={<Target size={20} />} label="累计正确率" value={status.correct_rate} suffix="%" />
            <StatTile icon={<CheckCircle2 size={20} />} label="已掌握单词" value={status.mastered_words} suffix="个" />
            <StatTile icon={<Flame size={20} />} label="连续学习" value={status.streak_days} suffix="天" />
          </section>

          <section className="surface rounded-lg p-5">
            <div className="mb-4 flex items-center gap-2">
              <Award size={22} style={{ color: 'var(--green)' }} />
              <h3 className="text-2xl font-semibold">成就徽章</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {status.badges.map((badge) => (
                <BadgeCard badge={badge} key={badge.code} />
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-4 py-3" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <div className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function StatTile({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: number; suffix: string }) {
  return (
    <div className="surface rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>{label}</span>
        <span style={{ color: 'var(--green)' }}>{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold">
        {value}<span className="ml-1 text-sm font-bold" style={{ color: 'var(--muted)' }}>{suffix}</span>
      </div>
    </div>
  );
}

function BadgeCard({ badge }: { badge: CheckInBadge }) {
  const percent = badge.target ? Math.round((badge.progress / badge.target) * 100) : 0;
  return (
    <article className="rounded-lg border p-4" style={{ borderColor: badge.earned ? 'color-mix(in srgb, var(--green) 34%, var(--line))' : 'var(--line)', background: 'var(--paper)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold">{badge.title}</h4>
          <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>{badge.description}</p>
        </div>
        <span className="chip" style={{ background: badge.earned ? 'var(--green-soft)' : 'var(--panel)', color: badge.earned ? 'var(--green)' : 'var(--muted)' }}>
          {badge.earned ? '已获得' : `${badge.progress}/${badge.target}`}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: 'var(--panel)' }}>
        <div className="h-full rounded-full" style={{ width: `${percent}%`, background: badge.earned ? 'var(--green)' : 'var(--amber)' }} />
      </div>
    </article>
  );
}
