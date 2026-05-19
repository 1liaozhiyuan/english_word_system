export function StatCard({
  label,
  value,
  suffix = '',
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div
      className="stat-card rounded-lg p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-3xl font-semibold leading-none" style={{ color: 'var(--ink)' }}>
            {value}
            {suffix && <span className="ml-1 text-base font-bold" style={{ color: 'var(--muted)' }}>{suffix}</span>}
          </div>
          <div className="mt-2 text-sm font-semibold" style={{ color: 'var(--muted)' }}>{label}</div>
        </div>
        <div className="mt-1 h-2 w-2 rounded-full" style={{ background: 'var(--green)' }} />
      </div>
    </div>
  );
}
