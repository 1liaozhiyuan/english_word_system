export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header
      className="mb-6 flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between"
      style={{ borderColor: 'var(--line)' }}
    >
      <div className="min-w-0">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
          Learning Desk
        </p>
        <h2 className="text-3xl font-semibold tracking-normal md:text-4xl" style={{ color: 'var(--ink)' }}>
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: 'var(--muted)' }}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex w-full shrink-0 flex-wrap gap-2 md:w-auto md:justify-end">{action}</div>}
    </header>
  );
}
