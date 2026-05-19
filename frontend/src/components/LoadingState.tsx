export function LoadingState({ text = '正在加载数据...' }: { text?: string }) {
  return (
    <div className="surface flex min-h-[260px] flex-col items-center justify-center rounded-lg p-6 text-center">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute h-14 w-14 animate-spin rounded-full border-4 border-[#d9e0d4] border-t-[#2f6840] dark:border-[#353d34] dark:border-t-[#7fb87a]" />
        <div className="h-5 w-5 rounded-full bg-[#e2f0df] dark:bg-[#1e2f1c]" />
      </div>
      <div className="mt-4 text-sm font-semibold" style={{ color: 'var(--muted)' }}>
        {text}
      </div>
    </div>
  );
}
