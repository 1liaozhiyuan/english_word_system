import { Check, CircleX, Eye, Frown, Lightbulb, Smile, Sparkles, Volume2, VolumeX } from 'lucide-react';
import React from 'react';
import { explainWord, generateExample } from '../api/ai';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AIResultPanel } from './AIResultPanel';
import { FavoriteButton } from './FavoriteButton';
import type { SpeechAccent, StudyItem, StudyMode } from '../types';

export function WordCard({
  item,
  studyMode,
  autoPlayWord = true,
  autoPlayExample = true,
  autoRevealAfterAudio = false,
  speechAccent = 'en-US',
  isSubmitting = false,
  isWaitingNext = false,
  onAnswer,
  onContinue,
}: {
  item: StudyItem;
  studyMode: StudyMode;
  autoPlayWord?: boolean;
  autoPlayExample?: boolean;
  autoRevealAfterAudio?: boolean;
  speechAccent?: SpeechAccent;
  isSubmitting?: boolean;
  isWaitingNext?: boolean;
  onAnswer: (quality: number) => void | Promise<void>;
  onContinue?: () => void;
}) {
  const { token } = useAuth();
  const [showAnswer, setShowAnswer] = React.useState(false);
  const [userInput, setUserInput] = React.useState('');
  const [aiContent, setAiContent] = React.useState('');
  const [aiTitle, setAiTitle] = React.useState('AI 助手');
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [answerFeedback, setAnswerFeedback] = React.useState<{ quality: number; id: number } | null>(null);
  const aiAbortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    stopSpeech();
    setShowAnswer(false);
    setUserInput('');
    setAiContent('');
    setIsAiLoading(false);
    setAnswerFeedback(null);
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;

    const timer = window.setTimeout(() => {
      if (autoPlayWord && studyMode !== 'cn_to_en') {
        speakText(item.word.text, {
          cancelFirst: false,
          onEnd: autoRevealAfterAudio ? revealAnswer : undefined,
        });
      }
    }, 260);

    return () => {
      window.clearTimeout(timer);
      stopSpeech();
    };
  }, [item.progress_id, studyMode, autoPlayWord, autoRevealAfterAudio]);

  React.useEffect(() => {
    if (!showAnswer) return;
    const texts = [
      autoPlayWord ? item.word.text : '',
      autoPlayExample ? item.word.example_sentence : '',
    ].filter(Boolean) as string[];
    if (texts.length > 0) speakSequence(texts);
  }, [showAnswer, item.progress_id, autoPlayWord, autoPlayExample]);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!showAnswer || isSubmitting) return;
      if (event.key === 'Enter' && isWaitingNext) {
        event.preventDefault();
        onContinue?.();
        return;
      }
      if (event.key >= '1' && event.key <= '4') {
        event.preventDefault();
        handleAnswer(Number(event.key) - 1);
      }
      if (event.key === ' ') {
        event.preventDefault();
        speakText(item.word.text);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAnswer, isSubmitting, isWaitingNext, item.progress_id, onContinue]);

  React.useEffect(() => {
    function handleHiddenKeyDown(event: KeyboardEvent) {
      if (showAnswer || isSubmitting) return;
      if (event.key === ' ') {
        event.preventDefault();
        speakText(item.word.text);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        revealAnswer();
      }
    }
    window.addEventListener('keydown', handleHiddenKeyDown);
    return () => window.removeEventListener('keydown', handleHiddenKeyDown);
  }, [showAnswer, isSubmitting, item.progress_id]);

  function stopSpeech() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
  }

  function createUtterance(text: string, onEnd?: () => void) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechAccent;
    utterance.rate = 0.86;
    const voice = findVoice(speechAccent);
    if (voice) utterance.voice = voice;
    if (onEnd) utterance.onend = onEnd;
    return utterance;
  }

  function speakText(text: string, options: { cancelFirst?: boolean; onEnd?: () => void } = {}) {
    if (!window.speechSynthesis || !text.trim()) return;
    if (options.cancelFirst ?? true) stopSpeech();
    window.speechSynthesis.speak(createUtterance(text, options.onEnd));
  }

  function speakSequence(texts: string[]) {
    if (!window.speechSynthesis) return;
    stopSpeech();
    texts.filter((text) => text.trim()).forEach((text) => {
      window.speechSynthesis.speak(createUtterance(text));
    });
  }

  function revealAnswer() {
    setShowAnswer(true);
  }

  function handleAnswer(quality: number) {
    if (answerFeedback || isWaitingNext) return;
    stopSpeech();
    setAnswerFeedback({ quality, id: Date.now() });
    onAnswer(quality);
  }

  async function runAI(kind: 'explain' | 'example') {
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setIsAiLoading(true);
    setAiContent('');
    setAiTitle(kind === 'explain' ? 'AI 单词讲解' : 'AI 生成例句');

    try {
      const content = kind === 'explain'
        ? await explainWord(token, item.word, setAiContent, { signal: controller.signal })
        : await generateExample(token, item.word, '中等', setAiContent, { signal: controller.signal });
      setAiContent(content);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setAiContent(getErrorMessage(error));
      }
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

  const spellingResult = getSpellingResult(userInput, item.word.text);
  const canAutoGrade = studyMode === 'spelling' || studyMode === 'cn_to_en';
  const feedbackTone = answerFeedback ? getFeedbackTone(answerFeedback.quality) : null;

  return (
    <div className={`learning-card ${feedbackTone ? `answer-feedback-card answer-feedback-card-${feedbackTone}` : ''}`}>
      {answerFeedback && (
        <div className={`answer-feedback-overlay answer-feedback-${feedbackTone}`} key={answerFeedback.id}>
          <div className="answer-feedback-mark">
            {feedbackTone === 'wrong' ? <CircleX size={34} /> : <Check size={34} />}
          </div>
          <div className="answer-feedback-text">{feedbackText[answerFeedback.quality]}</div>
        </div>
      )}

      <div className="learning-card-header px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-[#e6efdf] text-[#355e3b] dark:bg-[#1e2f1c] dark:text-[#7fb87a]">
              {statusText[item.status] ?? item.status}
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
              掌握度 {item.mastery_level}
            </span>
            {item.is_leech && (
              <span className="chip bg-[#f4dddd] text-[#a13d3d] dark:bg-[#2e1b1b] dark:text-[#d47373]">
                重点难词
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-white/80 text-[#6b6a62] dark:bg-[#1f1d18] dark:text-[#9a978d]">
              {modeLabel[studyMode]}
            </span>
            <span className="chip bg-white/80 text-[#6b6a62] dark:bg-[#1f1d18] dark:text-[#9a978d]">
              空格发音 · Enter {showAnswer ? '下一词' : '显答案'}
            </span>
            <button className="button-secondary" disabled={isSubmitting} onClick={stopSpeech} type="button">
              <VolumeX size={16} />
              停止音频
            </button>
          </div>
        </div>
      </div>

      <div className="word-card-body">
        <div className="word-content-panel">
          {!showAnswer ? renderQuestion() : renderAnswer()}
        </div>
        <MemoryPanel item={item} showAnswer={showAnswer} studyMode={studyMode} />
      </div>
    </div>
  );

  function renderQuestion() {
    if (studyMode === 'cn_to_en') {
      return (
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>根据释义回忆英文</p>
          <h2 className="mt-4 break-words text-5xl font-semibold tracking-normal md:text-6xl">
            {item.word.meaning}
          </h2>
          {item.word.part_of_speech && (
            <p className="mt-3 text-sm font-medium" style={{ color: 'var(--muted)' }}>
              {item.word.part_of_speech}
            </p>
          )}
          <SpellingInput
            value={userInput}
            onChange={setUserInput}
            onReveal={revealAnswer}
            disabled={isSubmitting}
            placeholder="输入英文单词..."
            helpText="先根据中文释义写出英文，再显示答案对比。"
          />
        </div>
      );
    }

    if (studyMode === 'listening') {
      return (
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>听音辨义</p>
          <div className="mt-4 flex items-start justify-between gap-4">
            <h2 className="break-words text-4xl font-semibold tracking-normal" style={{ color: 'var(--muted)' }}>
              先听，再回忆
            </h2>
            <button
              aria-label="播放单词发音"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e6efdf] text-[#355e3b]"
              disabled={isSubmitting}
              onClick={() => speakText(item.word.text)}
              type="button"
            >
              <Volume2 size={28} />
            </button>
          </div>
          <PromptPanel
            text="点击发音按钮，回忆这个单词的中文释义、词性和例句，再显示答案。"
            onReveal={revealAnswer}
            disabled={isSubmitting}
          />
        </div>
      );
    }

    if (studyMode === 'spelling') {
      return (
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>听写训练</p>
          <div className="mt-4 flex items-center gap-3">
            <button
              aria-label="播放单词发音"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#e6efdf] text-[#355e3b]"
              disabled={isSubmitting}
              onClick={() => speakText(item.word.text)}
              type="button"
            >
              <Volume2 size={19} />
            </button>
            <h2 className="text-2xl font-semibold">听发音并拼写单词</h2>
          </div>
          <SpellingInput
            value={userInput}
            onChange={setUserInput}
            onReveal={revealAnswer}
            disabled={isSubmitting}
            placeholder="输入你听到的单词..."
            helpText="听发音后输入英文单词，显示答案后系统会给出拼写反馈。"
          />
        </div>
      );
    }

    return (
      <div>
        <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>先回忆，再确认</p>
        <div className="mt-4 flex items-center gap-3">
          <h2 className="break-words text-5xl font-semibold tracking-normal md:text-6xl">
            {item.word.text}
          </h2>
          <button
            aria-label="播放单词发音"
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#e6efdf] text-[#355e3b]"
            disabled={isSubmitting}
            onClick={() => speakText(item.word.text)}
            type="button"
          >
            <Volume2 size={19} />
          </button>
        </div>
        {item.word.phonetic && <p className="mt-4 text-lg font-semibold text-[#355e3b]">{item.word.phonetic}</p>}
        <PromptPanel
          text="先在心里回忆释义、词性和例句，再显示答案。这样记录的掌握度会更接近真实记忆状态。"
          onReveal={revealAnswer}
          disabled={isSubmitting}
        />
      </div>
    );
  }

  function renderAnswer() {
    return (
      <>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="break-words text-5xl font-semibold tracking-normal md:text-6xl">
              {item.word.text}
            </h2>
            <button
              aria-label="播放单词发音"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#e6efdf] text-[#355e3b]"
              disabled={isSubmitting}
              onClick={() => speakText(item.word.text)}
              type="button"
            >
              <Volume2 size={19} />
            </button>
          </div>
          {item.word.phonetic && <p className="mt-4 text-lg font-semibold text-[#355e3b]">{item.word.phonetic}</p>}
          {canAutoGrade && (
            <SpellingFeedback userInput={userInput} target={item.word.text} result={spellingResult} />
          )}
        </div>

        <div className="mt-6">
          <p className="text-3xl font-semibold">{item.word.meaning}</p>
          {item.word.part_of_speech && (
            <p className="mt-2 text-sm font-medium" style={{ color: 'var(--muted)' }}>
              {item.word.part_of_speech}
            </p>
          )}
          {(item.word.example_sentence || item.word.example_translation) && (
            <div className="mt-8 rounded-lg border border-[#ddd7c7] bg-[#fbf8ef] p-5 dark:border-[#3d3a32] dark:bg-[#1f1d18]">
              {item.word.example_sentence && <p className="text-lg leading-8">{item.word.example_sentence}</p>}
              {item.word.example_translation && (
                <p className="mt-2 leading-7" style={{ color: 'var(--muted)' }}>
                  {item.word.example_translation}
                </p>
              )}
            </div>
          )}
          {item.word.note && (
            <div className="mt-4 flex gap-2 rounded-lg border border-[#ddd7c7] bg-[#fffdf8] p-4 text-sm dark:border-[#3d3a32] dark:bg-[#1f1d18]">
              <Lightbulb size={18} style={{ color: 'var(--amber)' }} />
              <span style={{ color: 'var(--muted)' }}>{item.word.note}</span>
            </div>
          )}
        </div>

        {canAutoGrade && (
          <button
            className="button-primary w-fit"
            disabled={isSubmitting || isWaitingNext}
            onClick={() => handleAnswer(spellingResult.quality)}
            type="button"
          >
            按拼写结果记录：{qualityLabel[spellingResult.quality]}
          </button>
        )}

        <div className="flex flex-wrap gap-2">
          <FavoriteButton wordId={item.word.id} initialFavorite={item.is_favorite} disabled={isSubmitting || isAiLoading} />
          <button className="button-secondary" disabled={isSubmitting || isAiLoading} onClick={() => runAI('explain')} type="button">
            <Sparkles size={16} />
            AI 讲解
          </button>
          <button className="button-secondary" disabled={isSubmitting || isAiLoading} onClick={() => runAI('example')} type="button">
            <Sparkles size={16} />
            AI 例句
          </button>
        </div>
        <AIResultPanel title={aiTitle} content={aiContent} isLoading={isAiLoading} onStop={stopAI} />
        <AnswerButtons isSubmitting={isSubmitting || isWaitingNext} onAnswer={handleAnswer} />
        {isWaitingNext && (
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--green)', background: 'var(--green-soft)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-bold" style={{ color: 'var(--green)' }}>
                已记录本题，准备进入下一个单词。
              </div>
              <button className="button-primary" onClick={onContinue} type="button">
                下一个单词
              </button>
            </div>
          </div>
        )}
      </>
    );
  }
}

function findVoice(lang: SpeechAccent) {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang === lang)
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(lang.toLowerCase()))
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('en'))
    ?? null;
}

