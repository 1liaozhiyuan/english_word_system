import React from 'react';
import { AlertTriangle, ArrowRight, BarChart3, CheckCircle2, Flame, Lightbulb, NotebookTabs, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { getLearningReport } from '../api/learningReport';
import { useAuth } from '../auth/AuthContext';
import { LoadingState } from '../components/LoadingState';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { LearningReport } from '../types';

export function LearningReportPage() {
  const { token } = useAuth();
  const [report, setReport] = React.useState<LearningReport | null>(null);
  const [message, setMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);

  async function loadReport() {
    setIsLoading(true);
    setMessage('');
    try {
      setReport(await getLearningReport(token));
    } catch (error) {
      setReport(null);
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    loadReport();
  }, [token]);

  return (
    <>
      <PageHeader
        title="学习报告"
        description="基于真实学习记录、复习正确率、错题和掌握度生成阶段反馈。"
      />
      <Message tone="error">{message}</Message>
      {isLoading && <LoadingState text="正在生成学习报告..." />}

      {!isLoading && report && (
        <>
          <section className="dashboard-hero mb-5 rounded-lg p-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                    阶段反馈
                  </span>
                  <span className="chip" style={{ background: 'var(--panel)', color: 'var(--muted)' }}>
                    {report.total_reviews} 次真实练习
                  </span>
                </div>
                <h2 className="mt-4 text-4xl font-semibold tracking-normal">
                  {report.summary}
                </h2>
                <p className="mt-3 max-w-2xl leading-7" style={{ color: 'var(--muted)' }}>
                  今日已完成 {report.today_completed} 次，剩余 {report.today_remaining} 个任务。本报告不会使用演示数据，所有结论都来自当前账号数据库记录。
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link className="button-primary" to={report.today_remaining > 0 ? '/review' : '/study'}>
                    继续学习
                    <ArrowRight size={16} />
                  </Link>
                  <Link className="button-secondary" to="/mistakes">
                    查看错题
                  </Link>
                </div>
              </div>
              <div className="rounded-lg border p-5" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                <div className="flex items-center gap-2 font-semibold">
                  <BarChart3 size={18} style={{ color: 'var(--green)' }} />
                  核心表现
                </div>
                <div className="mt-4 grid gap-3">
                  <Metric label="累计正确率" value={`${report.correct_rate}%`} />
                  <Metric label="本周正确率" value={`${report.weekly_correct_rate}%`} />
                  <Metric label="掌握率" value={`${report.mastered_rate}%`} />
                </div>
              </div>
            </div>
          </section>

          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={<CheckCircle2 size={20} />} label="已掌握" value={report.mastered} suffix="词" />
            <StatTile icon={<NotebookTabs size={20} />} label="错题" value={report.mistakes} suffix="个" />
            <StatTile icon={<AlertTriangle size={20} />} label="重点难词" value={report.leeches} suffix="个" />
            <StatTile icon={<Flame size={20} />} label="连续学习" value={report.streak_days} suffix="天" />
          </section>

          <section className="mb-5 grid gap-5 xl:grid-cols-3">
            <ReportList title="优势" icon={<CheckCircle2 size={20} />} items={report.strengths} />
            <ReportList title="薄弱点" icon={<AlertTriangle size={20} />} items={report.weaknesses} />
            <ReportList title="建议" icon={<Lightbulb size={20} />} items={report.recommendations} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="surface rounded-lg p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold">重点错词</h3>
                <Link className="button-secondary" to="/mistakes">进入错题本</Link>
              </div>
              <div className="grid gap-3">
                {report.focus_words.map((word) => (
                  <Link
                    className="rounded-lg border p-4 transition hover:-translate-y-0.5 hover:bg-[var(--paper)]"
                    key={word.word_id}
                    style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                    to={`/words/${word.word_id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="truncate text-lg font-semibold">{word.text}</h4>
                        <p className="mt-1 truncate text-sm" style={{ color: 'var(--muted)' }}>{word.meaning}</p>
                      </div>
                      <span className="chip" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
                        错 {word.wrong_count}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--paper)' }}>
                      <div className="h-full rounded-full" style={{ width: `${word.mastery_level}%`, background: 'var(--green)' }} />
                    </div>
                  </Link>
                ))}
                {report.focus_words.length === 0 && (
                  <div className="rounded-lg border p-5 text-center text-sm" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
                    当前没有错词记录，继续学习后这里会显示需要重点复盘的单词。
                  </div>
                )}
              </div>
            </div>

            <aside className="surface rounded-lg p-5">
              <div className="mb-4 flex items-center gap-2">
                <Target size={20} style={{ color: 'var(--green)' }} />
                <h3 className="text-xl font-semibold">30 天活跃</h3>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(20px, 1fr))' }}>
                {report.activity.map((item) => {
                  const intensity = Math.min(1, item.reviews / 8);
                  return (
                    <div
                      className="aspect-square rounded-md border"
                      key={item.date}
                      title={`${item.date}: ${item.reviews} 次练习`}
                      style={{
                        borderColor: 'var(--line)',
                        background: item.reviews
                          ? `color-mix(in srgb, var(--green) ${Math.max(25, Math.round(intensity * 90))}%, var(--paper))`
                          : 'var(--panel)',
                      }}
                    />
                  );
                })}
              </div>
              <div className="mt-5 grid gap-3">
                <Metric label="30 天活跃" value={`${report.active_days_30} 天`} />
                <Metric label="本周练习" value={`${report.weekly_reviews} 次`} />
                <Metric label="累计学习词" value={`${report.total_learning} 个`} />
              </div>
            </aside>
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

function ReportList({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  return (
    <section className="surface rounded-lg p-5">
      <div className="mb-4 flex items-center gap-2">
        <span style={{ color: 'var(--green)' }}>{icon}</span>
        <h3 className="text-xl font-semibold">{title}</h3>
      </div>
      <div className="grid gap-3">
        {items.map((item) => (
          <p className="rounded-lg border p-3 text-sm leading-6" key={item} style={{ borderColor: 'var(--line)', background: 'var(--paper)', color: 'var(--muted)' }}>
            {item}
          </p>
        ))}
      </div>
    </section>
  );
}
