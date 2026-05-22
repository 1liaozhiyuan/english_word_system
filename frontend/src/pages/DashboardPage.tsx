import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  Library,
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { getSettings } from '../api/settings';
import { getStatsOverview } from '../api/stats';
import { getWordBookProgress } from '../api/wordBooks';
import { useAuth } from '../auth/AuthContext';
import { LoadingState } from '../components/LoadingState';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import type { Stats, UserSettings, WordBookProgress } from '../types';

export function DashboardPage() {
  const { token, user } = useAuth();
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [settings, setSettings] = React.useState<UserSettings | null>(null);
  const [wordBooks, setWordBooks] = React.useState<WordBookProgress[]>([]);
  const [message, setMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);

  async function loadStats() {
    setIsLoading(true);
    setMessage('');
    try {
      const [nextStats, nextSettings, nextWordBooks] = await Promise.all([
        getStatsOverview(token),
        getSettings(token),
        getWordBookProgress(token),
      ]);
      setStats(nextStats);
      setSettings(nextSettings);
      setWordBooks(nextWordBooks);
    } catch (error) {
      setStats(null);
      setSettings(null);
      setWordBooks([]);
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    loadStats();
  }, [token]);

  const plan = stats ? getTodayPlan(stats) : null;
  const totalToday = (stats?.due_new ?? 0) + (stats?.due_review ?? 0);
  const currentBook = getCurrentWordBook(wordBooks);
  const aiSuggestion = stats ? getAISuggestion(stats, settings, currentBook) : null;
  const todayCompletion = stats ? getTodayCompletion(stats) : 0;

  return (
    <>
      <PageHeader
        title="今日学习中心"
        description={`欢迎回来，${user?.email ?? 'learner'}。这里汇总今日任务、学习进度和常用功能。`}
      />
      <Message tone="error">{message}</Message>

      {isLoading && <LoadingState text="正在生成今日学习建议..." />}

      {!isLoading && message && (
        <section className="surface rounded-lg p-5">
          <p className="text-sm leading-6" style={{ color: 'var(--muted)' }}>
            今日建议需要从后端读取统计数据。请确认后端服务、PostgreSQL 和数据库迁移都正常后再重试。
          </p>
          <button className="button-primary mt-4" onClick={loadStats} type="button">
            重新加载
          </button>
        </section>
      )}

      {!isLoading && stats && plan && (
        <>
          <section className="dashboard-hero mb-5 rounded-lg p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#e6efdf] px-3 py-1 text-xs font-bold text-[#355e3b] dark:bg-[#1e2f1c] dark:text-[#7fb87a]">
                    今日建议
                  </span>
                  <span className="rounded-full bg-[#fbf8ef] px-3 py-1 text-xs font-bold text-[#6b6a62] dark:bg-[#1f1d18] dark:text-[#9a978d]">
                    {plan.priority}
                  </span>
                </div>
                <h2 className="mt-4 text-4xl font-semibold tracking-normal" style={{ color: 'var(--ink)' }}>
                  {plan.title}
                </h2>
                <p className="mt-3 max-w-2xl leading-7" style={{ color: 'var(--muted)' }}>
                  {plan.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link className="button-primary" to={plan.primaryTo}>
                    {plan.primaryAction}
                    <ArrowRight size={17} />
                  </Link>
                  {plan.secondaryTo && (
                    <Link className="button-secondary" to={plan.secondaryTo}>
                      {plan.secondaryAction}
                    </Link>
                  )}
                  <Link className="button-secondary" to="/quiz">
                    进入测试
                  </Link>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <TodayTaskCard label="新词" value={stats.due_new} total={stats.daily_new_limit} to="/study" />
                  <TodayTaskCard label="复习" value={stats.due_review} total={stats.daily_review_limit} to="/review" />
                  <TodayTaskCard label="错题" value={stats.mistakes} to="/mistakes" />
                </div>
              </div>

              <div className="rounded-lg border border-[#ddd7c7] bg-[#fbf8ef] p-5 dark:border-[#3d3a32] dark:bg-[#1f1d18]">
                <div className="flex items-center gap-2 text-sm font-bold" style={{ color: plan.toneColor }}>
                  {plan.icon}
                  学习教练
                </div>
                <p className="mt-4 text-sm leading-7" style={{ color: 'var(--muted)' }}>
                  {plan.coachNote}
                </p>
                <div className="mt-4 rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">今日完成率</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--green)' }}>{todayCompletion}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--panel)' }}>
                    <div className="h-full rounded-full" style={{ width: `${todayCompletion}%`, background: 'var(--green)' }} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="今日待学新词" value={stats.due_new} suffix={`/ ${stats.daily_new_limit}`} />
            <StatCard label="今日待复习" value={stats.due_review} suffix={`/ ${stats.daily_review_limit}`} />
            <StatCard label="错题需关注" value={stats.mistakes} />
            <StatCard label="今日已完成" value={stats.completed_today} />
          </section>

          <section className="mb-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="surface rounded-lg p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--green)' }}>
                    Study Plan
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-normal">当前学习计划</h3>
                </div>
                <Link className="button-secondary" to="/onboarding">
                  调整目标
                </Link>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <PlanMetric label="学习目标" value={settings?.learning_goal ?? '未设置'} />
                <PlanMetric label="当前水平" value={settings?.english_level ?? '待评估'} />
                <PlanMetric label="每日时间" value={`${settings?.daily_minutes ?? 20} 分钟`} />
              </div>
              <div className="mt-4 rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">今日任务进度</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--green)' }}>{todayCompletion}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--panel)' }}>
                  <div className="h-full rounded-full" style={{ width: `${todayCompletion}%`, background: 'var(--green)' }} />
                </div>
              </div>
            </div>

            <div className="surface rounded-lg p-5">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={21} style={{ color: 'var(--green)' }} />
                <h3 className="text-xl font-semibold">AI 学习建议</h3>
              </div>
              <p className="text-sm leading-7" style={{ color: 'var(--muted)' }}>
                {aiSuggestion}
              </p>
              <div className="mt-4 grid gap-3">
                <PlanMetric label="当前词库" value={currentBook?.title ?? '尚未选择词库'} />
                <PlanMetric label="词库完成率" value={currentBook ? `${currentBook.completion_rate}%` : '0%'} />
              </div>
            </div>
          </section>

          <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="连续学习" value={stats.streak_days} suffix="天" />
            <StatCard label="本周正确率" value={stats.weekly_correct_rate} suffix="%" />
            <StatCard label="掌握率" value={stats.mastered_rate} suffix="%" />
            <StatCard label="30天活跃" value={stats.active_days_30} suffix="天" />
            <StatCard label="重点难词" value={stats.leeches} />
          </section>

          <section className="surface mb-5 rounded-lg p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold">30 天学习热力</h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                  最近 30 天共有 {stats.active_days_30} 天发生学习记录。
                </p>
              </div>
              <Link className="button-secondary" to="/stats">
                查看详细数据
              </Link>
            </div>
            <ActivityHeatmap activity={stats.monthly_activity} />
          </section>

          {totalToday === 0 && (
            <section className="surface mt-5 rounded-lg p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#f5ead2] text-[#9b6b2f] dark:bg-[#2e2516] dark:text-[#d4a346]">
                <Library size={24} />
              </div>
              <h3 className="mt-5 text-xl font-semibold" style={{ color: 'var(--ink)' }}>
                今天没有待处理任务
              </h3>
              <p className="mt-2 leading-7" style={{ color: 'var(--muted)' }}>
                可以选择一本新词书继续扩展词量，也可以去数据页看看最近的学习表现。
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link className="button-primary" to="/word-books">
                  选择词书
                  <ArrowRight size={16} />
                </Link>
                <Link className="button-secondary" to="/stats">
                  查看数据
                </Link>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-4 py-3" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="mt-1 truncate text-base font-semibold" style={{ color: 'var(--ink)' }}>{value}</div>
    </div>
  );
}