function PromptPanel({
  text,
  onReveal,
  disabled,
}: {
  text: string;
  onReveal: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-8 max-w-xl rounded-lg border border-[#ddd7c7] bg-[#fbf8ef] p-5 dark:border-[#3d3a32] dark:bg-[#1f1d18]">
      <p className="text-sm leading-6" style={{ color: 'var(--muted)' }}>
        {text}
      </p>
      <button className="button-primary mt-4" disabled={disabled} onClick={onReveal} type="button">
        <Eye size={17} />
        显示答案
      </button>
    </div>
  );
}

function MemoryPanel({
  item,
  showAnswer,
  studyMode,
}: {
  item: StudyItem;
  showAnswer: boolean;
  studyMode: StudyMode;
}) {
  const firstLetter = item.word.text.trim()[0] || '?';
  const hint = showAnswer
    ? item.word.meaning
    : studyMode === 'cn_to_en'
      ? item.word.part_of_speech || '回忆英文拼写'
      : item.word.phonetic || '先听读，再回忆';

  return (
    <aside className="memory-panel">
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="chip bg-white/80 text-[#355e3b] dark:bg-[#1f1d18] dark:text-[#7fb87a]">
            记忆焦点
          </span>
          <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
            Lv.{item.mastery_level}
          </span>
        </div>
        <div className="word-avatar mt-6">{firstLetter}</div>
      </div>

      <div>
        <p className="break-words text-center text-lg font-semibold" style={{ color: 'var(--ink)' }}>
          {hint}
        </p>
        <div className="word-meta-grid mt-5">
          <div className="word-meta-cell">
            <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>状态</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {statusText[item.status] ?? item.status}
            </div>
          </div>
          <div className="word-meta-cell">
            <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>间隔</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {formatInterval(item.interval_days)}
            </div>
          </div>
          <div className="word-meta-cell">
            <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>下次复习</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {formatNextReview(item.next_review_at)}
            </div>
          </div>
          <div className="word-meta-cell">
            <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>记录</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              对 {item.correct_count} / 错 {item.wrong_count}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-lg p-3 text-sm leading-6" style={{ background: 'var(--panel)', color: 'var(--muted)' }}>
          {getMemoryReason(item)}
        </div>
      </div>
    </aside>
  );
}

function SpellingInput({
  value,
  onChange,
  onReveal,
  disabled = false,
  placeholder,
  helpText,
}: {
  value: string;
  onChange: (value: string) => void;
  onReveal: () => void;
  disabled?: boolean;
  placeholder: string;
  helpText: string;
}) {
  return (
    <div className="mt-8 max-w-xl rounded-lg border border-[#ddd7c7] bg-[#fbf8ef] p-5 dark:border-[#3d3a32] dark:bg-[#1f1d18]">
      <p className="text-sm leading-6" style={{ color: 'var(--muted)' }}>{helpText}</p>
      <input
        className="input mt-3"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !disabled) onReveal();
        }}
        placeholder={placeholder}
        autoFocus
      />
      <button className="button-primary mt-3" disabled={disabled} onClick={onReveal} type="button">
        <Eye size={17} />
        显示答案
      </button>
    </div>
  );
}

