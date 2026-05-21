import React from 'react';
import { CheckCircle2, Mic, RotateCcw, Send, Volume2 } from 'lucide-react';
import { getSpeakingAttempts, getSpeakingSession, submitSpeakingAttempt } from '../api/speaking';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { SpeakingAttempt, SpeakingPrompt } from '../types';

export function SpeakingPage() {
  const { token } = useAuth();
  const [prompts, setPrompts] = React.useState<SpeakingPrompt[]>([]);
  const [attempts, setAttempts] = React.useState<SpeakingAttempt[]>([]);
  const [index, setIndex] = React.useState(0);
  const [transcript, setTranscript] = React.useState('');
  const [latest, setLatest] = React.useState<SpeakingAttempt | null>(null);
  const [message, setMessage] = React.useState<{ text: string; tone: 'success' | 'error' | 'info' }>({ text: '', tone: 'info' });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const current = prompts[index];

  async function loadData() {
    setIsLoading(true);
    try {
      const [nextPrompts, nextAttempts] = await Promise.all([
        getSpeakingSession(token, 8),
        getSpeakingAttempts(token),
      ]);
      setPrompts(nextPrompts);
      setAttempts(nextAttempts);
      setIndex(0);
      setTranscript('');
      setLatest(null);
      setMessage(nextPrompts.length ? { text: '', tone: 'info' } : { text: '请先选择词库，系统会从你的学习内容中生成跟读材料。', tone: 'info' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  function playPrompt(text = current?.prompt_text) {
    if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }

  async function handleSubmit() {
    if (!current || !transcript.trim()) {
      setMessage({ text: '请先输入或粘贴你的跟读文本。', tone: 'info' });
      return;
    }
    setIsSubmitting(true);
    try {
      const attempt = await submitSpeakingAttempt(token, {
        word_id: current.word_id,
        prompt_text: current.prompt_text,
        transcript,
      });
      setLatest(attempt);
      setAttempts((items) => [attempt, ...items]);
      setMessage({ text: '跟读结果已保存。', tone: 'success' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function nextPrompt() {
    setIndex((value) => Math.min(value + 1, prompts.length - 1));
    setTranscript('');
    setLatest(null);
  }

  React.useEffect(() => {
    loadData();
  }, [token]);

  return (
    <>
      <PageHeader
        title="口语跟读"
        description="从真实词库例句生成跟读材料，保存练习文本、评分和反馈，后续可升级为录音评测。"
        action={<button className="button-secondary" onClick={loadData} type="button"><RotateCcw size={16} />刷新材料</button>}
      />
      <Message tone={message.tone}>{message.text}</Message>

      {isLoading && <section className="surface rounded-lg p-5 text-sm" style={{ color: 'var(--muted)' }}>正在准备口语材料...</section>}

      {!isLoading && current && (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="surface rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>第 {index + 1} / {prompts.length} 条</p>
                <h2 className="mt-2 text-2xl font-semibold">{current.word_text}</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{current.phonetic ?? current.meaning}</p>
              </div>
              <button className="button-primary" onClick={() => playPrompt()} type="button">
                <Volume2 size={18} />
                播放示范
              </button>
            </div>

            <div className="mt-5 rounded-lg border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--muted)' }}>
                <Mic size={17} />
                跟读文本
              </div>
              <p className="mt-3 text-2xl font-semibold leading-10">{current.prompt_text}</p>
              {current.translation && <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>{current.translation}</p>}
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>你的跟读文本</span>
              <textarea
                className="input mt-2 min-h-[130px]"
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="可以使用系统语音输入或手动输入你刚刚跟读的内容"
                value={transcript}
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="button-primary" disabled={isSubmitting} onClick={handleSubmit} type="button">
                <Send size={16} />
                {isSubmitting ? '正在保存...' : '提交跟读'}
              </button>
              <button className="button-secondary" disabled={index >= prompts.length - 1} onClick={nextPrompt} type="button">下一条</button>
            </div>

            {latest && (
              <div className="mt-5 rounded-lg border p-4" style={{ borderColor: 'var(--green)', background: 'var(--green-soft)' }}>
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={18} />
                  得分 {latest.accuracy_score}
                </div>
                <p className="mt-2 text-sm leading-6">{latest.feedback}</p>
              </div>
            )}
          </div>

          <aside className="surface rounded-lg p-5">
            <h3 className="text-xl font-semibold">历史跟读</h3>
            <div className="mt-4 grid max-h-[520px] gap-3 overflow-y-auto pr-1">
              {attempts.map((item) => (
                <article className="rounded-lg border p-3" key={item.id} style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <strong>{item.accuracy_score} 分</strong>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{formatDate(item.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>{item.prompt_text}</p>
                </article>
              ))}
              {attempts.length === 0 && <p className="rounded-lg border p-4 text-sm" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>暂无跟读记录。</p>}
            </div>
          </aside>
        </section>
      )}
    </>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
