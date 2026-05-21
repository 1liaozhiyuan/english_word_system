import React from 'react';
import { CheckCircle2, Headphones, RotateCcw, Volume2, XCircle } from 'lucide-react';
import { answerListeningQuestion, getListeningSession } from '../api/listening';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { ListeningAnswerResult, ListeningQuestion } from '../types';

export function ListeningPage() {
  const { token } = useAuth();
  const [questions, setQuestions] = React.useState<ListeningQuestion[]>([]);
  const [index, setIndex] = React.useState(0);
  const [result, setResult] = React.useState<ListeningAnswerResult | null>(null);
  const [selected, setSelected] = React.useState('');
  const [message, setMessage] = React.useState<{ text: string; tone: 'success' | 'error' | 'info' }>({ text: '', tone: 'info' });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const current = questions[index];

  async function loadSession() {
    setIsLoading(true);
    try {
      const next = await getListeningSession(token, 10);
      setQuestions(next);
      setIndex(0);
      setSelected('');
      setResult(null);
      setMessage(next.length ? { text: '', tone: 'info' } : { text: '请先选择词库或完成一些学习记录，再开始听力训练。', tone: 'info' });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  function playWord(word = current?.audio_text) {
    if (!word || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.86;
    window.speechSynthesis.speak(utterance);
  }

  async function submitAnswer(option: string) {
    if (!current || isSubmitting || result) return;
    setSelected(option);
    setIsSubmitting(true);
    try {
      const next = await answerListeningQuestion(token, {
        word_id: current.word_id,
        word_book_id: current.word_book_id,
        selected_meaning: option,
      });
      setResult(next);
      if (next.is_correct) {
        window.setTimeout(() => goNext(), 650);
      }
    } catch (error) {
      setMessage({ text: getErrorMessage(error), tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function goNext() {
    setResult(null);
    setSelected('');
    setIndex((value) => Math.min(value + 1, questions.length));
  }

  React.useEffect(() => {
    loadSession();
  }, [token]);

  React.useEffect(() => {
    if (current) {
      const timer = window.setTimeout(() => playWord(current.audio_text), 250);
      return () => window.clearTimeout(timer);
    }
  }, [current?.id]);

  const completed = index >= questions.length && questions.length > 0;

  return (
    <>
      <PageHeader
        title="听力训练"
        description="从你的词库和学习进度中抽取真实单词，先听发音再选择释义，答题后写入复习记录。"
        action={<button className="button-secondary" onClick={loadSession} type="button"><RotateCcw size={16} />重新生成</button>}
      />
      <Message tone={message.tone}>{message.text}</Message>

      {isLoading && <section className="surface rounded-lg p-5 text-sm" style={{ color: 'var(--muted)' }}>正在准备听力题...</section>}

      {!isLoading && current && (
        <section className="surface rounded-lg p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>第 {index + 1} / {questions.length} 题</p>
              <h2 className="mt-2 text-2xl font-semibold">听发音，选择正确释义</h2>
              {current.phonetic && <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{current.phonetic}</p>}
            </div>
            <button className="button-primary" onClick={() => playWord()} type="button">
              <Volume2 size={18} />
              播放
            </button>
          </div>

          <div className="mt-6 flex min-h-[160px] items-center justify-center rounded-lg border" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            <Headphones size={52} style={{ color: 'var(--green)' }} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {current.options.map((option) => {
              const isSelected = selected === option;
              const isCorrect = result?.correct_answer === option;
              const showWrong = result && isSelected && !isCorrect;
              return (
                <button
                  className="rounded-lg border p-4 text-left transition hover:-translate-y-0.5"
                  disabled={isSubmitting || Boolean(result)}
                  key={option}
                  onClick={() => submitAnswer(option)}
                  style={{
                    borderColor: isCorrect && result ? 'var(--green)' : showWrong ? 'var(--red)' : 'var(--line)',
                    background: isCorrect && result ? 'var(--green-soft)' : showWrong ? 'var(--red-soft)' : 'var(--paper)',
                  }}
                  type="button"
                >
                  <span className="font-semibold">{option}</span>
                </button>
              );
            })}
          </div>

          {result && (
            <div className="mt-5 rounded-lg border p-4" style={{ borderColor: result.is_correct ? 'var(--green)' : 'var(--red)', background: result.is_correct ? 'var(--green-soft)' : 'var(--red-soft)' }}>
              <div className="flex items-center gap-2 font-semibold">
                {result.is_correct ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                {result.is_correct ? '回答正确' : '回答错误'}
              </div>
              <p className="mt-2 text-sm leading-6">{result.explanation}</p>
              {!result.is_correct && <button className="button-primary mt-4" onClick={goNext} type="button">下一题</button>}
            </div>
          )}
        </section>
      )}

      {!isLoading && completed && (
        <section className="surface rounded-lg p-6 text-center">
          <CheckCircle2 className="mx-auto" size={42} style={{ color: 'var(--green)' }} />
          <h2 className="mt-3 text-2xl font-semibold">本轮听力训练完成</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>练习结果已进入学习记录，答错的单词会继续参与复习。</p>
          <button className="button-primary mx-auto mt-5" onClick={loadSession} type="button">再练一轮</button>
        </section>
      )}
    </>
  );
}
