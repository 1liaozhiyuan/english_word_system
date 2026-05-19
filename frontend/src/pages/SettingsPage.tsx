import React from 'react';
import { getErrorMessage } from '../api/client';
import { getSettings, updateSettings } from '../api/settings';
import { useAuth } from '../auth/AuthContext';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { StudyMode, UserSettings } from '../types';

const studyModes: [StudyMode, string][] = [
  ['en_to_cn', '英译中：看英文回忆中文'],
  ['cn_to_en', '中译英：看中文拼写英文'],
  ['listening', '听音辨义：听发音回忆中文'],
  ['spelling', '拼写：听发音拼写英文'],
];

export function SettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = React.useState<UserSettings>({
    daily_new_limit: 10,
    daily_review_limit: 20,
    default_study_mode: 'en_to_cn',
    auto_play_word: true,
    auto_play_example: true,
  });
  const [message, setMessage] = React.useState<{ text: string; tone: 'success' | 'error' }>({ text: '', tone: 'success' });

  React.useEffect(() => {
    getSettings(token)
      .then(setSettings)
      .catch((error) => setMessage({ text: getErrorMessage(error), tone: 'error' }));
  }, [token]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const sanitizedSettings = {
      ...settings,
      daily_new_limit: clampNumber(settings.daily_new_limit, 1, 100),
      daily_review_limit: clampNumber(settings.daily_review_limit, 1, 200),
    };
    try {
      const nextSettings = await updateSettings(token, sanitizedSettings);
      setSettings(nextSettings);
      setMessage({ text: '学习计划已保存。', tone: 'success' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    }
  }

  return (
    <>
      <PageHeader title="设置" description="配置每日任务数量、默认学习模式和发音偏好。" />
      <Message tone={message.tone}>{message.text}</Message>
      <section className="surface rounded-lg p-5">
        <form className="grid max-w-2xl gap-4" onSubmit={handleSubmit}>
          <label className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
            默认学习模式
            <div className="mt-2 flex flex-wrap gap-2">
              {studyModes.map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={settings.default_study_mode === mode ? 'button-primary' : 'button-secondary'}
                  onClick={() => setSettings({ ...settings, default_study_mode: mode })}
                >
                  {label}
                </button>
              ))}
            </div>
          </label>

          <label className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
            每日新词数量
            <input
              className="input mt-2"
              min={1}
              max={100}
              type="number"
              value={settings.daily_new_limit}
              onChange={(event) => setSettings({ ...settings, daily_new_limit: Number(event.target.value) })}
            />
          </label>

          <label className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
            每日复习数量
            <input
              className="input mt-2"
              min={1}
              max={200}
              type="number"
              value={settings.daily_review_limit}
              onChange={(event) => setSettings({ ...settings, daily_review_limit: Number(event.target.value) })}
            />
          </label>

          <div className="grid gap-3 rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--ink)' }}>发音偏好</div>
              <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                控制学习卡片是否自动朗读单词和例句。切换到下一个单词时，会自动停止当前音频。
              </p>
            </div>
            <ToggleRow
              checked={settings.auto_play_word}
              label="进入单词时自动朗读"
              onChange={(checked) => setSettings({ ...settings, auto_play_word: checked })}
            />
            <ToggleRow
              checked={settings.auto_play_example}
              label="显示答案后朗读例句"
              onChange={(checked) => setSettings({ ...settings, auto_play_example: checked })}
            />
          </div>

          <button className="button-primary w-fit" type="submit">
            保存设置
          </button>
        </form>
      </section>
    </>
  );
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3" style={{ borderColor: 'var(--line)' }}>
      <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{label}</span>
      <input
        checked={checked}
        className="h-5 w-5 accent-[#355e3b]"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}
