import React from 'react';
import { BookOpen, CheckCircle2, FastForward, Gauge, Headphones, KeyRound, RotateCcw, Save, Target, Timer, Volume2 } from 'lucide-react';
import { changePassword } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { getSettings, updateSettings } from '../api/settings';
import { getStatsOverview } from '../api/stats';
import { useAuth } from '../auth/AuthContext';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { SpeechAccent, Stats, StudyMode, UserSettings } from '../types';

const studyModes: { mode: StudyMode; label: string; description: string }[] = [
  { mode: 'en_to_cn', label: '英译中', description: '看英文回忆中文释义，适合新词入门。' },
  { mode: 'cn_to_en', label: '中译英', description: '看中文拼写英文，适合强化输出。' },
  { mode: 'listening', label: '听音辨义', description: '先听发音再回忆释义，适合听力联想。' },
  { mode: 'spelling', label: '拼写', description: '听发音后拼写英文，适合查漏补缺。' },
];

const presets = [
  { key: 'light', label: '轻量', newLimit: 5, reviewLimit: 15, description: '适合忙碌日，保持不断档。' },
  { key: 'steady', label: '标准', newLimit: 10, reviewLimit: 25, description: '适合日常使用，节奏比较均衡。' },
  { key: 'intense', label: '强化', newLimit: 20, reviewLimit: 50, description: '适合备考冲刺，但需要保证复习时间。' },
];

const speechAccents: { value: SpeechAccent; label: string; description: string }[] = [
  { value: 'en-US', label: '美音', description: '适合多数词典与考试材料，发音更圆润。' },
  { value: 'en-GB', label: '英音', description: '适合英式材料和听力辨音训练。' },
];

