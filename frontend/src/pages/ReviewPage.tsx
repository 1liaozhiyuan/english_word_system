import { getTodayReview } from '../api/study';
import { LearningSession } from '../components/LearningSession';

export function ReviewPage() {
  return (
    <LearningSession
      title="复习"
      description="这里展示已经学过，并且今天到期需要复习的单词。"
      emptyText="今天没有到期复习。可以学习几个新词，让系统开始为你安排复习节奏。"
      loadItems={getTodayReview}
      completionTitle="复习任务完成"
      defaultBatchSize={20}
      nextAction={{ label: '查看错词', to: '/mistakes' }}
      emptyNextAction={{ label: '学习新词', to: '/study' }}
    />
  );
}