function getTodayPlan(stats: Stats) {
  if (stats.due_review > 0) {
    return {
      priority: '先复习',
      title: `先处理 ${stats.due_review} 个今日复习`,
      description: `当前共有 ${stats.available_review} 个到期复习，今天按设置先安排 ${stats.due_review} 个。`,
      coachNote: stats.due_new > 0
        ? `建议先完成复习，再学习 ${stats.due_new} 个新词。`
        : '今天没有新词压力，把到期复习清理掉就很好。',
      primaryAction: '开始复习',
      primaryTo: '/review',
      secondaryAction: stats.due_new > 0 ? '稍后学新词' : '查看错题',
      secondaryTo: stats.due_new > 0 ? '/study' : '/mistakes',
      toneColor: 'var(--amber)',
      icon: <RotateCcw size={18} />,
    };
  }

  if (stats.due_new > 0) {
    return {
      priority: '学新词',
      title: `今天适合学习 ${stats.due_new} 个新词`,
      description: `当前词书计划中还有 ${stats.available_new} 个未学新词，今天按设置安排 ${stats.due_new} 个。`,
      coachNote: stats.weekly_correct_rate >= 80
        ? '最近正确率不错，可以保持当前节奏。'
        : '学习新词时建议慢一点，优先保证回忆质量。',
      primaryAction: '学习新词',
      primaryTo: '/study',
      secondaryAction: '查看词书',
      secondaryTo: '/word-books',
      toneColor: 'var(--green)',
      icon: <Target size={18} />,
    };
  }

  if (stats.mistakes > 0) {
    return {
      priority: '复盘错词',
      title: `复盘 ${stats.mistakes} 个错词`,
      description: '今天没有固定任务，可以利用这段轻负荷时间处理错词，减少后续反复出错。',
      coachNote: stats.leeches > 0
        ? `其中有 ${stats.leeches} 个重点难词，建议优先看例句和拼写。`
        : '错词数量还可控，短复盘就能明显提升稳定性。',
      primaryAction: '复盘错词',
      primaryTo: '/mistakes',
      secondaryAction: '选择词书',
      secondaryTo: '/word-books',
      toneColor: 'var(--red)',
      icon: <AlertTriangle size={18} />,
    };
  }

  return {
    priority: '轻松日',
    title: '今天没有待处理任务',
    description: '当前学习计划已经清空。你可以休息一下，也可以选择一本词书继续扩展词量。',
    coachNote: stats.streak_days > 0
      ? `你已经连续学习 ${stats.streak_days} 天，保持这个节奏就很好。`
      : '从选择一本词书开始，系统会自动生成每日任务。',
    primaryAction: '选择词书',
    primaryTo: '/word-books',
    secondaryAction: '查看数据',
    secondaryTo: '/stats',
    toneColor: 'var(--green)',
    icon: <CalendarCheck size={18} />,
  };
}