function SpellingFeedback({
  userInput,
  target,
  result,
}: {
  userInput: string;
  target: string;
  result: SpellingResult;
}) {
  const hasInput = normalizeWord(userInput).length > 0;

  return (
    <div className="mt-5 rounded-lg border border-[#ddd7c7] bg-[#fbf8ef] p-4 dark:border-[#3d3a32] dark:bg-[#1f1d18]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold" style={{ color: 'var(--muted)' }}>你的输入</div>
          <div className={result.isExact ? 'mt-1 text-xl font-semibold text-[#355e3b]' : 'mt-1 text-xl font-semibold text-[#a13d3d]'}>
            {hasInput ? userInput : '未输入'}
          </div>
        </div>
        <span className={result.isExact ? 'rounded-full bg-[#e6efdf] px-3 py-1 text-xs font-bold text-[#355e3b]' : 'rounded-full bg-[#f4dddd] px-3 py-1 text-xs font-bold text-[#a13d3d]'}>
          相似度 {result.similarity}%
        </span>
      </div>
      {!result.isExact && (
        <div className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>
          正确拼写是 <span className="font-bold" style={{ color: 'var(--ink)' }}>{target}</span>。如果只是大小写或空格问题，可以按“认识”或“熟练”记录。
        </div>
      )}
    </div>
  );
}

