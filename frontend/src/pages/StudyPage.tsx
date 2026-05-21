import { getNewStudy } from '../api/study';
import { LearningSession } from '../components/LearningSession';

export function StudyPage() {
  return (
    <LearningSession
      title="新词学习"
      description="优先学习还没有见过的新单词。完成后，系统会根据你的表现安排后续复习。"
      emptyText="今天没有待学习的新词。可以去词书页选择词书，或者去复习页清理到期单词。"
      loadItems={getNewStudy}
      completionTitle="新词学习完成"
      defaultBatchSize={10}
      nextAction={{ label: '去复习', to: '/review' }}
      emptyNextAction={{ label: '去选择词书', to: '/word-books' }}
    />
  );
}