function getCurrentWordBook(books: WordBookProgress[]) {
  const activeBooks = books.filter((book) => book.added_count > 0);
  if (!activeBooks.length) return null;
  return [...activeBooks].sort((a, b) => {
    if (a.completion_rate !== b.completion_rate) {
      return a.completion_rate - b.completion_rate;
    }
    return b.added_count - a.added_count;
  })[0];
}

function getTodayCompletion(stats: Stats) {
  const planned = stats.daily_new_limit + stats.daily_review_limit;
  if (!planned) return 0;
  return Math.max(0, Math.min(100, Math.round((stats.completed_today / planned) * 100)));
}

function getAISuggestion(
  stats: Stats,
  settings: UserSettings | null,
  currentBook: WordBookProgress | null,
) {
  if (!currentBook) {
    return '你还没有选择词库。建议先进入词库广场选择一个和当前目标匹配的词库，系统会自动生成新词和复习任务。';
  }
  if (!settings?.onboarding_completed) {
    return '建议先完成目标引导，系统会根据你的考试目标、水平和每日时间重新规划学习节奏。';
  }
  if (stats.due_review > stats.due_new) {
    return `今天复习压力高于新词任务，优先完成 ${stats.due_review} 个到期复习，再考虑学习新词。`;
  }
  if (stats.mistakes >= 10) {
    return `错题数量已经达到 ${stats.mistakes} 个，建议安排一次错题复盘，先稳定易错词再扩展新词。`;
  }
  if (stats.weekly_reviews > 0 && stats.weekly_correct_rate < 65) {
    return '本周正确率偏低，建议把每日新词量调小一点，并多使用拼写或听音模式巩固。';
  }
  if (currentBook.completion_rate >= 80) {
    return `当前词库《${currentBook.title}》接近完成，可以开始准备阶段测试或选择下一本词库。`;
  }
  return `当前节奏比较稳定，继续推进《${currentBook.title}》。完成今日任务后，可以用专项测试检查真实掌握情况。`;
}

function ActivityHeatmap({ activity }: { activity: Stats['monthly_activity'] }) {
  const maxReviews = Math.max(1, ...activity.map((item) => item.reviews));
  return (
    <div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(22px, 1fr))' }}>
        {activity.map((item) => {
          const intensity = item.reviews / maxReviews;
          const background = item.reviews === 0
            ? 'var(--panel)'
            : `color-mix(in srgb, var(--green) ${Math.max(22, Math.round(intensity * 88))}%, var(--paper))`;
          return (
            <div
              className="aspect-square rounded-md border"
              key={item.date}
              title={`${item.date}: ${item.reviews} 次练习`}
              style={{ background, borderColor: 'var(--line)' }}
            />
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-xs font-semibold" style={{ color: 'var(--muted)' }}>
        <span>少</span>
        <span className="h-3 w-3 rounded-sm border" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }} />
        <span className="h-3 w-3 rounded-sm border" style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--green) 36%, var(--paper))' }} />
        <span className="h-3 w-3 rounded-sm border" style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--green) 66%, var(--paper))' }} />
        <span>多</span>
      </div>
    </div>
  );
}

function TodayTaskCard({ label, value, total, to }: { label: string; value: number; total?: number; to: string }) {
  return (
    <Link className="rounded-lg border p-4 transition hover:-translate-y-0.5" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }} to={to}>
      <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="mt-2 flex items-end gap-1">
        <span className="text-3xl font-semibold leading-none" style={{ color: 'var(--ink)' }}>{value}</span>
        {total !== undefined && <span className="pb-0.5 text-sm font-bold" style={{ color: 'var(--muted)' }}>/ {total}</span>}
      </div>
    </Link>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#ddd7c7] bg-[#fffdf8] px-2 py-3 dark:border-[#3d3a32] dark:bg-[#25231e]">
      <div className="text-xl font-semibold" style={{ color: 'var(--ink)' }}>{value}</div>
      <div className="mt-1 text-xs font-bold" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}