function AnswerButtons({
  isSubmitting,
  onAnswer,
}: {
  isSubmitting: boolean;
  onAnswer: (quality: number) => void;
}) {
  return (
    <div className="answer-action-grid grid gap-3 sm:grid-cols-4">
      <button className="answer answer-wrong" disabled={isSubmitting} onClick={() => onAnswer(0)} title="快捷键 1" type="button">
        <CircleX size={18} />
        不认识
      </button>
      <button className="answer answer-hard" disabled={isSubmitting} onClick={() => onAnswer(1)} title="快捷键 2" type="button">
        <Frown size={18} />
        困难
      </button>
      <button className="answer" disabled={isSubmitting} onClick={() => onAnswer(2)} title="快捷键 3" type="button">
        <Smile size={18} />
        认识
      </button>
      <button className="answer answer-good" disabled={isSubmitting} onClick={() => onAnswer(3)} title="快捷键 4" type="button">
        <Check size={18} />
        熟练
      </button>
    </div>
  );
}

type SpellingResult = {
  isExact: boolean;
  similarity: number;
  quality: number;
};

function getSpellingResult(input: string, target: string): SpellingResult {
  const normalizedInput = normalizeWord(input);
  const normalizedTarget = normalizeWord(target);
  if (!normalizedInput) return { isExact: false, similarity: 0, quality: 0 };

  const distance = levenshtein(normalizedInput, normalizedTarget);
  const maxLength = Math.max(normalizedInput.length, normalizedTarget.length, 1);
  const similarity = Math.max(0, Math.round((1 - distance / maxLength) * 100));
  const isExact = normalizedInput === normalizedTarget;

  let quality = 0;
  if (isExact) quality = 3;
  else if (similarity >= 85) quality = 2;
  else if (similarity >= 60) quality = 1;

  return { isExact, similarity, quality };
}

