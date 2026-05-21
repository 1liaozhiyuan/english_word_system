import React from 'react';
import { Bot, CalendarDays, CheckCircle2, Clock, Headphones, Mic, Save, Target } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { getSettings, updateSettings } from '../api/settings';
import { useAuth } from '../auth/AuthContext';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';

const goals = ['日常英语', '中考英语', '高考英语', '大学英语四级', '大学英语六级', '考研英语', '雅思', '托福', '职场英语', '旅游英语', '零基础入门'];
const levels = ['零基础', '入门', '高中基础', '大学基础', '备考强化', '进阶表达'];

export function OnboardingPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = React.useState({
    learning_goal: '大学英语四级',
    english_level: '大学基础',
    exam_type: '大学英语四级',
    daily_minutes: 25,
    target_date: '',
    wants_speaking: true,
    wants_listening: true,
    wants_ai_tutor: true,
    reminder_enabled: true,
    reminder_time: '20:30',
  });
  const [message, setMessage] = React.useState<{ text: string; tone: 'success' | 'error' | 'info' }>({ text: '', tone: 'info' });
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    getSettings(token).then((settings) => {
      setForm((current) => ({
        ...current,
        learning_goal: settings.learning_goal ?? current.learning_goal,
        english_level: settings.english_level ?? current.english_level,
        exam_type: settings.exam_type ?? settings.learning_goal ?? current.exam_type,
        target_date: settings.target_date ?? '',
        daily_minutes: settings.daily_minutes ?? current.daily_minutes,
        wants_speaking: settings.wants_speaking,
        wants_listening: settings.wants_listening,
        wants_ai_tutor: settings.wants_ai_tutor,
        reminder_enabled: settings.reminder_enabled,
        reminder_time: settings.reminder_time ?? current.reminder_time,
      }));
    }).catch((error) => setMessage({ text: getErrorMessage(error), tone: 'error' }));
  }, [token]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings(token, {
        ...form,
        onboarding_completed: true,
        daily_new_limit: recommendedNewWords(form.daily_minutes),
        daily_review_limit: recommendedReviewWords(form.daily_minutes),
      });
      setMessage({ text: '学习计划已生成，首页会按这个目标安排每日任务。', tone: 'success' });
      window.setTimeout(() => navigate('/dashboard'), 500);
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  const newWords = recommendedNewWords(form.daily_minutes);
  const reviewWords = recommendedReviewWords(form.daily_minutes);

  return (
    <>
      <PageHeader
        title="新用户学习引导"
        description="用目标、水平和可投入时间生成第一版学习计划。后续可以在学习设置里随时调整。"
        action={<Link className="button-secondary" to="/learning-settings">跳过，稍后设置</Link>}
      />
      <Message tone={message.tone}>{message.text}</Message>

      <form className="grid gap-5 xl:grid-cols-[1fr_340px]" onSubmit={handleSubmit}>
        <section className="surface rounded-lg p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Field title="学习目标" icon={<Target size={20} />}>
              <div className="grid gap-2 sm:grid-cols-2">
                {goals.map((goal) => (
                  <ChoiceButton key={goal} active={form.learning_goal === goal} onClick={() => setForm({ ...form, learning_goal: goal, exam_type: goal })}>
                    {goal}
                  </ChoiceButton>
                ))}
              </div>
            </Field>
            <Field title="当前水平" icon={<CheckCircle2 size={20} />}>
              <div className="grid gap-2 sm:grid-cols-2">
                {levels.map((level) => (
                  <ChoiceButton key={level} active={form.english_level === level} onClick={() => setForm({ ...form, english_level: level })}>
                    {level}
                  </ChoiceButton>
                ))}
              </div>
            </Field>
            <Field title="每日学习时间" icon={<Clock size={20} />}>
              <input className="w-full accent-[#355e3b]" max={120} min={5} onChange={(event) => setForm({ ...form, daily_minutes: Number(event.target.value) })} type="range" value={form.daily_minutes} />
              <div className="mt-3 text-2xl font-semibold">{form.daily_minutes} 分钟</div>
            </Field>
            <Field title="目标日期" icon={<CalendarDays size={20} />}>
              <input className="input" onChange={(event) => setForm({ ...form, target_date: event.target.value })} type="date" value={form.target_date} />
            </Field>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Toggle active={form.wants_listening} icon={<Headphones size={18} />} label="听力训练" onClick={() => setForm({ ...form, wants_listening: !form.wants_listening })} />
            <Toggle active={form.wants_speaking} icon={<Mic size={18} />} label="口语跟读" onClick={() => setForm({ ...form, wants_speaking: !form.wants_speaking })} />
            <Toggle active={form.wants_ai_tutor} icon={<Bot size={18} />} label="AI 辅导" onClick={() => setForm({ ...form, wants_ai_tutor: !form.wants_ai_tutor })} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_160px]">
            <Toggle active={form.reminder_enabled} icon={<CalendarDays size={18} />} label="开启每日提醒" onClick={() => setForm({ ...form, reminder_enabled: !form.reminder_enabled })} />
            <input className="input" disabled={!form.reminder_enabled} onChange={(event) => setForm({ ...form, reminder_time: event.target.value })} type="time" value={form.reminder_time} />
          </div>
        </section>

        <aside className="surface rounded-lg p-5">
          <h3 className="text-xl font-semibold">推荐计划</h3>
          <div className="mt-4 grid gap-3">
            <Preview label="每日新词" value={`${newWords} 个`} />
            <Preview label="每日复习" value={`${reviewWords} 个`} />
            <Preview label="推荐词库" value={form.exam_type || form.learning_goal} />
            <Preview label="训练重点" value={getFocusText(form)} />
          </div>
          <p className="mt-4 rounded-lg p-4 text-sm leading-6" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
            系统会先保证单词学习、到期复习、错题回炉，再逐步加入听说训练和 AI 讲解。
          </p>
          <button className="button-primary mt-5 w-full" disabled={isSaving} type="submit">
            <Save size={16} />
            {isSaving ? '生成中...' : '生成学习计划'}
          </button>
        </aside>
      </form>
    </>
  );
}

function Field({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="mb-3 flex items-center gap-2 font-semibold" style={{ color: 'var(--ink)' }}>{icon}{title}</div>
      {children}
    </div>
  );
}

function ChoiceButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button className={active ? 'button-primary justify-center' : 'button-secondary justify-center'} onClick={onClick} type="button">{children}</button>;
}

function Toggle({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={active ? 'button-primary' : 'button-secondary'} onClick={onClick} type="button">{icon}{label}</button>;
}

function Preview({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3 rounded-lg border px-4 py-3" style={{ borderColor: 'var(--line)' }}><span style={{ color: 'var(--muted)' }}>{label}</span><strong>{value}</strong></div>;
}

function recommendedNewWords(minutes: number) {
  return Math.max(5, Math.min(35, Math.round(minutes / 2)));
}

function recommendedReviewWords(minutes: number) {
  return Math.max(15, Math.min(80, Math.round(minutes * 1.5)));
}

function getFocusText(form: { wants_listening: boolean; wants_speaking: boolean; wants_ai_tutor: boolean }) {
  const items = [];
  if (form.wants_listening) items.push('听力');
  if (form.wants_speaking) items.push('口语');
  if (form.wants_ai_tutor) items.push('AI 辅导');
  return items.length ? items.join(' / ') : '词汇复习';
}
