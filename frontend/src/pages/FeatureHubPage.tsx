import React from 'react';
import {
  Award,
  Bell,
  BookOpen,
  ChartNoAxesColumn,
  ClipboardCheck,
  Crown,
  FilePenLine,
  FileText,
  Flame,
  GraduationCap,
  Headphones,
  Library,
  LifeBuoy,
  Mic,
  NotebookTabs,
  PanelsTopLeft,
  Route,
  RotateCcw,
  Settings,
  Sparkles,
  Star,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { getStatsOverview } from '../api/stats';
import { useAuth } from '../auth/AuthContext';
import { LoadingState } from '../components/LoadingState';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { Stats } from '../types';

type HubKind = 'today' | 'ability' | 'data' | 'service';

const hubMeta: Record<HubKind, { title: string; description: string; eyebrow: string }> = {
  today: {
    eyebrow: 'Today',
    title: '今日任务',
    description: '每天优先处理这里的任务：选词库、学新词、复习到期内容，再用测试检查掌握情况。',
  },
  ability: {
    eyebrow: 'Skills',
    title: '能力训练',
    description: '听、说、读、写、语法集中在这里，适合完成今日任务后做专项提升。',
  },
  data: {
    eyebrow: 'Review',
    title: '复盘数据',
    description: '集中查看错题、收藏、学习统计、打卡和报告，判断下一步该补哪里。',
  },
  service: {
    eyebrow: 'Service',
    title: '设置服务',
    description: '学习计划、提醒、会员、反馈、协议和运营后台入口放在这里，避免干扰日常学习。',
  },
};

export function FeatureHubPage({ kind }: { kind: HubKind }) {
  const { token } = useAuth();
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [message, setMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadStats() {
      setIsLoading(true);
      setMessage('');
      try {
        setStats(await getStatsOverview(token));
      } catch (error) {
        setStats(null);
        setMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, [token]);

  const meta = hubMeta[kind];

  return (
    <>
      <PageHeader title={meta.title} description={meta.description} />
      <Message tone="error">{message}</Message>
      {isLoading && <LoadingState text="正在读取学习数据..." />}
      {!isLoading && (
        <section className="surface rounded-lg p-5">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-normal" style={{ color: 'var(--green)' }}>{meta.eyebrow}</p>
              <h2 className="mt-1 text-2xl font-semibold">{meta.title}入口</h2>
            </div>
            <p className="max-w-xl text-sm leading-6" style={{ color: 'var(--muted)' }}>
              点击下面的功能卡片进入对应页面。
            </p>
          </div>
          <div className="feature-group-grid">
            <FeatureGroup title={meta.title}>{renderHubLinks(kind, stats)}</FeatureGroup>
          </div>
        </section>
      )}
    </>
  );
}

function renderHubLinks(kind: HubKind, stats: Stats | null) {
  if (kind === 'today') {
    return (
      <>
        <FeatureLink icon={<Library size={18} />} label="词库广场" note="选择官方词库或导入自定义词库" to="/word-books" />
        <FeatureLink icon={<BookOpen size={18} />} label="新词学习" note={`${stats?.due_new ?? 0} 个今日新词`} to="/study" />
        <FeatureLink icon={<RotateCcw size={18} />} label="今日复习" note={`${stats?.due_review ?? 0} 个到期复习`} to="/review" />
        <FeatureLink icon={<ClipboardCheck size={18} />} label="专项测试" note="选择题、拼写题和混合测试" to="/quiz" />
      </>
    );
  }
  if (kind === 'ability') {
    return (
      <>
        <FeatureLink icon={<Headphones size={18} />} label="听力训练" note="听音辨义、听写和复习记录" to="/listening" />
        <FeatureLink icon={<Mic size={18} />} label="口语跟读" note="例句跟读、评分和历史记录" to="/speaking" />
        <FeatureLink icon={<BookOpen size={18} />} label="阅读训练" note="分级文章、生词和阅读记录" to="/reading" />
        <FeatureLink icon={<FilePenLine size={18} />} label="写作训练" note="单词造句、短文练习和历史反馈" to="/writing" />
        <FeatureLink icon={<GraduationCap size={18} />} label="语法学习" note="知识点讲解、例句和专项练习" to="/grammar" />
      </>
    );
  }
  if (kind === 'data') {
    return (
      <>
        <FeatureLink icon={<NotebookTabs size={18} />} label="错题本" note={`${stats?.mistakes ?? 0} 个需要关注`} to="/mistakes" />
        <FeatureLink icon={<Star size={18} />} label="收藏单词" note="查看重点词和个人词单" to="/favorites" />
        <FeatureLink icon={<ChartNoAxesColumn size={18} />} label="学习统计" note="正确率、连续学习和热力图" to="/stats" />
        <FeatureLink icon={<Award size={18} />} label="打卡激励" note="连续学习、活跃天数和成就徽章" to="/check-in" />
        <FeatureLink icon={<Flame size={18} />} label="学习报告" note="查看阶段表现和薄弱点" to="/learning-report" />
      </>
    );
  }
  return (
    <>
      <FeatureLink icon={<Route size={18} />} label="学习计划" note="查看完成率、目标日期和风险提醒" to="/learning-plan" />
      <FeatureLink icon={<Settings size={18} />} label="学习设置" note="每日任务、发音、默认模式" to="/learning-settings" />
      <FeatureLink icon={<Bell size={18} />} label="消息提醒" note="复习到期、错题和 AI 额度提醒" to="/notifications" />
      <FeatureLink icon={<Sparkles size={18} />} label="目标引导" note="重新生成个性化计划" to="/onboarding" />
      <FeatureLink icon={<Crown size={18} />} label="会员权益" note="AI 额度、订阅和套餐说明" to="/membership" />
      <FeatureLink icon={<LifeBuoy size={18} />} label="反馈客服" note="提交问题和 AI 内容反馈" to="/support" />
      <FeatureLink icon={<FileText size={18} />} label="协议隐私" note="用户协议、隐私政策和注销说明" to="/legal" />
      <FeatureLink icon={<PanelsTopLeft size={18} />} label="运营后台" note="用户、词库、订单和内容管理入口" to="/admin" />
    </>
  );
}

function FeatureGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="feature-group">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{title}</h3>
        <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
      </div>
      <div className="feature-group-body">{children}</div>
    </div>
  );
}

function FeatureLink({ icon, label, note, to }: { icon: React.ReactNode; label: string; note: string; to: string }) {
  return (
    <Link className="feature-link" to={to}>
      <span className="feature-link-icon">{icon}</span>
      <span className="min-w-0">
        <span className="block font-semibold" style={{ color: 'var(--ink)' }}>{label}</span>
        <span className="mt-0.5 block truncate text-xs" style={{ color: 'var(--muted)' }}>{note}</span>
      </span>
      <span className="ml-auto shrink-0 opacity-45">→</span>
    </Link>
  );
}
