import React from 'react';
import { BookMarked, CheckCircle2, GraduationCap, XCircle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

const grammarTopics = [
  {
    key: 'tense',
    title: '时态',
    level: '基础',
    summary: '用动词形式表达动作发生的时间和状态。先掌握一般现在时、一般过去时、现在完成时和将来时。',
    examples: [
      'She studies English every day.',
      'I finished the task yesterday.',
      'They have lived here for three years.',
    ],
    tips: ['看到 every day 常用一般现在时。', '看到 yesterday / last week 常用一般过去时。', 'have/has + done 通常表达已经完成或持续到现在。'],
    question: 'Choose the best answer: She ____ English every morning.',
    options: ['study', 'studies', 'studied', 'has study'],
    answer: 'studies',
    explanation: '主语 She 是第三人称单数，一般现在时动词需要加 s。',
  },
  {
    key: 'clause',
    title: '从句',
    level: '进阶',
    summary: '从句是句子里的“子句”，常见类型包括定语从句、状语从句和名词性从句。',
    examples: [
      'The book that you recommended is useful.',
      'I will call you when I arrive.',
      'What he said was important.',
    ],
    tips: ['that / which / who 常引导定语从句。', 'when / because / if 常引导状语从句。', 'what / whether / that 可引导名词性从句。'],
    question: 'Choose the best answer: This is the student ____ won the prize.',
    options: ['which', 'who', 'where', 'when'],
    answer: 'who',
    explanation: '先行词是 the student，指人，定语从句中作主语，所以用 who。',
  },
  {
    key: 'voice',
    title: '被动语态',
    level: '基础',
    summary: '当重点是动作承受者，而不是动作执行者时，常使用 be + done 的被动结构。',
    examples: [
      'The room is cleaned every day.',
      'The email was sent yesterday.',
      'The problem will be solved soon.',
    ],
    tips: ['被动语态核心是 be + 过去分词。', '不同时态主要变化 be 动词。', '需要说明执行者时可用 by。'],
    question: 'Choose the best answer: The letter ____ yesterday.',
    options: ['sent', 'is sent', 'was sent', 'send'],
    answer: 'was sent',
    explanation: 'yesterday 表示过去，letter 是动作承受者，所以用 was sent。',
  },
  {
    key: 'agreement',
    title: '主谓一致',
    level: '基础',
    summary: '谓语动词要和主语在人称和数上保持一致，尤其注意第三人称单数和就近原则。',
    examples: [
      'He likes reading.',
      'The students are ready.',
      'Either you or he is responsible.',
    ],
    tips: ['第三人称单数一般现在时动词加 s。', '复数主语通常用动词原形或 are。', 'either...or / neither...nor 常看离谓语最近的主语。'],
    question: 'Choose the best answer: Neither the teachers nor the student ____ late.',
    options: ['are', 'were', 'is', 'be'],
    answer: 'is',
    explanation: 'neither...nor 使用就近原则，离谓语最近的是 the student，所以用 is。',
  },
];

export function GrammarPage() {
  const [selectedKey, setSelectedKey] = React.useState(grammarTopics[0].key);
  const [selectedAnswer, setSelectedAnswer] = React.useState('');
  const topic = grammarTopics.find((item) => item.key === selectedKey) ?? grammarTopics[0];
  const answered = Boolean(selectedAnswer);
  const isCorrect = selectedAnswer === topic.answer;

  function chooseTopic(key: string) {
    setSelectedKey(key);
    setSelectedAnswer('');
  }

  return (
    <>
      <PageHeader
        title="语法学习"
        description="按知识点学习语法规则、例句和专项练习，先覆盖上架基础版需要的核心语法入口。"
      />

      <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="surface rounded-lg p-4">
          <div className="flex items-center gap-2">
            <GraduationCap size={21} style={{ color: 'var(--green)' }} />
            <h2 className="text-xl font-semibold">知识点</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {grammarTopics.map((item) => (
              <button
                className="rounded-lg border p-3 text-left transition hover:-translate-y-0.5"
                key={item.key}
                onClick={() => chooseTopic(item.key)}
                style={{
                  borderColor: topic.key === item.key ? 'var(--green)' : 'var(--line)',
                  background: topic.key === item.key ? 'var(--green-soft)' : 'var(--paper)',
                }}
                type="button"
              >
                <div className="flex items-center justify-between gap-2">
                  <strong>{item.title}</strong>
                  <span className="chip">{item.level}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>{item.summary}</p>
              </button>
            ))}
          </div>
        </aside>

        <article className="surface rounded-lg p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2" style={{ color: 'var(--green)' }}>
                <BookMarked size={20} />
                <span className="text-sm font-semibold">{topic.level}语法</span>
              </div>
              <h1 className="mt-2 text-3xl font-semibold">{topic.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: 'var(--muted)' }}>{topic.summary}</p>
            </div>
          </div>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
              <h3 className="font-semibold">例句</h3>
              <div className="mt-3 grid gap-2">
                {topic.examples.map((example) => (
                  <p className="rounded-lg p-3 text-sm leading-6" key={example} style={{ background: 'var(--panel)' }}>{example}</p>
                ))}
              </div>
            </div>

            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
              <h3 className="font-semibold">记忆提示</h3>
              <div className="mt-3 grid gap-2">
                {topic.tips.map((tip) => (
                  <p className="text-sm leading-6" key={tip} style={{ color: 'var(--muted)' }}>{tip}</p>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-lg border p-5" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
            <h3 className="text-xl font-semibold">专项练习</h3>
            <p className="mt-3 text-sm leading-6">{topic.question}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {topic.options.map((option) => {
                const selected = selectedAnswer === option;
                const correct = answered && option === topic.answer;
                const wrong = answered && selected && !correct;
                return (
                  <button
                    className="rounded-lg border p-4 text-left font-semibold transition hover:-translate-y-0.5"
                    disabled={answered}
                    key={option}
                    onClick={() => setSelectedAnswer(option)}
                    style={{
                      borderColor: correct ? 'var(--green)' : wrong ? 'var(--red)' : 'var(--line)',
                      background: correct ? 'var(--green-soft)' : wrong ? 'var(--red-soft)' : 'var(--panel)',
                    }}
                    type="button"
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {answered && (
              <div className="mt-4 rounded-lg border p-4" style={{ borderColor: isCorrect ? 'var(--green)' : 'var(--red)', background: isCorrect ? 'var(--green-soft)' : 'var(--red-soft)' }}>
                <div className="flex items-center gap-2 font-semibold">
                  {isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  {isCorrect ? '回答正确' : '回答错误'}
                </div>
                <p className="mt-2 text-sm leading-6">{topic.explanation}</p>
                <button className="button-secondary mt-4" onClick={() => setSelectedAnswer('')} type="button">再练一次</button>
              </div>
            )}
          </section>
        </article>
      </section>
    </>
  );
}