export function SettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = React.useState<UserSettings>({
    daily_new_limit: 10,
    daily_review_limit: 20,
    default_study_mode: 'en_to_cn',
    auto_play_word: true,
    auto_play_example: true,
    auto_reveal_after_audio: false,
    auto_advance: true,
    speech_accent: 'en-US',
    answer_delay_ms: 800,
    word_book_page_size: 30,
    onboarding_completed: false,
    learning_goal: null,
    english_level: null,
    exam_type: null,
    target_date: null,
    daily_minutes: 20,
    wants_speaking: false,
    wants_listening: false,
    wants_ai_tutor: true,
    reminder_enabled: false,
    reminder_time: null,
    membership_tier: 'free',
    membership_expires_at: null,
  });
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [message, setMessage] = React.useState<{ text: string; tone: 'success' | 'error' | 'info' }>({ text: '', tone: 'success' });
  const [isSaving, setIsSaving] = React.useState(false);
  const [passwordForm, setPasswordForm] = React.useState({ current: '', next: '', confirm: '' });
  const [isPasswordSaving, setIsPasswordSaving] = React.useState(false);

  React.useEffect(() => {
    Promise.all([getSettings(token), getStatsOverview(token)])
      .then(([nextSettings, nextStats]) => {
        setSettings(nextSettings);
        setStats(nextStats);
      })
      .catch((error) => setMessage({ text: getErrorMessage(error), tone: 'error' }));
  }, [token]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const sanitizedSettings = sanitizeSettings(settings);
    setIsSaving(true);
    try {
      const nextSettings = await updateSettings(token, sanitizedSettings);
      setSettings(nextSettings);
      setMessage({ text: '学习计划已保存。新的设置会在下一次加载学习任务时生效。', tone: 'success' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  function applyPreset(preset: (typeof presets)[number]) {
    setSettings({
      ...settings,
      daily_new_limit: preset.newLimit,
      daily_review_limit: preset.reviewLimit,
    });
    setMessage({ text: `已应用“${preset.label}”节奏，保存后生效。`, tone: 'info' });
  }

  async function handleChangePassword() {
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      setMessage({ text: '请完整填写当前密码和新密码。', tone: 'error' });
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setMessage({ text: '两次输入的新密码不一致。', tone: 'error' });
      return;
    }
    setIsPasswordSaving(true);
    try {
      await changePassword(token, passwordForm.current, passwordForm.next);
      setPasswordForm({ current: '', next: '', confirm: '' });
      setMessage({ text: '密码已修改，下次登录请使用新密码。', tone: 'success' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsPasswordSaving(false);
    }
  }

  const recommendation = getPlanRecommendation(settings, stats);
  const estimatedMinutes = estimateDailyMinutes(settings);
  const selectedMode = studyModes.find((item) => item.mode === settings.default_study_mode) ?? studyModes[0];

  return (
    <>
      <PageHeader
        title="学习计划"
        description="集中配置每日任务数量、默认学习模式、发音和背词节奏。背词页面会保持干净，只展示当前单词。"
      />
      <Message tone={message.tone}>{message.text}</Message>

      <form className="grid gap-5 xl:grid-cols-[1fr_360px]" onSubmit={handleSubmit}>
        <div className="grid gap-5">
          <section className="surface rounded-lg p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#e6efdf] text-[#355e3b]">
                <Gauge size={22} />
              </div>
              <div>
                <h3 className="text-xl font-semibold">每日节奏</h3>
                <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                  你可以直接选择预设，也可以手动调整。系统会按这个数量生成新词和复习任务。
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {presets.map((preset) => (
                <button
                  className={isPresetActive(settings, preset) ? 'button-primary justify-start' : 'button-secondary justify-start'}
                  key={preset.key}
                  onClick={() => applyPreset(preset)}
                  type="button"
                >
                  <span>
                    <span className="block">{preset.label}</span>
                    <span className="block text-xs font-medium opacity-75">{preset.description}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <NumberControl
                icon={<BookOpen size={18} />}
                label="每日新词"
                max={100}
                min={1}
                suffix="个"
                value={settings.daily_new_limit}
                onChange={(value) => setSettings({ ...settings, daily_new_limit: value })}
              />
              <NumberControl
                icon={<RotateCcw size={18} />}
                label="每日复习"
                max={200}
                min={1}
                suffix="个"
                value={settings.daily_review_limit}
                onChange={(value) => setSettings({ ...settings, daily_review_limit: value })}
              />
            </div>
          </section>

          <section className="surface rounded-lg p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#e6efdf] text-[#355e3b]">
                <FastForward size={22} />
              </div>
              <div>
                <h3 className="text-xl font-semibold">背词节奏</h3>
                <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                  这些设置会影响新词学习和复习页。需要专注背词时，页面不会再显示这些控制项。
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              <ToggleRow
                checked={settings.auto_reveal_after_audio}
                icon={<Headphones size={18} />}
                label="听完发音后自动显示答案"
                description="适合听音辨义和拼写模式，减少手动点击。"
                onChange={(checked) => setSettings({ ...settings, auto_reveal_after_audio: checked })}
              />
              <ToggleRow
                checked={settings.auto_advance}
                icon={<FastForward size={18} />}
                label="答题后自动进入下一个单词"
                description="答题后短暂停留，随后自动切换到下一词。关闭后需要手动点击下一词。"
                onChange={(checked) => setSettings({ ...settings, auto_advance: checked })}
              />
              <DelayControl
                value={settings.answer_delay_ms}
                onChange={(value) => setSettings({ ...settings, answer_delay_ms: value })}
              />
              <NumberControl
                icon={<BookOpen size={18} />}
                label="词书详情每页单词"
                max={100}
                min={10}
                suffix="个"
                value={settings.word_book_page_size}
                onChange={(value) => setSettings({ ...settings, word_book_page_size: value })}
              />
            </div>
          </section>

          <section className="surface rounded-lg p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#f5ead2] text-[#9b6b2f]">
                <Target size={22} />
              </div>
              <div>
                <h3 className="text-xl font-semibold">默认学习模式</h3>
                <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                  默认模式会在新词学习和复习页自动选中，你也可以在学习过程中临时切换。
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {studyModes.map((item) => (
                <button
                  className={settings.default_study_mode === item.mode ? 'rounded-lg border p-4 text-left' : 'rounded-lg border p-4 text-left transition hover:-translate-y-0.5'}
                  key={item.mode}
                  onClick={() => setSettings({ ...settings, default_study_mode: item.mode })}
                  style={{
                    borderColor: settings.default_study_mode === item.mode ? 'var(--green)' : 'var(--line)',
                    background: settings.default_study_mode === item.mode ? 'var(--green-soft)' : 'var(--paper)',
                  }}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{item.label}</span>
                    {settings.default_study_mode === item.mode && <CheckCircle2 size={18} style={{ color: 'var(--green)' }} />}
                  </div>
                  <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                    {item.description}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="surface rounded-lg p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#e0edf3] text-[#35637d]">
                <Headphones size={22} />
              </div>
              <div>
                <h3 className="text-xl font-semibold">发音偏好</h3>
                <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                  自动朗读可以帮助建立声音记忆。切换到下一个单词时，系统会停止当前音频。
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                {speechAccents.map((accent) => (
                  <button
                    className={settings.speech_accent === accent.value ? 'rounded-lg border p-4 text-left' : 'rounded-lg border p-4 text-left transition hover:-translate-y-0.5'}
                    key={accent.value}
                    onClick={() => setSettings({ ...settings, speech_accent: accent.value })}
                    style={{
                      borderColor: settings.speech_accent === accent.value ? 'var(--green)' : 'var(--line)',
                      background: settings.speech_accent === accent.value ? 'var(--green-soft)' : 'var(--paper)',
                    }}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{accent.label}</span>
                      {settings.speech_accent === accent.value && <CheckCircle2 size={18} style={{ color: 'var(--green)' }} />}
                    </div>
                    <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                      {accent.description}
                    </p>
                  </button>
                ))}
              </div>
              <ToggleRow
                checked={settings.auto_play_word}
                icon={<Volume2 size={18} />}
                label="进入单词时自动朗读"
                description="适合新词学习、听音辨义和拼写训练。"
                onChange={(checked) => setSettings({ ...settings, auto_play_word: checked })}
              />
              <ToggleRow
                checked={settings.auto_play_example}
                icon={<Headphones size={18} />}
                label="显示答案后朗读例句"
                description="适合通过语境理解单词，但安静环境下可以关闭。"
                onChange={(checked) => setSettings({ ...settings, auto_play_example: checked })}
              />
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-5">
          <section className="surface rounded-lg p-5">
            <h3 className="text-xl font-semibold">计划预览</h3>
            <div className="mt-4 grid gap-3">
              <PreviewMetric label="预计用时" value={`${estimatedMinutes} 分钟`} />
              <PreviewMetric label="默认模式" value={selectedMode.label} />
              <PreviewMetric label="发音口音" value={formatSpeechAccent(settings.speech_accent)} />
              <PreviewMetric label="答题停留" value={formatDelay(settings.answer_delay_ms)} />
              <PreviewMetric label="词书分页" value={`${settings.word_book_page_size} 个/页`} />
              <PreviewMetric label="今日待处理" value={`${stats?.due_today ?? 0} 个`} />
              <PreviewMetric label="本周正确率" value={`${stats?.weekly_correct_rate ?? 0}%`} />
            </div>
            <div className="mt-4 rounded-lg p-4 text-sm leading-7" style={{ background: recommendation.background, color: recommendation.color }}>
              <div className="font-bold">{recommendation.title}</div>
              <p className="mt-1">{recommendation.description}</p>
            </div>
          </section>

          <section className="surface rounded-lg p-5">
            <h3 className="text-xl font-semibold">当前保存值</h3>
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>
              保存后，新设置会写入数据库，并影响后续学习页、复习页和首页建议。
            </p>
            <button className="button-primary mt-5 w-full justify-center" disabled={isSaving} type="submit">
              <Save size={16} />
              {isSaving ? '保存中...' : '保存学习计划'}
            </button>
          </section>

          <section className="surface rounded-lg p-5">
            <div className="flex items-center gap-2">
              <KeyRound size={20} style={{ color: 'var(--green)' }} />
              <h3 className="text-xl font-semibold">账号安全</h3>
            </div>
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>
              修改当前账号密码。保存学习计划和修改密码互不影响。
            </p>
            <div className="mt-4 grid gap-3">
              <input
                autoComplete="current-password"
                className="input"
                onChange={(event) => setPasswordForm({ ...passwordForm, current: event.target.value })}
                placeholder="当前密码"
                type="password"
                value={passwordForm.current}
              />
              <input
                autoComplete="new-password"
                className="input"
                onChange={(event) => setPasswordForm({ ...passwordForm, next: event.target.value })}
                placeholder="新密码，至少 6 位"
                type="password"
                value={passwordForm.next}
              />
              <input
                autoComplete="new-password"
                className="input"
                onChange={(event) => setPasswordForm({ ...passwordForm, confirm: event.target.value })}
                placeholder="再次输入新密码"
                type="password"
                value={passwordForm.confirm}
              />
              <button className="button-secondary w-full justify-center" disabled={isPasswordSaving} onClick={handleChangePassword} type="button">
                <KeyRound size={16} />
                {isPasswordSaving ? '修改中...' : '修改密码'}
              </button>
            </div>
          </section>
        </aside>
      </form>
    </>
  );
}

function NumberControl({
  icon,
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  const clamped = clampNumber(value, min, max);

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--ink)' }}>
          {icon}
          {label}
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>
          {clamped} {suffix}
        </span>
      </div>
      <input
        className="w-full accent-[#355e3b]"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={clamped}
      />
      <div className="mt-3 flex items-center gap-2">
        <button className="button-secondary h-9 px-3" onClick={() => onChange(clamped - 1)} type="button">-</button>
        <input
          className="input h-9 min-h-9"
          max={max}
          min={min}
          onChange={(event) => onChange(Number(event.target.value))}
          type="number"
          value={clamped}
        />
        <button className="button-secondary h-9 px-3" onClick={() => onChange(clamped + 1)} type="button">+</button>
      </div>
    </div>
  );
}

function DelayControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const options = [
    { value: 450, label: '快' },
    { value: 800, label: '标准' },
    { value: 1300, label: '慢' },
  ];

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--ink)' }}>
          <Timer size={18} />
          答题后停留
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>{formatDelay(value)}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            className={value === option.value ? 'button-primary' : 'button-secondary'}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  checked,
  icon,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  icon: React.ReactNode;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      className="flex items-center justify-between gap-4 rounded-lg border p-4 text-left transition hover:-translate-y-0.5"
      onClick={() => onChange(!checked)}
      style={{ borderColor: checked ? 'var(--green)' : 'var(--line)', background: checked ? 'var(--green-soft)' : 'var(--paper)' }}
      type="button"
    >
      <span className="flex items-start gap-3">
        <span className="mt-1" style={{ color: checked ? 'var(--green)' : 'var(--muted)' }}>{icon}</span>
        <span>
          <span className="block font-semibold" style={{ color: 'var(--ink)' }}>{label}</span>
          <span className="mt-1 block text-sm leading-6" style={{ color: 'var(--muted)' }}>{description}</span>
        </span>
      </span>
      <span
        className="relative h-6 w-11 shrink-0 rounded-full transition"
        style={{ background: checked ? 'var(--green)' : 'var(--line)' }}
      >
        <span
          className="absolute top-1 h-4 w-4 rounded-full bg-white transition"
          style={{ left: checked ? 22 : 4 }}
        />
      </span>
    </button>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="font-semibold" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

function sanitizeSettings(settings: UserSettings) {
  return {
    ...settings,
    speech_accent: settings.speech_accent ?? 'en-US',
    daily_new_limit: clampNumber(settings.daily_new_limit, 1, 100),
    daily_review_limit: clampNumber(settings.daily_review_limit, 1, 200),
    answer_delay_ms: clampNumber(settings.answer_delay_ms, 300, 3000),
    word_book_page_size: clampNumber(settings.word_book_page_size, 10, 100),
  };
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function estimateDailyMinutes(settings: UserSettings) {
  const newWordMinutes = settings.daily_new_limit * 1.2;
  const reviewMinutes = settings.daily_review_limit * 0.45;
  return Math.max(1, Math.round(newWordMinutes + reviewMinutes));
}

function formatDelay(value: number) {
  if (value <= 500) return '快';
  if (value <= 900) return '标准';
  return '慢';
}

function formatSpeechAccent(value: SpeechAccent) {
  return value === 'en-GB' ? '英音' : '美音';
}

function isPresetActive(settings: UserSettings, preset: (typeof presets)[number]) {
  return settings.daily_new_limit === preset.newLimit && settings.daily_review_limit === preset.reviewLimit;
}

function getPlanRecommendation(settings: UserSettings, stats: Stats | null) {
  if (stats && stats.due_review >= 30 && settings.daily_new_limit > 10) {
    return {
      title: '建议先降低新词量',
      description: '当前待复习较多，继续加大量新词会让后续压力变高。',
      color: 'var(--red)',
      background: 'var(--red-soft)',
    };
  }

  if (stats && stats.weekly_reviews > 0 && stats.weekly_correct_rate < 60 && settings.daily_new_limit > 10) {
    return {
      title: '建议放慢节奏',
      description: '近期正确率偏低，可以先减少新词，把复习和错词稳定下来。',
      color: 'var(--amber)',
      background: 'var(--amber-soft)',
    };
  }

  if (settings.daily_new_limit >= 20 || settings.daily_review_limit >= 50) {
    return {
      title: '强化节奏',
      description: '这个计划强度较高，适合短期冲刺。建议每天固定时间完成。',
      color: 'var(--amber)',
      background: 'var(--amber-soft)',
    };
  }

  return {
    title: '节奏健康',
    description: '当前计划比较稳，适合长期坚持。完成每日任务后再考虑加量。',
    color: 'var(--green)',
    background: 'var(--green-soft)',
  };
}