function normalizeWord(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function levenshtein(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let column = 1; column <= b.length; column += 1) {
    rows[0][column] = column;
  }

  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
  }

  return rows[a.length][b.length];
}

function formatInterval(value: number) {
  if (!value) return '未开始';
  if (value < 1) return `${Math.round(value * 24 * 60)} 分钟`;
  if (value < 30) return `${Math.round(value)} 天`;
  return `${Math.round(value / 30)} 个月`;
}

function formatNextReview(value: string | null) {
  if (!value) return '未安排';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未安排';
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return '现在';
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 60) return `${Math.max(1, diffMinutes)} 分钟后`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时后`;
  return `${Math.round(diffHours / 24)} 天后`;
}

function getMemoryReason(item: StudyItem) {
  if (item.is_leech) return '这个词反复出错，系统会把它作为重点难词更频繁地安排复盘。';
  if (item.status === 'new') return '这是新词，第一次回答会决定它进入短间隔学习还是直接拉长复习间隔。';
  if (item.wrong_count > item.correct_count) return '错误次数偏多，系统会缩短间隔，先稳住记忆再放远复习。';
  if (item.mastery_level >= 5) return '掌握度较高，答对后复习间隔会明显拉长。';
  return '系统根据你的掌握度、间隔和最近回答结果安排这次复习。';
}

function getFeedbackTone(quality: number) {
  if (quality <= 0) return 'wrong';
  if (quality === 1) return 'hard';
  return 'correct';
}

const qualityLabel: Record<number, string> = {
  0: '不认识',
  1: '困难',
  2: '认识',
  3: '熟练',
};

const feedbackText: Record<number, string> = {
  0: '继续复盘',
  1: '有点吃力',
  2: '回答不错',
  3: '非常熟练',
};

const modeLabel: Record<StudyMode, string> = {
  en_to_cn: '英译中',
  cn_to_en: '中译英',
  listening: '听音辨义',
  spelling: '拼写',
};

const statusText: Record<string, string> = {
  new: '新词',
  learning: '学习中',
  reviewing: '复习中',
  mastered: '已掌握',
};
