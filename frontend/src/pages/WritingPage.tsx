import React from 'react';
import { CheckCircle2, FilePenLine, RotateCcw, Send } from 'lucide-react';
import { getErrorMessage } from '../api/client';
import { getWritingPrompts, getWritingSubmissions, submitWriting } from '../api/writing';
import { useAuth } from '../auth/AuthContext';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { WritingPrompt, WritingSubmission } from '../types';

export function WritingPage() {
  const { token } = useAuth();
  const [prompts, setPrompts] = React.useState<WritingPrompt[]>([]);
  const [submissions, setSubmissions] = React.useState<WritingSubmission[]>([]);
  const [selectedPrompt, setSelectedPrompt] = React.useState('');
  const [content, setContent] = React.useState('');
  const [latest, setLatest] = React.useState<WritingSubmission | null>(null);
  const [message, setMessage] = React.useState<{ text: string; tone: 'success' | 'error' | 'info' }>({ text: '', tone: 'info' });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function loadData() {
    setIsLoading(true);
    try {
      const [nextPrompts, nextSubmissions] = await Promise.all([
        getWritingPrompts(token, 8),
        getWritingSubmissions(token, 20),
      ]);
      setPrompts(nextPrompts);
      setSubmissions(nextSubmissions);
      setSelectedPrompt((current) => current || nextPrompts[0]?.prompt || '');
      setLatest(null);
      setMessage(nextPrompts.length ? { text: '', tone: 'info' } : { text: '请先选择词库并学习一些单词，系统会根据你的词库生成写作题目。', tone: 'info' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit() {
    if (!selectedPrompt || !content.trim()) {
      setMessage({ text: '请先选择题目并输入你的英文内容。', tone: 'info' });
      return;
    }
    setIsSubmitting(true);
    try {
      const submission = await submitWriting(token, {
        prompt: selectedPrompt,
        content: content.trim(),
      });
      setLatest(submission);
      setSubmissions((items) => [submission, ...items]);
      setContent('');
      setMessage({ text: '写作练习已保存，并生成了基础反馈。', tone: 'success' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  React.useEffect(() => {
    loadData();
  }, [token]);

  const selectedMeta = prompts.find((item) => item.prompt === selectedPrompt);

  return (
    <>
      <PageHeader
        title="写作训练"
        description="围绕已学单词生成造句和短文题目，提交后保存历史记录并给出基础评分。后续可接入 AI 作文批改。"
        action={<button className="button-secondary" onClick={loadData} type="button"><RotateCcw size={16} />刷新题目</button>}
      />
      <Message tone={message.tone}>{message.text}</Message>

      {isLoading && <section className="surface rounded-lg p-5 text-sm" style={{ color: 'var(--muted)' }}>正在准备写作题目...</section>}

      {!isLoading && (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="surface rounded-lg p-5">
            <div className="flex items-center gap-2">
              <FilePenLine size={22} style={{ color: 'var(--green)' }} />
              <h2 className="text-2xl font-semibold">本次练习</h2>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>写作题目</span>
              <select
                className="input mt-2"
                onChange={(event) => {
                  setSelectedPrompt(event.target.value);
                  setLatest(null);
                }}
                value={selectedPrompt}
              >
                {prompts.map((item) => (
                  <option key={item.prompt} value={item.prompt}>{item.prompt}</option>
                ))}
              </select>
            </label>

            {selectedMeta && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedMeta.keyword && <span className="chip">关键词：{selectedMeta.keyword}</span>}
                {selectedMeta.meaning && <span className="chip">提示：{selectedMeta.meaning}</span>}
              </div>
            )}

            <label className="mt-5 block">
              <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>你的英文内容</span>
              <textarea
                className="input mt-2 min-h-[220px]"
                onChange={(event) => setContent(event.target.value)}
                placeholder="Write your sentence or paragraph here..."
                value={content}
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                {wordCount(content)} words
              </span>
              <button className="button-primary" disabled={isSubmitting} onClick={handleSubmit} type="button">
                <Send size={16} />
                {isSubmitting ? '正在提交...' : '提交写作'}
              </button>
            </div>

            {latest && (
              <div className="mt-5 rounded-lg border p-4" style={{ borderColor: 'var(--green)', background: 'var(--green-soft)' }}>
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={18} />
                  本次得分 {latest.score}
                </div>
                <p className="mt-2 text-sm leading-6">{latest.feedback}</p>
              </div>
            )}
          </div>

          <aside className="surface rounded-lg p-5">
            <h3 className="text-xl font-semibold">历史写作</h3>
            <div className="mt-4 grid max-h-[620px] gap-3 overflow-y-auto pr-1">
              {submissions.map((item) => (
                <article className="rounded-lg border p-4" key={item.id} style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <strong>{item.score} 分</strong>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{formatDate(item.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6">{item.prompt}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>{item.content}</p>
                  <p className="mt-2 text-xs leading-5" style={{ color: 'var(--muted)' }}>{item.feedback}</p>
                </article>
              ))}
              {submissions.length === 0 && <p className="rounded-lg border p-4 text-sm" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>暂无写作记录。</p>}
            </div>
          </aside>
        </section>
      )}
    </>
  );
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
