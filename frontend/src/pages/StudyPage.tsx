import { getNewStudy } from '../api/study';
import { LearningSession } from '../components/LearningSession';

export function StudyPage() {
  return (
    <LearningSession
      title="新词学习"
      description="这里优先展示未学习的新词。完成后，系统会根据表现安排后续复习。"
      emptyText="今天没有待学习新词。可以去词书页选择词书，或去复习页完成到期复习。"
      loadItems={getNewStudy}
      completionTitle="新词学习完成"
      defaultBatchSize={10}
      nextAction={{ label: '去复习', to: '/review' }}
      emptyNextAction={{ label: '去选择词书', to: '/word-books' }}
    />
  );
}
