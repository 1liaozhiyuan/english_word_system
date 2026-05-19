import { Sparkles, Square } from 'lucide-react';

export function AIResultPanel({
  title,
  content,
  isLoading,
  onStop,
}: {
  title: string;
  content: string;
  isLoading?: boolean;
  onStop?: () => void;
}) {
  if (!content && !isLoading) return null;

  return (
    <div className="mt-5 rounded-lg border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--green)' }}>
          <Sparkles size={17} />
          {title}
          {content && !isLoading && (
            <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--green-soft)' }}>
              本页已缓存
            </span>
          )}
        </div>
        {isLoading && onStop && (
          <button className="button-secondary min-h-8 px-3 text-xs" onClick={onStop} type="button">
            <Square size={13} />
            停止生成
          </button>
        )}
      </div>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-7" style={{ color: 'var(--ink)' }}>
        {content || 'AI 正在流式生成内容，请稍等...'}
        {isLoading && content && <span className="ml-1 animate-pulse">|</span>}
      </div>
    </div>
  );
}
