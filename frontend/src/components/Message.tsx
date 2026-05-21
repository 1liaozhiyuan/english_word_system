import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type React from 'react';

type MessageTone = 'success' | 'error' | 'warning' | 'info';

export function Message({
  children,
  tone = 'success',
}: {
  children?: React.ReactNode;
  tone?: MessageTone;
}) {
  if (!children) return null;

  const style = toneStyle[tone];
  const Icon = style.icon;

  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium"
      style={{ borderColor: style.border, background: style.background, color: style.color }}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 flex-shrink-0" size={17} />
      <div className="min-w-0 whitespace-pre-wrap break-words leading-6">{children}</div>
    </div>
  );
}

const toneStyle = {
  success: {
    icon: CheckCircle2,
    border: 'color-mix(in srgb, var(--green) 28%, var(--line))',
    background: 'var(--green-soft)',
    color: 'var(--green)',
  },
  error: {
    icon: AlertCircle,
    border: 'color-mix(in srgb, var(--red) 32%, var(--line))',
    background: 'var(--red-soft)',
    color: 'var(--red)',
  },
  warning: {
    icon: TriangleAlert,
    border: 'color-mix(in srgb, var(--amber) 34%, var(--line))',
    background: 'var(--amber-soft)',
    color: 'var(--amber)',
  },
  info: {
    icon: Info,
    border: 'color-mix(in srgb, var(--blue) 30%, var(--line))',
    background: 'var(--blue-soft)',
    color: 'var(--blue)',
  },
} satisfies Record<MessageTone, { icon: typeof Info; border: string; background: string; color: string }>;
