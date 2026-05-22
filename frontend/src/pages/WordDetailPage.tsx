import React from 'react';
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  Headphones,
  Trash2,
  NotebookPen,
  RotateCcw,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { deleteAIExample, explainWord, generateExample, generateStructuredQuiz, getAIExamples, recordAIQuestionAttempt, saveAIExample } from '../api/ai';
import { getErrorMessage } from '../api/client';
import { getWordDetail } from '../api/wordBooks';
import { useAuth } from '../auth/AuthContext';
import { AIResultPanel } from '../components/AIResultPanel';
import { FavoriteButton } from '../components/FavoriteButton';
import { LoadingState } from '../components/LoadingState';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import type { AIQuizQuestion, AISavedExample, WordDetail } from '../types';

export function WordDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const wordId = Number(id);
  const [detail, setDetail] = React.useState<WordDetail | null>(null);
  const [message, setMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [aiTitle, setAiTitle] = React.useState('AI 讲解');
  const [aiContent, setAiContent] = React.useState('');
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [savedExamples, setSavedExamples] = React.useState<AISavedExample[]>([]);
  const [saveMessage, setSaveMessage] = React.useState('');
  const [aiQuestions, setAiQuestions] = React.useState<AIQuizQuestion[]>([]);
  const aiAbortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    setIsLoading(true);
    setMessage('');
    getWordDetail(token, wordId)
      .then(setDetail)
      .catch((error) => setMessage(getErrorMessage(error)))
      .finally(() => setIsLoading(false));
    getAIExamples(token, wordId)
      .then(setSavedExamples)
      .catch(() => setSavedExamples([]));
  }, [token, wordId]);

  function speak(text: string) {
    if (!window.speechSynthesis || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.86;
    window.speechSynthesis.speak(utterance);
  }

  async function runAI(kind: 'explain' | 'example' | 'quiz') {
    if (!detail) return;
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setIsAiLoading(true);
    setAiContent('');
    setSaveMessage('');
    setAiQuestions([]);
    setAiTitle(kind === 'explain' ? 'AI 单词讲解' : kind === 'example' ? 'AI 例句扩展' : 'AI 变式练习');
    try {
      if (kind === 'quiz') {
        setAiQuestions(await generateStructuredQuiz(token, [detail.word], '单词应用题'));
        return;
      }
      const content = kind === 'explain'
        ? await explainWord(token, detail.word, setAiContent, { signal: controller.signal })
        : await generateExample(token, detail.word, '中等', setAiContent, { signal: controller.signal });
      setAiContent(content);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setAiContent(getErrorMessage(error));
    } finally {
      setIsAiLoading(false);
      if (aiAbortRef.current === controller) aiAbortRef.current = null;
    }
  }

  function stopAI() {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setIsAiLoading(false);
  }

  async function handleSaveAIExample() {
    const first = parseExampleCandidates(aiContent)[0];
    if (!first) return;
    await saveCandidate(first);
  }

  async function saveCandidate(candidate: ExampleCandidate) {
    if (!detail) return;
    try {
      const saved = await saveAIExample(token, {
        word_id: detail.word.id,
        sentence: candidate.sentence,
        translation: candidate.translation,
        raw_content: aiContent,
      });
      setSavedExamples((items) => [saved, ...items]);
      setSaveMessage('已保存到数据库。');
    } catch (error) {
      setSaveMessage(getErrorMessage(error));
    }
  }

  async function handleDeleteExample(exampleId: number) {
    try {
      await deleteAIExample(token, exampleId);
      setSavedExamples((items) => items.filter((item) => item.id !== exampleId));
      setSaveMessage('已删除保存例句。');
    } catch (error) {
      setSaveMessage(getErrorMessage(error));
    }
  }

  return (
    <>
      <PageHeader
        title={detail?.word.text ?? '单词详情'}
        description="查看释义、例句、掌握度、复习安排和 AI 深度讲解。"
        action={(
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/word-books">
              <ArrowLeft size={16} />
              返回词库
            </Link>
            <Link className="button-secondary" to="/dashboard">
              首页
            </Link>
          </div>
        )}
      />
      <Message tone="error">{message}</Message>
      {isLoading && <LoadingState text="正在加载单词详情..." />}

      {!isLoading && detail && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-5">
            <section className="surface rounded-lg p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                      {statusText(detail.status)}
                    </span>
                    {detail.is_leech && (
                      <span className="chip" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
                        重点难词
                      </span>
                    )}
                  </div>
                  <h2 className="mt-4 break-words text-5xl font-semibold tracking-normal md:text-6xl">
                    {detail.word.text}
                  </h2>
                  {detail.word.phonetic && (
                    <p className="mt-3 text-lg font-semibold" style={{ color: 'var(--green)' }}>
                      {detail.word.phonetic}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="button-secondary" onClick={() => speak(detail.word.text)} type="button">
                    <Volume2 size={16} />
                    发音
                  </button>
                  <FavoriteButton wordId={detail.word.id} initialFavorite={detail.is_favorite} />
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <InfoBlock title="中文释义" value={detail.word.meaning} />
                <InfoBlock title="英文释义" value={detail.word.english_definition || '暂无英文释义'} />
                <InfoBlock title="词性" value={detail.word.part_of_speech || '未填写'} />
                <InfoBlock title="难度与考试" value={[detail.word.difficulty_tag, detail.word.exam_tags].filter(Boolean).join(' · ') || '暂无标签'} />
                <InfoBlock title="英文例句" value={detail.word.example_sentence || '暂无例句'} />
                <InfoBlock title="例句翻译" value={detail.word.example_translation || '暂无翻译'} />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <InfoBlock title="词根词缀" value={detail.word.root_affix || '暂无词根词缀'} />
                <InfoBlock title="常见搭配" value={detail.word.collocations || '暂无搭配'} />
                <InfoBlock title="同义词" value={detail.word.synonyms || '暂无同义词'} />
                <InfoBlock title="反义词" value={detail.word.antonyms || '暂无反义词'} />
                <InfoBlock title="派生词" value={detail.word.word_family || '暂无派生词'} />
                <InfoBlock title="易混词" value={detail.word.confusing_words || '暂无易混词'} />
              </div>
              {detail.word.note && (
                <div className="mt-4 rounded-lg border p-4 text-sm leading-7" style={{ borderColor: 'var(--line)', background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                  <strong>学习笔记：</strong>{detail.word.note}
                </div>
              )}
            </section>

            <section className="surface rounded-lg p-5">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={21} style={{ color: 'var(--green)' }} />
                <h3 className="text-xl font-semibold">AI 学习助手</h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <button className="button-primary" disabled={isAiLoading} onClick={() => runAI('explain')} type="button">
                  <Sparkles size={16} />
                  深度讲解
                </button>
                <button className="button-secondary" disabled={isAiLoading} onClick={() => runAI('example')} type="button">
                  <BookOpen size={16} />
                  生成例句
                </button>
                <button className="button-secondary" disabled={isAiLoading} onClick={() => runAI('quiz')} type="button">
                  <ClipboardCheck size={16} />
                  生成练习
                </button>
              </div>
              {aiTitle.includes('练习') ? (
                <ProgressiveAIPractice questions={aiQuestions} isLoading={isAiLoading} token={token} />
              ) : (
                <AIResultPanel title={aiTitle} content={aiContent} isLoading={isAiLoading} onStop={stopAI} />
              )}
              {aiTitle.includes('例句') && aiContent && !isAiLoading && (
                <div className="mt-4 rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>请选择要保存的例句，不会默认把整段 AI 内容都存进去。</p>
                  <div className="mt-3 grid gap-2">
                    {parseExampleCandidates(aiContent).map((candidate, index) => (
                      <div className="rounded-lg border p-3" key={`${candidate.sentence}-${index}`} style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
                        <p className="leading-7">{candidate.sentence}</p>
                        {candidate.translation && <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{candidate.translation}</p>}
                        <button className="button-primary mt-3" onClick={() => saveCandidate(candidate)} type="button">保存这条</button>
                      </div>
                    ))}
                  </div>
                  {parseExampleCandidates(aiContent).length === 0 && <button className="button-primary mt-3" onClick={handleSaveAIExample} type="button">保存例句</button>}
                  {saveMessage && <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--green)' }}>{saveMessage}</p>}
                </div>
              )}
            </section>
            <section className="surface rounded-lg p-5">
              <h3 className="text-xl font-semibold">已保存 AI 例句</h3>
              <div className="mt-4 grid gap-3">
                {savedExamples.map((example) => (
                  <div className="rounded-lg border p-4" key={example.id} style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                    <p className="leading-7">{example.sentence}</p>
                    {example.translation && <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>{example.translation}</p>}
                    <button className="button-secondary mt-3" onClick={() => handleDeleteExample(example.id)} type="button">
                      <Trash2 size={16} />
                      删除
                    </button>
                  </div>
                ))}
                {savedExamples.length === 0 && (
                  <p className="rounded-lg border p-4 text-sm" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
                    暂无保存例句。生成 AI 例句后可以保存到这里。
                  </p>
                )}
              </div>
            </section>
          </div>

          <aside className="grid content-start gap-5">
            <section className="surface rounded-lg p-5">
              <h3 className="text-xl font-semibold">学习状态</h3>
              <div className="mt-4 grid gap-3">
                <ProgressRow label="掌握度" value={`${detail.mastery_level}`} />
                <ProgressRow label="正确次数" value={`${detail.correct_count}`} />
                <ProgressRow label="错误次数" value={`${detail.wrong_count}`} danger={detail.wrong_count > 0} />
                <ProgressRow label="记忆间隔" value={formatInterval(detail.interval_days)} />
                <ProgressRow label="下次复习" value={formatDate(detail.next_review_at)} />
              </div>
            </section>

            <section className="surface rounded-lg p-5">
              <div className="flex items-center gap-2">
                <CalendarClock size={20} style={{ color: 'var(--green)' }} />
                <h3 className="text-xl font-semibold">复习建议</h3>
              </div>
              <p className="mt-3 text-sm leading-7" style={{ color: 'var(--muted)' }}>
                {getReviewAdvice(detail)}
              </p>
              <div className="mt-4 grid gap-2">
                <Link className="button-secondary" to="/review">
                  <RotateCcw size={16} />
                  今日复习
                </Link>
                <Link className="button-secondary" to="/mistakes">
                  <NotebookPen size={16} />
                  错题本
                </Link>
                <Link className="button-secondary" to="/quiz">
                  <Headphones size={16} />
                  专项测试
                </Link>
              </div>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}

type ExampleCandidate = { sentence: string; translation: string | null };

function parseExampleCandidates(content: string): ExampleCandidate[] {
  const lines = content
    .split('\n')
    .map((line) => line.replace(/^\s*[-*\d.、]+\s*/, '').replace(/^(英文|例句|翻译|中文)[:：]\s*/, '').trim())
    .filter(Boolean);
  const candidates: ExampleCandidate[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!/[a-zA-Z]/.test(line) || line.length < 8) continue;
    const next = lines[index + 1];
    candidates.push({
      sentence: line.slice(0, 1000),
      translation: next && /[\u4e00-\u9fa5]/.test(next) ? next.slice(0, 1000) : null,
    });
  }
  return candidates.slice(0, 8);
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--muted)' }}>{title}</div>
      <p className="mt-2 break-words text-base leading-7" style={{ color: 'var(--ink)' }}>{value}</p>
    </div>
  );
}

function ProgressiveAIPractice({ questions, isLoading, token }: { questions: AIQuizQuestion[]; isLoading: boolean; token: string }) {
  const [index, setIndex] = React.useState(0);
  const [answer, setAnswer] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setIndex(0);
    setAnswer('');
    setSubmitted(false);
    setError('');
  }, [questions]);

  async function submitAnswer() {
    if (!answer.trim()) return;
    try {
      await recordAIQuestionAttempt(token, question.id, answer);
      setSubmitted(true);
      setError('');
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  if (isLoading) {
    return (
      <div className="mt-4 rounded-lg border p-4 text-sm" style={{ borderColor: 'var(--line)', background: 'var(--paper)', color: 'var(--muted)' }}>
        AI 正在生成练习题...
      </div>
    );
  }
  if (!questions.length) return null;
  const question = questions[Math.min(index, questions.length - 1)];
  const isCorrect = normalizeAnswer(answer) === normalizeAnswer(question.answer);
  const isLast = index + 1 >= questions.length;
  return (
    <div className="mt-4 rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="chip" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
          第 {index + 1} / {questions.length} 题
        </span>
        <span className="text-sm" style={{ color: 'var(--muted)' }}>提交后才显示答案解析</span>
      </div>
      <p className="mt-4 text-lg font-semibold leading-8">{question.prompt}</p>
      {question.options.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {question.options.map((option) => (
            <button
              className={answer === option ? 'answer answer-good justify-start px-4 text-left' : 'answer justify-start px-4 text-left'}
              disabled={submitted}
              key={option}
              onClick={() => setAnswer(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <input
          className="input mt-4"
          disabled={submitted}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && answer.trim()) submitAnswer();
          }}
          placeholder="输入你的答案..."
          value={answer}
        />
      )}
      {!submitted ? (
        <button className="button-primary mt-4" disabled={!answer.trim()} onClick={submitAnswer} type="button">
          提交答案
        </button>
      ) : (
        <div className="mt-4 rounded-lg border p-4" style={{ borderColor: isCorrect ? 'var(--green)' : 'var(--red)', background: isCorrect ? 'var(--green-soft)' : 'var(--red-soft)' }}>
          <div className="font-bold" style={{ color: isCorrect ? 'var(--green)' : 'var(--red)' }}>
            {isCorrect ? '回答正确' : '回答错误'}
          </div>
          <p className="mt-2 text-sm leading-7">正确答案：{question.answer}</p>
          {question.explanation && <p className="mt-1 text-sm leading-7">解析：{question.explanation}</p>}
          <button
            className="button-primary mt-3"
            onClick={() => {
              if (!isLast) {
                setIndex((value) => value + 1);
                setAnswer('');
                setSubmitted(false);
              }
            }}
            disabled={isLast}
            type="button"
          >
            {isLast ? '已完成全部 AI 练习' : '下一题'}
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--red)' }}>{error}</p>}
    </div>
  );
}

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/^[a-d][.、\s]+/i, '');
}

function ProgressRow({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="font-semibold" style={{ color: danger ? 'var(--red)' : 'var(--ink)' }}>{value}</span>
    </div>
  );
}

function statusText(status: string | null) {
  if (status === 'mastered') return '已掌握';
  if (status === 'reviewing') return '复习中';
  if (status === 'learning') return '学习中';
  if (status === 'new') return '新词';
  return '未加入计划';
}

function formatInterval(value: number) {
  if (!value) return '未开始';
  if (value < 1) return `${Math.round(value * 24 * 60)} 分钟`;
  if (value < 30) return `${Math.round(value)} 天`;
  return `${Math.round(value / 30)} 个月`;
}

function formatDate(value: string | null) {
  if (!value) return '未安排';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未安排';
  return date.toLocaleString();
}

function getReviewAdvice(detail: WordDetail) {
  if (detail.is_leech) return '这个词已经被识别为重点难词，建议用例句理解和拼写训练反复巩固。';
  if (detail.wrong_count > detail.correct_count) return '错误次数偏多，建议先看 AI 讲解，再进入错题本做变式练习。';
  if (detail.mastery_level >= 80) return '掌握度较高，可以降低复习频率，用测试题确认是否真正会用。';
  if (!detail.status) return '这个词还没有加入学习计划。可以从词库页加入对应词书后开始系统复习。';
  return '当前处于正常学习节奏，按系统安排完成下一次复习即可。';
}
