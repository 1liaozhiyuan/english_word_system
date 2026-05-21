import React from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Download, Flame, Search, Target } from 'lucide-react';
import { getErrorMessage } from '../api/client';
import { getStatsOverview } from '../api/stats';
import { exportUserData, getStudyHistoryPaginated } from '../api/study';
import { useAuth } from '../auth/AuthContext';
import { ListSkeleton } from '../components/ListSkeleton';
import { LoadingState } from '../components/LoadingState';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import type { DailyActivity, ReviewLogItem, Stats } from '../types';

const qualityText: Record<number, string> = {
  0: '不认识',
  1: '困难',
  2: '认识',
  3: '熟练',
};

const studyModeLabel: Record<string, string> = {
  en_to_cn: '英译中',
  cn_to_en: '中译英',
  listening: '听音',
  spelling: '拼写',
};

const HISTORY_PAGE_SIZE = 12;

export function StatsPage() {
  const { token } = useAuth();
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [history, setHistory] = React.useState<ReviewLogItem[]>([]);
  const [selectedLog, setSelectedLog] = React.useState<ReviewLogItem | null>(null);
  const [message, setMessage] = React.useState('');
  const [historyQuery, setHistoryQuery] = React.useState('');
  const [historyPage, setHistoryPage] = React.useState(1);
  const [historyTotalPages, setHistoryTotalPages] = React.useState(1);
  const [historyTotal, setHistoryTotal] = React.useState(0);
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false);

  async function loadHistory(nextPage = 1, append = false, keyword = historyQuery) {
    setIsHistoryLoading(true);
    try {
      const result = await getStudyHistoryPaginated(token, nextPage, HISTORY_PAGE_SIZE, keyword.trim());
      setHistory((current) => {
        const next = append ? mergeHistory(current, result.items) : result.items;
        setSelectedLog((currentLog) => (append ? currentLog ?? next[0] ?? null : next[0] ?? null));
        return next;
      });
      setHistoryPage(result.page);
      setHistoryTotalPages(result.total_pages);
      setHistoryTotal(result.total);
    } finally {
      setIsHistoryLoading(false);
    }
  }

  React.useEffect(() => {
    Promise.all([getStatsOverview(token), loadHistory(1, false)])
      .then(([nextStats]) => setStats(nextStats))
      .catch((error) => setMessage(getErrorMessage(error)));
  }, [token]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      loadHistory(1, false, historyQuery).catch((error) => setMessage(getErrorMessage(error)));
    }, 260);
    return () => window.clearTimeout(timer);
  }, [historyQuery, token]);

  async function handleExportData() {
    try {
      const blob = await exportUserData(token);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `english-word-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.URL.revokeObjectURL(url);
      setMessage('学习数据已导出。');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleLoadMoreHistory() {
    if (historyPage >= historyTotalPages || isHistoryLoading) return;
    await loadHistory(historyPage + 1, true).catch((error) => setMessage(getErrorMessage(error)));
  }

  const diagnosis = stats ? getLearningDiagnosis(stats) : null;

  return (
    <>
      <PageHeader
        title="学习数据"
        description="这里不只展示数字，也帮助你判断当前学习节奏是否健康。历史记录会按需加载。"
        action={
          <button className="button-secondary" onClick={handleExportData} type="button">
            <Download size={16} />
            导出学习数据
          </button>
        }
      />
      <Message>{message}</Message>

      {!stats && !message && <LoadingState text="正在分析学习数据..." />}

      {stats && diagnosis && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="学习中" value={stats.total_learning} />
            <StatCard label="已掌握" value={stats.mastered} />
            <StatCard label="掌握率" value={stats.mastered_rate} suffix="%" />
            <StatCard label="本周正确率" value={stats.weekly_correct_rate} suffix="%" />
            <StatCard label="连续学习" value={stats.streak_days} suffix="天" />
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="surface rounded-lg p-4 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-bold" style={{ color: diagnosis.color }}>
                {diagnosis.icon}
                学习健康度
              </div>
              <h3 className="mt-3 text-2xl font-semibold tracking-normal sm:text-3xl" style={{ color: 'var(--ink)' }}>
                {diagnosis.title}
              </h3>
              <p className="mt-3 leading-7" style={{ color: 'var(--muted)' }}>
                {diagnosis.description}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <InsightMetric label="待处理" value={stats.due_today} />
                <InsightMetric label="错词" value={stats.mistakes} />
                <InsightMetric label="本周练习" value={stats.weekly_reviews} />
              </div>
            </div>

            <div className="surface rounded-lg p-4 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--green)' }}>
                <BarChart3 size={18} />
                本周节奏
              </div>
              <p className="mt-3 leading-7" style={{ color: 'var(--muted)' }}>
                过去 7 天共完成 {stats.weekly_reviews} 次练习，近期正确率为 {stats.weekly_correct_rate}%。
              </p>
              <WeeklyBars activity={stats.activity} />
            </div>
          </section>

          <section className="surface mt-5 rounded-lg p-4 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <h3 className="text-xl font-semibold" style={{ color: 'var(--ink)' }}>30 天学习热力</h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                  最近 30 天活跃 {stats.active_days_30} 天，总计 {stats.total_reviews} 次练习。
                </p>
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>
                总正确率 {stats.correct_rate}%
              </div>
            </div>
            <div className="mt-5">
              <ActivityHeatmap activity={stats.monthly_activity} />
            </div>
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="surface rounded-lg p-4 sm:p-6">
              <h3 className="text-xl font-semibold" style={{ color: 'var(--ink)' }}>任务压力</h3>
              <div className="mt-5 grid gap-3">
                <MetricRow label="待学新词" value={stats.due_new} />
                <MetricRow label="待复习" value={stats.due_review} />
                <MetricRow label="今日已完成" value={stats.completed_today} />
                <MetricRow label="重点难词" value={stats.leeches} />
              </div>
              <div className="mt-5 rounded-lg p-4 text-sm leading-7" style={{ background: 'var(--panel)', color: 'var(--muted)' }}>
                {diagnosis.advice}
              </div>
            </div>

            <div className="surface rounded-lg p-4 sm:p-6">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] lg:items-start">
                <div>
                  <h3 className="text-xl font-semibold" style={{ color: 'var(--ink)' }}>最近学习记录</h3>
                  <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                    已加载 {history.length} / {historyTotal}，点击单词查看详情
                  </span>
                </div>
                <label className="relative block min-w-0 max-w-sm lg:justify-self-end">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--muted)' }} />
                  <input
                    className="input pl-9"
                    onChange={(event) => setHistoryQuery(event.target.value)}
                    placeholder="搜索学习记录"
                    value={historyQuery}
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-3">
                {history.length === 0 && isHistoryLoading && <ListSkeleton count={3} />}
                {history.length === 0 && !isHistoryLoading && (
                  <div className="rounded-lg p-4 text-sm" style={{ background: 'var(--panel)', color: 'var(--muted)' }}>
                    暂无学习记录。
                  </div>
                )}
                {history.map((item) => (
                  <button
                    className="grid w-full gap-3 rounded-lg border p-4 text-left transition hover:-translate-y-0.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    style={{
                      borderColor: selectedLog?.id === item.id ? 'var(--green)' : 'var(--line)',
                      background: selectedLog?.id === item.id ? 'var(--green-soft)' : 'var(--paper)',
                    }}
                    key={item.id}
                    onClick={() => setSelectedLog(item)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <div className="break-words font-semibold" style={{ color: 'var(--ink)' }}>{item.word_text}</div>
                      <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                        {new Date(item.created_at).toLocaleString()} · {studyModeLabel[item.study_mode] ?? item.study_mode}
                      </div>
                    </div>
                    <span
                      className="rounded-full px-3 py-1 text-xs font-bold"
                      style={item.is_correct
                        ? { background: 'var(--green-soft)', color: 'var(--green)' }
                        : { background: 'var(--red-soft)', color: 'var(--red)' }}
                    >
                      {qualityText[item.quality] ?? item.quality}
                    </span>
                  </button>
                ))}
              </div>
              {history.length > 0 && historyPage < historyTotalPages && (
                <div className="mt-4 flex justify-center">
                  <button className="button-secondary" disabled={isHistoryLoading} onClick={handleLoadMoreHistory} type="button">
                    {isHistoryLoading ? '加载中...' : `加载更多（${historyPage}/${historyTotalPages}）`}
                  </button>
                </div>
              )}
            </div>
          </section>

          {selectedLog && <HistoryWordDetail item={selectedLog} />}
        </>
      )}
    </>
  );
}

function WeeklyBars({ activity }: { activity: DailyActivity[] }) {
  const maxReviews = Math.max(1, ...activity.map((item) => item.reviews));
  return (
    <div className="mt-5 grid h-44 grid-cols-7 items-end gap-2 sm:h-52 sm:gap-3">
      {activity.map((item) => {
        const accuracy = item.reviews ? Math.round((item.correct / item.reviews) * 100) : 0;
        return (
          <div className="flex h-full flex-col justify-end gap-2" key={item.date}>
            <div
              className="rounded-t-lg bg-[#355e3b] dark:bg-[#7fb87a]"
              style={{ height: `${Math.max(8, (item.reviews / maxReviews) * 100)}%` }}
              title={`${item.date}: ${item.reviews} 次，正确率 ${accuracy}%`}
            />
            <div className="text-center text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              {item.date.slice(5)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityHeatmap({ activity }: { activity: DailyActivity[] }) {
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

function HistoryWordDetail({ item }: { item: ReviewLogItem }) {
  const word = item.word;

  return (
    <section className="surface mt-5 rounded-lg p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>单词详情</p>
          <h3 className="mt-2 break-words text-3xl font-semibold tracking-normal sm:text-4xl" style={{ color: 'var(--ink)' }}>
            {word?.text ?? item.word_text}
          </h3>
          {word?.phonetic && (
            <p className="mt-2 text-lg font-semibold" style={{ color: 'var(--green)' }}>{word.phonetic}</p>
          )}
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={item.is_correct
            ? { background: 'var(--green-soft)', color: 'var(--green)' }
            : { background: 'var(--red-soft)', color: 'var(--red)' }}
        >
          本次记录：{qualityText[item.quality] ?? item.quality}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
          <div className="text-sm font-bold" style={{ color: 'var(--muted)' }}>释义</div>
          <div className="mt-2 text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
            {word?.meaning ?? '暂无释义'}
          </div>
          <div className="mt-3 grid gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <div>词性：{word?.part_of_speech || '未标注'}</div>
            <div>学习模式：{studyModeLabel[item.study_mode] ?? item.study_mode}</div>
            <div>记录时间：{new Date(item.created_at).toLocaleString()}</div>
          </div>
        </div>

        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
          <div className="text-sm font-bold" style={{ color: 'var(--muted)' }}>例句</div>
          <p className="mt-2 text-lg leading-8" style={{ color: 'var(--ink)' }}>
            {word?.example_sentence || '暂无英文例句'}
          </p>
          {word?.example_translation && (
            <p className="mt-2 leading-7" style={{ color: 'var(--muted)' }}>
              {word.example_translation}
            </p>
          )}
          {word?.note && (
            <div className="mt-4 rounded-lg p-3 text-sm leading-6" style={{ background: 'var(--paper)', color: 'var(--muted)' }}>
              {word.note}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function getLearningDiagnosis(stats: Stats) {
  if (stats.due_review >= 20) {
    return {
      title: '复习压力偏高',
      description: '当前到期复习较多，继续增加新词会让后续负担变重。建议先清理复习任务。',
      advice: '今天优先进入复习页，暂时少学新词。复习压力降下来后，再恢复新词节奏。',
      color: 'var(--red)',
      icon: <AlertTriangle size={18} />,
    };
  }

  if (stats.weekly_reviews > 0 && stats.weekly_correct_rate < 60) {
    return {
      title: '正确率需要关注',
      description: '近期答题正确率偏低，说明当前内容可能偏难，或者复习节奏有些快。',
      advice: '建议减少每轮数量，优先使用英译中和听音模式巩固基础，再逐步增加拼写练习。',
      color: 'var(--amber)',
      icon: <Target size={18} />,
    };
  }

  if (stats.leeches > 0) {
    return {
      title: '有重点难词',
      description: '系统已经识别出反复出错的单词，这些词需要比普通错词更多的复盘。',
      advice: '去错词本处理重点难词，重点看例句、词性和拼写，不建议只靠快速浏览。',
      color: 'var(--amber)',
      icon: <AlertTriangle size={18} />,
    };
  }

  if (stats.streak_days >= 7 && stats.weekly_correct_rate >= 75) {
    return {
      title: '节奏非常稳定',
      description: '连续学习和近期正确率都不错，说明当前每日任务量比较适合你。',
      advice: '可以保持现在的设置。如果觉得轻松，可以小幅增加每日新词数量。',
      color: 'var(--green)',
      icon: <Flame size={18} />,
    };
  }

  return {
    title: '节奏正常',
    description: '当前学习压力处在可控范围内。继续完成每日任务，系统会根据表现安排复习。',
    advice: '今天按首页建议完成任务即可。如果时间有限，优先完成到期复习。',
    color: 'var(--green)',
    icon: <CheckCircle2 size={18} />,
  };
}

function InsightMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>{value}</div>
      <div className="mt-1 text-xs font-bold" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

function mergeHistory(current: ReviewLogItem[], incoming: ReviewLogItem[]) {
  const byId = new Map<number, ReviewLogItem>();
  [...current, ...incoming].forEach((item) => byId.set(item.id, item));
  return [...byId.values()];
}
